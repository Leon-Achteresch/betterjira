import { useId, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { useContextSession } from "@/hooks/use-context-session";
import { useLatestRef } from "@/hooks/use-latest-ref";
import { acceptanceCriteria, type AcceptanceCriterion } from "@/lib/jira/acceptance-criteria";
import { JiraRequestScopeChanged } from "@/lib/jira/client";
import { criteriaTestReviewError, readCriteriaTestReview, testLinkCandidates, type TestLinkCandidate } from "@/lib/jira/criteria-test-review";
import type { IssueLinkSummary } from "@/lib/jira/issue-links";
import { jiraKeys } from "@/lib/jira/keys";
import { jiraQueryScopeMatches } from "@/lib/jira/query-scope";
import type { IssueLinkPreviewContext } from "./use-issue-link-preview";

type Issue = { key: string; id: string; revision: string; description: unknown };
type Selection = { line?: number; linkId?: string; request?: { id: number; criterion: AcceptanceCriterion; target: TestLinkCandidate } };

export function useCriteriaTestReview(
  issue: Issue,
  { source, scope, host }: IssueLinkPreviewContext,
  links?: IssueLinkSummary,
) {
  const client = useQueryClient();
  const instance = useId();
  const sequence = useRef(0);
  const criteria = useMemo(() => acceptanceCriteria(issue.description), [issue.description]);
  const candidates = useMemo(() => testLinkCandidates(source, links), [source, links]);
  const context = JSON.stringify([source, scope, host, issue.id, issue.revision, criteria, candidates]);
  const session = useContextSession(context);
  const [stored, setStored] = useState<{ token: typeof session.token; selection: Selection }>();
  const selection = stored?.token === session.token ? stored.selection : undefined;
  const criterion = criteria.rows.find(({ line }) => line === selection?.line);
  const target = candidates.find(({ reference }) => reference.id === selection?.linkId);
  const request = selection?.request;
  const latest = useLatestRef(request);
  const current = () => session.isCurrent() && jiraQueryScopeMatches(client, scope) &&
    client.getQueryData<{ siteUrl: string }>(jiraKeys.site)?.siteUrl === host;
  const available = !!scope && !!host && source === issue.key;
  const query = useQuery({
    queryKey: jiraKeys.criteriaTestReview(instance, request?.id),
    enabled: available && !!request,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: ({ signal }) => {
      if (!scope || !request || !available) throw new JiraRequestScopeChanged();
      return Effect.runPromise(readCriteriaTestReview(issue, request.criterion, request.target, scope.accountId, {
        cloudId: scope.cloudId,
        siteUrl: host,
        isCurrent: () => current() && latest.current === request,
      }), { signal });
    },
  });
  const choose = (choice: Selection) => setStored({ token: session.token, selection: choice });
  const loading = !!request && query.isPending;
  return {
    context,
    criteria,
    candidates,
    linkListRead: !!links,
    open: !!selection,
    setOpen: (open: boolean) => open ? choose({}) : setStored(undefined),
    criterion,
    target,
    selectCriterion: (value: string) => choose({ line: Number(value), linkId: selection?.linkId }),
    selectTarget: (value: string) => choose({ line: selection?.line, linkId: value }),
    available,
    loading,
    result: request ? query.data : undefined,
    error: request && query.isError ? criteriaTestReviewError(query.error) : null,
    ready: available && !!criterion && !!target && !loading,
    review: () => {
      if (available && criterion && target && !loading && current())
        choose({ line: criterion.line, linkId: target.reference.id, request: { id: ++sequence.current, criterion, target } });
    },
  };
}

export type CriteriaTestReviewState = ReturnType<typeof useCriteriaTestReview>;
