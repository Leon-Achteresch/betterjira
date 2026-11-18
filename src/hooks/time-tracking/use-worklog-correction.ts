import { useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { useContextSession } from "@/hooks/use-context-session";
import { useLatestRef } from "@/hooks/use-latest-ref";
import { jiraRequestScope, withJiraQueryScope } from "@/lib/jira/query-scope";
import { timeTrackingKeys, type TimeTrackingScope } from "@/lib/time-tracking/keys";
import {
  exactWorklogTarget, previewWorklogCorrection, readWorklogCorrectionTarget, worklogCorrectionError,
  type WorklogCorrectionSource, type WorklogTarget,
} from "@/lib/time-tracking/worklog-correction";
import { formatSeconds } from "@/lib/time-tracking/presentation";

export type WorklogCorrectionContext = { scope: TimeTrackingScope & { siteUrl: string }; filter: string };

type Draft = {
  token: object;
  input: string;
  target?: { key: string; revision: number };
  preview?: { target: WorklogTarget; revision: number };
};

export function useWorklogCorrection(binding: WorklogCorrectionContext, source: WorklogCorrectionSource) {
  const { scope, filter } = binding;
  const context = JSON.stringify([scope.cloudId, scope.accountId, scope.siteUrl, scope.start, scope.end, filter,
    source.issueId, source.issueKey, source.worklog.id]);
  const session = useContextSession(context);
  const [stored, setDraft] = useState<Draft>(() => ({ token: session.token, input: "" }));
  const draft: Draft = stored.token === session.token ? stored : { token: session.token, input: "" };
  if (stored !== draft) setDraft(draft);
  const latest = useLatestRef(draft);
  const client = useQueryClient();
  const instance = useId();
  const revision = useRef(0);
  const accountScope = jiraRequestScope(client, scope);
  const current = () => session.isCurrent() && accountScope.isCurrent();
  const requestScope = (request: number) => ({
    ...accountScope, siteUrl: scope.siteUrl, isCurrent: () => current() && revision.current === request,
  });
  const enabled = scope.accountId === source.worklog.author?.accountId && current();
  const find = useQuery({
    queryKey: timeTrackingKeys.correction(instance, context, "target", draft.target?.revision),
    enabled: enabled && !!draft.target && !draft.preview,
    retry: false,
    gcTime: 0,
    staleTime: "static",
    queryFn: ({ signal }) => {
      if (!draft.target) throw new Error("Kein Ziel gewählt.");
      const pinned = requestScope(draft.target.revision);
      return Effect.runPromise(withJiraQueryScope(client, scope,
        readWorklogCorrectionTarget(draft.target.key, source, scope.accountId, pinned)), { signal });
    },
  });
  const check = useQuery({
    queryKey: timeTrackingKeys.correction(instance, context, "preview", draft.preview?.revision),
    enabled: enabled && !!draft.preview,
    retry: false,
    gcTime: 0,
    staleTime: "static",
    queryFn: ({ signal }) => {
      if (!draft.preview) throw new Error("Kein Ziel bestätigt.");
      const pinned = requestScope(draft.preview.revision);
      return Effect.runPromise(withJiraQueryScope(client, scope,
        previewWorklogCorrection(source, draft.preview.target, scope.accountId, pinned)), { signal });
    },
  });
  const normalized = exactWorklogTarget(draft.input);
  const target = enabled ? draft.preview?.target ?? (draft.target ? find.data : undefined) : undefined;
  const result = enabled && draft.preview ? check.data : undefined;
  const error = draft.preview ? check.error : find.error;

  return {
    input: draft.input,
    target: check.isError ? undefined : target,
    preview: result && { ...result, duration: formatSeconds(result.seconds) },
    error: enabled && error ? worklogCorrectionError(error) : undefined,
    finding: !!draft.target && !draft.preview && find.isFetching,
    checking: !!draft.preview && check.isFetching,
    canFind: enabled && !!normalized && !(draft.target && find.isFetching && !draft.preview),
    canConfirm: !!target && !draft.preview,
    setInput: (input: string) => {
      if (!current() || latest.current !== draft || input === draft.input) return;
      revision.current++;
      setDraft({ token: session.token, input });
    },
    findTarget: () => {
      if (!enabled || !normalized || !current() || latest.current !== draft) return;
      setDraft({ token: session.token, input: draft.input, target: { key: normalized, revision: ++revision.current } });
    },
    confirmTarget: () => {
      if (!target || draft.preview || !enabled || !current() || latest.current !== draft || draft.target?.revision !== revision.current) return;
      setDraft({ token: session.token, input: draft.input, preview: { target, revision: ++revision.current } });
    },
  };
}
