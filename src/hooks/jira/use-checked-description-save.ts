import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { useJiraQueryScope } from "./use-jira-query-scope";
import { resolvePendingMedia } from "./use-pending-uploads";
import { parseAdfDraft } from "@/lib/field-draft";
import { saveDescription, DescriptionSaveError, type DescriptionSaveInput } from "@/lib/jira/description-save";
import { jiraKeys } from "@/lib/jira/keys";
import { invalidateIssueChange } from "@/lib/jira/mutation-cache";
import { pendingMediaIds } from "@/lib/jira/pending-media";
import { jiraQueryScopeMatches, jiraRequestScope, withJiraQueryScope, type JiraQueryScope } from "@/lib/jira/query-scope";

export function useCheckedDescriptionSave(issueKey: string) {
  const client = useQueryClient();
  const { scope } = useJiraQueryScope();
  const mutation = useMutation({
    mutationKey: jiraKeys.descriptionSave(issueKey, scope),
    retry: false,
    mutationFn: (job: { issueKey: string; input: DescriptionSaveInput; scope?: JiraQueryScope }) => {
      const prepare = job.input.format === "adf" && pendingMediaIds(parseAdfDraft(job.input.draft.text)).length > 0
        ? (value: unknown) => withJiraQueryScope(client, job.scope, Effect.tryPromise({
            try: async () => (await resolvePendingMedia(client, job.issueKey, { description: value })).description,
            catch: () => new DescriptionSaveError({ message: "Eingefügte Dateien konnten nicht vorbereitet werden. Dein Entwurf bleibt erhalten." }),
          }))
        : undefined;
      return Effect.runPromise(withJiraQueryScope(client, job.scope,
        saveDescription(job.issueKey, job.input, job.scope ? jiraRequestScope(client, job.scope) : undefined, prepare),
      ));
    },
    onSuccess: (result, job) => {
      if (result.status === "saved" && jiraQueryScopeMatches(client, job.scope)) {
        invalidateIssueChange(client, job.issueKey, true);
        void client.invalidateQueries({ queryKey: jiraKeys.wiki(job.issueKey, "description") });
      }
    },
  });
  const current = mutation.variables?.issueKey === issueKey && jiraQueryScopeMatches(client, mutation.variables.scope);
  return {
    ...mutation,
    data: current ? mutation.data : undefined,
    error: current ? mutation.error : null,
    mutateAsync: (input: DescriptionSaveInput) => mutation.mutateAsync({ issueKey, input, scope }),
  };
}
