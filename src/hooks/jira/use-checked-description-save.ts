import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { useJiraQueryScope } from "./use-jira-query-scope";
import { resolvePendingMedia } from "./use-pending-uploads";
import { parseAdfDraft } from "@/lib/field-draft";
import { saveDescription, DescriptionSaveError, type DescriptionSaveInput, type DescriptionSaveTarget } from "@/lib/jira/description-save";
import { JiraRequestScopeChanged, jiraConnectionRevision, type JiraRequestScope } from "@/lib/jira/client";
import { useJiraSite } from "@/lib/jira/queries";
import { jiraKeys } from "@/lib/jira/keys";
import { invalidateIssueChange } from "@/lib/jira/mutation-cache";
import { pendingMediaIds } from "@/lib/jira/pending-media";
import { jiraQueryScopeMatches, readJiraAccount, withJiraQueryScope, type JiraQueryScope } from "@/lib/jira/query-scope";

export function useCheckedDescriptionSave(issueKey: string) {
  const client = useQueryClient();
  const { scope } = useJiraQueryScope();
  const host = useJiraSite().data?.siteUrl;
  const mutation = useMutation({
    mutationKey: jiraKeys.descriptionSave(issueKey, scope),
    retry: false,
    mutationFn: (job: { target: DescriptionSaveTarget; input: DescriptionSaveInput; scope?: JiraQueryScope; host?: string; revision: number; isEditorCurrent: () => boolean }) => {
      const { target, input, scope, host } = job;
      if (!scope || !host) return Promise.reject(new JiraRequestScopeChanged());
      const requestScope: JiraRequestScope = {
        cloudId: scope.cloudId,
        siteUrl: host,
        isCurrent: () => job.isEditorCurrent() && job.revision === jiraConnectionRevision() && jiraQueryScopeMatches(client, scope) &&
          client.getQueryData<{ siteUrl: string }>(jiraKeys.site)?.siteUrl === host,
      };
      const prepare = input.format === "adf" && pendingMediaIds(parseAdfDraft(input.draft.text)).length > 0
        ? (value: unknown) => Effect.tryPromise({
            try: async () => (await resolvePendingMedia(client, target.key, { description: value }, { scope: requestScope, issueId: target.id })).description,
            catch: () => new DescriptionSaveError({ message: "Eingefügte Dateien konnten nicht vorbereitet werden. Dein Entwurf bleibt erhalten." }),
          })
        : undefined;
      return Effect.runPromise(withJiraQueryScope(client, scope, Effect.gen(function* () {
        const account = yield* readJiraAccount(requestScope, false);
        if (!requestScope.isCurrent() || account.accountId !== scope.accountId) return yield* new JiraRequestScopeChanged();
        return yield* saveDescription(target, input, requestScope, prepare);
      })));
    },
    onSuccess: (result, job) => {
      if (result.status === "saved" && job.revision === jiraConnectionRevision() && jiraQueryScopeMatches(client, job.scope)) {
        invalidateIssueChange(client, job.target.key, true);
        void client.invalidateQueries({ queryKey: jiraKeys.wiki(job.target.key, "description") });
      }
    },
  });
  const current = mutation.variables?.target.key === issueKey && mutation.variables.isEditorCurrent() &&
    mutation.variables.revision === jiraConnectionRevision() && jiraQueryScopeMatches(client, mutation.variables.scope);
  return {
    ...mutation,
    data: current ? mutation.data : undefined,
    error: current ? mutation.error : null,
    mutateAsync: (issueId: string, input: DescriptionSaveInput, isEditorCurrent: () => boolean) =>
      mutation.mutateAsync({ target: { key: issueKey, id: issueId }, input, scope, host, revision: jiraConnectionRevision(), isEditorCurrent }),
  };
}
