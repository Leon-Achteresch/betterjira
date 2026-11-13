import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import {
  useJiraMyself,
  useJiraSite,
  type JiraUserResult,
} from "@/hooks/jira/use-jira";
import { useLatestRef } from "@/hooks/use-latest-ref";
import {
  bulkEditIssue,
  bulkEditMetadata,
  commonBulkOptions,
  parseBulkLabels,
  runBulkEdit,
  validBulkLabels,
  type BulkAction,
  type BulkResult,
} from "@/lib/jira/bulk-edit";
import { jiraKeys } from "@/lib/jira/keys";
import {
  patchBulkSearches,
  rollbackBulkSearches,
} from "@/lib/jira/bulk-edit-cache";
import { invalidateIssueChange } from "@/lib/jira/mutation-cache";
import {
  withJiraQueryScope,
  jiraQueryScopeMatches,
  jiraRequestScope,
  type JiraQueryScope,
} from "@/lib/jira/query-scope";

type BulkJob = {
  targets: readonly string[];
  action: BulkAction;
  scope: JiraQueryScope;
  scopeKey: string;
  display: unknown;
};

type Operation =
  | "self"
  | "person"
  | "unassigned"
  | "priority"
  | "status"
  | "add-labels"
  | "remove-labels";

export function useBulkEdit(keys: readonly string[], disabled: boolean) {
  const client = useQueryClient();
  const site = useJiraSite();
  const myself = useJiraMyself();
  const scope =
    site.data && myself.data
      ? { cloudId: site.data.cloudId, accountId: myself.data.accountId }
      : undefined;
  const scopeKey = JSON.stringify(scope);
  const latestScope = useLatestRef(scopeKey);
  const [open, setOpen] = useState(false);
  const [operation, setOperation] = useState<Operation>("self");
  const [priority, setPriority] = useState("");
  const [status, setStatus] = useState("");
  const [assignee, setAssignee] = useState<JiraUserResult | null>(null);
  const [labelsText, setLabelsText] = useState("");
  const [results, setResults] = useState<BulkResult[]>([]);
  const [resultScope, setResultScope] = useState(scopeKey);
  const [total, setTotal] = useState(0);
  const lock = useRef(false);
  const last = useRef<{
    action: BulkAction;
    keys: readonly string[];
    scopeKey: string;
    display: unknown;
  } | null>(null);
  const metadata = useQuery({
    queryKey: jiraKeys.bulkEdit(scopeKey ?? "", keys),
    queryFn: ({ signal }) =>
      Effect.runPromise(
        withJiraQueryScope(
          client,
          scope,
          Effect.forEach(keys, bulkEditMetadata, { concurrency: 4 }),
        ),
        { signal },
      ),
    enabled: open && !!scope && keys.length > 0 && !disabled,
    staleTime: 30_000,
  });
  const options = commonBulkOptions(metadata.data ?? []);
  const labels = parseBulkLabels(labelsText);
  const action: BulkAction | null =
    operation === "self" && options.assign && scope
      ? { kind: "assignee", accountId: scope.accountId }
      : operation === "unassigned" && options.unassign
        ? { kind: "assignee", accountId: null }
        : operation === "person" && options.assign && assignee
          ? { kind: "assignee", accountId: assignee.accountId }
          : operation === "priority" &&
              options.priorities.some(({ id }) => id === priority)
            ? { kind: "priority", id: priority }
            : operation === "status" &&
                options.statuses.some(({ id }) => id === status)
              ? { kind: "status", statusId: status }
              : operation === "add-labels" &&
                  options.addLabels &&
                  validBulkLabels(labels)
                ? { kind: "add-labels", labels }
                : operation === "remove-labels" &&
                    options.removeLabels &&
                    validBulkLabels(labels)
                  ? { kind: "remove-labels", labels }
                  : null;
  const mutation = useMutation({
    onMutate: async ({
      targets,
      action: sent,
      scope: sentScope,
      display,
    }: BulkJob) => {
      await client.cancelQueries({ queryKey: jiraKeys.allIssues });
      if (!jiraQueryScopeMatches(client, sentScope)) return [];
      return patchBulkSearches(client, targets, sent, display);
    },
    mutationFn: ({
      targets,
      action: sent,
      scope: sentScope,
      scopeKey: sentScopeKey,
    }: BulkJob) =>
      Effect.runPromise(
        runBulkEdit(
          targets,
          (key) =>
            withJiraQueryScope(
              client,
              sentScope,
              bulkEditIssue(key, sent, jiraRequestScope(client, sentScope)),
            ),
          (result) => {
            if (latestScope.current !== sentScopeKey) return;
            setResults((current) => [
              ...current.filter(({ key }) => key !== result.key),
              result,
            ]);
          },
        ),
      ),
    onSuccess: (completed, job, patches) => {
      if (!jiraQueryScopeMatches(client, job.scope)) return;
      rollbackBulkSearches(
        client,
        patches ?? [],
        completed.filter(({ error }) => error).map(({ key }) => key),
      );
      for (const result of completed)
        if (!result.error) invalidateIssueChange(client, result.key, true);
      void client.invalidateQueries({ queryKey: jiraKeys.allIssues });
      void client.invalidateQueries({
        queryKey: jiraKeys.bulkEdit(job.scopeKey, job.targets),
      });
    },
    onError: (_error, job, patches) => {
      if (jiraQueryScopeMatches(client, job.scope))
        rollbackBulkSearches(client, patches ?? []);
    },
    onSettled: () => {
      lock.current = false;
    },
  });
  const visibleResults = resultScope === scopeKey ? results : [];
  const failed = visibleResults.filter(({ error }) => error);
  const submit = (retry = false) => {
    if (lock.current || disabled || !scope) return;
    const previous = last.current;
    const sent =
      retry && previous?.scopeKey === scopeKey ? previous.action : action;
    const targets = retry ? failed.map(({ key }) => key) : [...keys];
    if (!sent || !targets.length || (retry && previous?.scopeKey !== scopeKey))
      return;
    lock.current = true;
    setResultScope(scopeKey);
    if (!retry) {
      setResults([]);
      setTotal(targets.length);
    } else setResults((current) => current.filter(({ error }) => !error));
    const display =
      retry && previous
        ? previous.display
        : sent.kind === "assignee"
          ? sent.accountId
            ? sent.accountId === myself.data?.accountId
              ? myself.data
              : assignee
            : null
          : sent.kind === "priority"
            ? options.priorities.find(({ id }) => id === sent.id)
            : undefined;
    last.current = { action: sent, keys: targets, scopeKey, display };
    mutation.mutate({ targets, action: sent, scope, scopeKey, display });
  };
  return {
    open,
    setOpen,
    operation,
    setOperation: (value: string) => {
      if (
        value === "self" ||
        value === "person" ||
        value === "unassigned" ||
        value === "priority" ||
        value === "status" ||
        value === "add-labels" ||
        value === "remove-labels"
      )
        setOperation(value);
    },
    priority,
    setPriority,
    status,
    setStatus,
    labelsText,
    setLabelsText,
    options,
    assignee,
    setAssignee: (value: JiraUserResult | JiraUserResult[] | null) => {
      if (!Array.isArray(value)) setAssignee(value);
    },
    userScope: { issueKey: keys[0], assignee: true },
    errors: failed,
    succeeded: visibleResults.length - failed.length,
    total: resultScope === scopeKey ? total : 0,
    failed: failed.length,
    pending: mutation.isPending,
    loading: metadata.isPending,
    error: metadata.error,
    canSubmit:
      !!action &&
      !!keys.length &&
      !disabled &&
      !mutation.isPending &&
      metadata.isSuccess,
    submit: () => submit(),
    retry: () => submit(true),
    reload: () => void metadata.refetch(),
  };
}
export type BulkEditState = ReturnType<typeof useBulkEdit>;
