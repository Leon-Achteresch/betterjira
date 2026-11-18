import { useLayoutEffect, useRef, useState } from "react";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { jiraKeys } from "@/lib/jira/keys";
import { invalidateIssueChange } from "@/lib/jira/mutation-cache";
import { jiraQueryScopeMatches, jiraRequestScope } from "@/lib/jira/query-scope";
import { applyApprovedTableFields, type TableFieldApproval } from "@/lib/jira/table-field-apply";
import { tableFieldApplyAllowed } from "@/lib/jira/table-field-apply-capability";
import type { TableFieldPreview } from "@/lib/jira/table-field-preview";
import type { TableFieldPreviewContext } from "./use-table-field-preview";

export function useTableFieldApply({ scope, siteUrl, targets }: TableFieldPreviewContext, preview: TableFieldPreview | undefined) {
  const client = useQueryClient();
  const key = jiraKeys.tableFieldApply(scope);
  const busy = useIsMutating({ mutationKey: key }) > 0;
  const [reviewed, setReviewed] = useState<TableFieldPreview>();
  const used = useRef<TableFieldPreview>(undefined);
  const active = useRef<{ stopped: boolean }>(undefined);
  const mounted = useRef(false);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (active.current) active.current.stopped = true;
    };
  }, []);
  const mutation = useMutation({
    mutationKey: key,
    retry: false,
    networkMode: "always",
    mutationFn: ({ approval, run }: { approval: TableFieldApproval; run: { stopped: boolean } }) => {
      const request = jiraRequestScope(client, approval.scope);
      return Effect.runPromise(applyApprovedTableFields(approval, {
        ...request,
        isCurrent: () => mounted.current && !run.stopped && request.isCurrent(),
      }));
    },
    onSuccess: (results, { approval }) => {
      const sameScope = jiraQueryScopeMatches(client, approval.scope);
      for (const { row, status } of results) {
        if (status !== "applied" && status !== "uncertain") continue;
        if (sameScope) invalidateIssueChange(client, row.key, true);
        else void client.invalidateQueries({ queryKey: jiraKeys.issueDetail(row.key, approval.scope), exact: true, refetchType: "none" });
      }
    },
  });
  const allowed = tableFieldApplyAllowed(scope, siteUrl);
  const hasChanges = preview?.rows.some(({ status }) => status === "change") ?? false;
  const canReview = allowed && hasChanges && !busy && used.current !== preview;
  const confirmed = !!preview && reviewed === preview;
  const currentResult = !!preview && mutation.variables?.approval.preview === preview;
  return {
    available: canReview,
    confirmed,
    busy,
    running: mutation.isPending,
    error: currentResult && mutation.isError,
    results: currentResult ? mutation.data : undefined,
    review: (checked: boolean) => setReviewed(checked && canReview ? preview : undefined),
    confirm: () => {
      if (!preview || !confirmed || !canReview || used.current === preview || !mounted.current
        || client.isMutating({ mutationKey: key }) || !jiraQueryScopeMatches(client, scope)) return;
      const run = { stopped: false };
      active.current = run;
      used.current = preview;
      mutation.mutate({ approval: { scope, siteUrl, targets, preview }, run });
    },
    stop: () => { if (active.current) active.current.stopped = true; },
  };
}
