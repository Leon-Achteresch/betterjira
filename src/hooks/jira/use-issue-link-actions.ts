import { useRef, useState } from "react";
import { useDebouncedValue } from "@tanstack/react-pacer";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { toast } from "sonner";
import { useJiraQueryScope } from "@/hooks/jira/use-jira-query-scope";
import { issueLinkKeys, type IssueLinkSummary, type LinkedIssueRow } from "@/lib/jira/issue-links";
import { createIssueLink, deleteIssueLink, fetchLinkPermission, fetchLinkTypes, issueLinkActionKeys, linkChoices, linkInputError, searchLinkTargets, type CreateLinkInput } from "@/lib/jira/issue-link-actions";
import { jiraErrorText } from "@/lib/jira/field-values";
import { jiraKeys } from "@/lib/jira/keys";
import { jiraQueryScopeMatches, jiraRequestScope, withJiraQueryScope, type JiraQueryScope } from "@/lib/jira/query-scope";

type LinkJob = { source: string; scope: JiraQueryScope; queryKey: ReturnType<typeof issueLinkKeys.issue> };
type CreateLinkJob = LinkJob & { input: CreateLinkInput };
type RemoveLinkJob = LinkJob & { issue: LinkedIssueRow };

export function useIssueLinkActions(issueKey: string, summary: IssueLinkSummary | undefined) {
  const client = useQueryClient();
  const { scope } = useJiraQueryScope();
  const scopeId = JSON.stringify(scope);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string>();
  const [target, setTarget] = useState<string>();
  const identity = `${scopeId}/${issueKey}`;
  const [previousIdentity, setPreviousIdentity] = useState(identity);
  if (previousIdentity !== identity) {
    setPreviousIdentity(identity);
    setOpen(false);
    setSearch("");
    setTarget(undefined);
    setSelected(undefined);
  }
  const [debounced] = useDebouncedValue(search.trim(), { wait: 250 });
  const lock = useRef(false);
  const queryKey = issueLinkKeys.issue(scope?.cloudId ?? "", scope?.accountId ?? "", issueKey);
  const permission = useQuery({
    queryKey: issueLinkActionKeys.permission(scopeId, issueKey),
    queryFn: ({ signal }) => Effect.runPromise(withJiraQueryScope(client, scope, fetchLinkPermission(issueKey)), { signal }),
    enabled: !!scope,
  });
  const types = useQuery({
    queryKey: issueLinkActionKeys.types(scopeId),
    queryFn: ({ signal }) => Effect.runPromise(withJiraQueryScope(client, scope, fetchLinkTypes()), { signal }),
    enabled: !!scope && open && permission.data === true,
  });
  const targets = useQuery({
    queryKey: issueLinkActionKeys.search(scopeId, debounced),
    queryFn: ({ signal }) => Effect.runPromise(withJiraQueryScope(client, scope, searchLinkTargets(debounced)), { signal }),
    enabled: !!scope && open && permission.data === true && debounced.length >= 2,
  });
  const choices = linkChoices(types.data ?? []);
  const choice = choices.find(({ id }) => id === selected) ?? choices[0];
  const invalidate = (job: LinkJob, otherKey: string) => {
    for (const key of [job.source, otherKey]) {
      void client.invalidateQueries({ queryKey: issueLinkKeys.issue(job.scope.cloudId, job.scope.accountId, key) });
      void client.invalidateQueries({ queryKey: jiraKeys.issueDetail(key, job.scope) });
    }
  };
  const create = useMutation({
    mutationFn: (job: CreateLinkJob) => Effect.runPromise(withJiraQueryScope(client, job.scope, createIssueLink(job.input, jiraRequestScope(client, job.scope)))),
    retry: false,
    onSuccess: (_, job) => {
      invalidate(job, job.input.target);
      if (!jiraQueryScopeMatches(client, job.scope)) return;
      if (job.source === issueKey) {
        setOpen(false);
        setSearch("");
        setTarget(undefined);
      }
      toast.success("Verknüpfung angelegt");
    },
    onError: (error, job) => {
      if (jiraQueryScopeMatches(client, job.scope)) toast.error(`Verknüpfung konnte nicht angelegt werden: ${jiraErrorText(error)}`);
    },
    onSettled: () => { lock.current = false; },
  });
  const remove = useMutation({
    mutationFn: (job: RemoveLinkJob) => Effect.runPromise(withJiraQueryScope(client, job.scope, deleteIssueLink(job.issue.link!.id, jiraRequestScope(client, job.scope)))),
    retry: false,
    onMutate: async (job) => {
      await client.cancelQueries({ queryKey: job.queryKey });
      const previous = client.getQueryData<IssueLinkSummary>(job.queryKey);
      const groups = previous?.groups.map((group) => ({ ...group, issues: group.issues.filter((row) => row.link?.id !== job.issue.link?.id) })).filter((group) => group.issues.length > 0);
      const optimistic = previous && groups ? { ...previous, groups, total: groups.reduce((sum, group) => sum + group.issues.length, 0) } : undefined;
      if (optimistic) client.setQueryData(job.queryKey, optimistic);
      return { previous, optimistic };
    },
    onSuccess: (_, job) => {
      if (!jiraQueryScopeMatches(client, job.scope)) return;
      toast.success("Verknüpfung entfernt", { action: { label: "Rückgängig", onClick: () => {
        if (lock.current || !job.issue.link || !jiraQueryScopeMatches(client, job.scope)) return;
        lock.current = true;
        create.mutate({ ...job, input: { source: job.source, target: job.issue.key, typeId: job.issue.link.typeId, direction: job.issue.link.direction } });
      } } });
    },
    onError: (error, job, context) => {
      if (context?.previous && client.getQueryData(job.queryKey) === context.optimistic) client.setQueryData(job.queryKey, context.previous);
      if (jiraQueryScopeMatches(client, job.scope)) toast.error(`Verknüpfung konnte nicht entfernt werden: ${jiraErrorText(error)}`);
    },
    onSettled: (_, __, job) => {
      lock.current = false;
      invalidate(job, job.issue.key);
    },
  });
  const validation = linkInputError(issueKey, target ?? "", choice, summary);
  const pending = create.isPending || remove.isPending;

  return {
    open,
    setOpen: (value: boolean) => { setOpen(value); create.reset(); },
    choices,
    choice,
    setChoice: setSelected,
    search,
    setSearch: (value: string) => { setSearch(value); setTarget(undefined); },
    target,
    selectTarget: setTarget,
    targets: debounced === search.trim() ? targets.data ?? [] : [],
    searching: targets.isFetching || debounced !== search.trim(),
    searchError: targets.error ? jiraErrorText(targets.error) : undefined,
    retrySearch: () => void targets.refetch(),
    metadataLoading: permission.isPending || (permission.data === true && types.isPending),
    metadataError: permission.error ?? types.error,
    retryMetadata: () => { void permission.refetch(); void types.refetch(); },
    forbidden: permission.data === false,
    canRemove: permission.data === true,
    pending,
    validation: target ? validation : undefined,
    error: create.error && create.variables?.source === issueKey && jiraQueryScopeMatches(client, create.variables.scope) ? jiraErrorText(create.error) : undefined,
    canSubmit: !pending && permission.data === true && !!summary && !validation,
    submit: () => {
      if (lock.current || validation || !target || !choice || !summary || !scope || permission.data !== true || !jiraQueryScopeMatches(client, scope)) return;
      lock.current = true;
      create.mutate({ source: issueKey, scope, queryKey, input: { source: issueKey, target, typeId: choice.type.id, direction: choice.direction } });
    },
    remove: (issue: LinkedIssueRow) => {
      if (lock.current || !issue.link || !scope || permission.data !== true || !jiraQueryScopeMatches(client, scope)) return;
      lock.current = true;
      remove.mutate({ source: issueKey, scope, queryKey, issue });
    },
  };
}

export type IssueLinkActions = ReturnType<typeof useIssueLinkActions>;
