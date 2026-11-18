import { useId, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { useContextSession } from "@/hooks/use-context-session";
import { useSubmissionLock } from "@/hooks/use-submission-lock";
import {
  applyBulkCompletion, BULK_TRANSITION_COMMENT_LIMIT, completionStatuses, readBulkCompletion, reviewBulkCompletion,
  validBulkTransitionTargets, type BulkTransitionResult, type BulkTransitionRow, type BulkTransitionTarget,
} from "@/lib/jira/bulk-transition-comment";
import { bulkTransitionCommentAllowed } from "@/lib/jira/bulk-transition-comment-capability";
import { jiraKeys } from "@/lib/jira/keys";
import { invalidateIssueChange } from "@/lib/jira/mutation-cache";
import { jiraRequestScope, withJiraQueryScope, type JiraQueryScope } from "@/lib/jira/query-scope";

const blank = (token: object) => ({
  token, revision: undefined as number | undefined, statusId: "", comment: "", approved: false, submitted: false,
});

export function useBulkTransitionComment(input: {
  active: boolean;
  context: string;
  scope: JiraQueryScope | undefined;
  siteUrl: string | undefined;
  targets: readonly BulkTransitionTarget[];
}) {
  const { active, scope, siteUrl, targets } = input;
  const context = JSON.stringify([active, input.context, scope, siteUrl, targets.map(({ key, id }) => [key, id])]);
  const session = useContextSession(context);
  const [stored, setDraft] = useState(() => blank(session.token));
  const draft = stored.token === session.token ? stored : blank(session.token);
  if (stored !== draft) setDraft(draft);
  const instance = useId();
  const revision = useRef(0);
  const client = useQueryClient();
  const lock = useSubmissionLock();
  const [results, setResults] = useState<{ token: object; revision: number; rows: BulkTransitionResult[] }>();
  const ready = active && !!scope && !!siteUrl && validBulkTransitionTargets(targets);
  const accountScope = scope && jiraRequestScope(client, scope);
  const requestScope = accountScope && siteUrl ? {
    ...accountScope,
    siteUrl,
    isCurrent: () => session.isCurrent() && accountScope.isCurrent(),
  } : undefined;
  const current = () => ready && requestScope?.isCurrent();
  const query = useQuery({
    queryKey: jiraKeys.bulkCompletionPreview(context, instance, draft.revision),
    enabled: ready && draft.revision !== undefined,
    gcTime: 0,
    staleTime: "static",
    retry: false,
    queryFn: ({ signal }) => {
      if (!scope || !requestScope) throw new Error("Kein Jira-Kontext verfügbar.");
      return Effect.runPromise(withJiraQueryScope(client, scope, readBulkCompletion(targets, requestScope)), { signal });
    },
  });
  const mutation = useMutation({
    mutationKey: jiraKeys.bulkCompletionWrite(scope),
    retry: false,
    mutationFn: (job: { revision: number; rows: readonly BulkTransitionRow[]; statusId: string; comment: string }) => {
      if (!scope || !siteUrl || !requestScope) return Promise.resolve();
      return Effect.runPromise(applyBulkCompletion(job.rows, job.statusId, job.comment, scope, siteUrl, requestScope, (result) => {
        if (!requestScope.isCurrent()) return;
        setResults((previous) => previous?.token === session.token && previous.revision === job.revision
          ? { ...previous, rows: [...previous.rows, result] } : previous);
        if (result.status === "changed") invalidateIssueChange(client, result.key, true);
      }));
    },
    onSettled: () => lock.release("apply"),
  });
  const tickets = current() ? query.data : undefined;
  const statuses = completionStatuses(tickets ?? []);
  const rows = tickets ? reviewBulkCompletion(tickets, draft.statusId) : [];
  const eligible = rows.filter((row) => row.eligible).length;
  const fixtureApply = !!scope && !!siteUrl && bulkTransitionCommentAllowed(scope, siteUrl);
  const canReview = fixtureApply && eligible > 0 && !!draft.comment.trim() && !draft.submitted && !mutation.isPending;
  const canApply = canReview && draft.approved && draft.revision !== undefined;
  const edit = (value: Partial<Pick<typeof draft, "comment" | "statusId" | "approved">>) => {
    if (!current() || draft.submitted || mutation.isPending) return;
    setDraft((previous) => previous.token === session.token && !previous.submitted ? { ...previous, ...value } : previous);
  };
  return {
    active: ready,
    targets,
    statuses,
    rows,
    readyToCheck: ready && !query.isFetching && !mutation.isPending,
    checked: !!tickets,
    pending: ready && draft.revision !== undefined && query.isPending,
    readError: ready && query.isError,
    applying: mutation.isPending,
    applyError: !!current() && draft.submitted && mutation.isError,
    fixtureApply,
    canReview,
    canApply,
    submitted: draft.submitted,
    statusId: draft.statusId,
    comment: draft.comment,
    approved: draft.approved,
    eligible,
    results: current() && results?.token === session.token && results.revision === draft.revision ? results.rows : [],
    requestPreview: () => {
      if (!current() || query.isFetching || mutation.isPending) return;
      const nextRevision = ++revision.current;
      setDraft((previous) => ({ ...previous, revision: nextRevision, statusId: "", approved: false, submitted: false }));
    },
    setStatusId: (statusId: string) => {
      if (statuses.some(({ id }) => id === statusId)) edit({ statusId, approved: false });
    },
    setComment: (comment: string) => {
      if (comment.length <= BULK_TRANSITION_COMMENT_LIMIT) edit({ comment, approved: false });
    },
    setApproved: (approved: boolean) => {
      if (canReview) edit({ approved });
    },
    apply: () => {
      if (!current() || !canApply || draft.revision === undefined || !lock.acquire("apply")) return;
      setDraft((previous) => ({ ...previous, approved: false, submitted: true }));
      setResults({ token: session.token, revision: draft.revision, rows: [] });
      mutation.mutate({ revision: draft.revision, rows, statusId: draft.statusId, comment: draft.comment });
    },
  };
}

export type BulkTransitionCommentState = ReturnType<typeof useBulkTransitionComment>;
