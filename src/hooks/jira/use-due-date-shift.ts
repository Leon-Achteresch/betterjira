import { useEffect, useRef, useState } from "react";
import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { useJiraMyself, useJiraSite } from "./use-jira";
import { useLatestRef } from "../use-latest-ref";
import { parseDayOffset } from "@/lib/calendar-date-shift";
import { applyDueDateShift, previewDueDateShift, DueDateShiftInvalid, type DueDateShiftPreview, type DueDateShiftResult } from "@/lib/jira/due-date-shift";
import { jiraKeys } from "@/lib/jira/keys";
import { jiraQueryScopeMatches, jiraRequestScope, withJiraQueryScope, type JiraQueryScope } from "@/lib/jira/query-scope";
import { invalidateIssueChange } from "@/lib/jira/mutation-cache";

type ShiftDraft = { context: string; token: symbol; input: string; preview: DueDateShiftPreview | null; results: readonly DueDateShiftResult[]; error: string | null };
type ShiftJob = { preview: DueDateShiftPreview; scope: JiraQueryScope; token: symbol; isCurrent: () => boolean };
const emptyDraft = (context: string): ShiftDraft => ({ context, token: Symbol(), input: "", preview: null, results: [], error: null });
const RESULT_LABELS = { changed: "Geändert", skipped: "Nicht gesendet", failed: "Abgelehnt", uncertain: "Ergebnis unklar" } as const;
const dateLabel = (value: string | null | undefined) => value === undefined ? "Nicht gelesen" : value === null || value === "" ? "Ohne Fälligkeit" : value;

export function useDueDateShift(keys: readonly string[], disabled: boolean, enabled: boolean, selectionContext: string) {
  const client = useQueryClient();
  const site = useJiraSite();
  const myself = useJiraMyself();
  const scope = site.isSuccess && site.data && myself.isSuccess && myself.data ? { cloudId: site.data.cloudId, accountId: myself.data.accountId } : undefined;
  const targets = [...new Set(keys)].sort();
  const context = JSON.stringify([scope, selectionContext, targets, enabled, disabled]);
  const [state, setState] = useState(() => emptyDraft(context));
  const [activity, setActivity] = useState<{ token: symbol; kind: "preview" | "write" } | null>(null);
  const current = state.context === context ? state : emptyDraft(context);
  if (current !== state) setState(current);
  const latest = useLatestRef(current);
  const mounted = useRef(true);
  const lock = useRef(false);
  const stopping = useRef(false);
  const submitted = useRef<DueDateShiftPreview | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; stopping.current = true; };
  }, []);
  const isCurrent = () => mounted.current && latest.current.token === current.token && !stopping.current;
  const days = parseDayOffset(current.input);
  const mutationKey = jiraKeys.dueDateShiftWrite(scope);
  const writing = useIsMutating({ mutationKey }) > 0;
  const read = useQuery({
    queryKey: jiraKeys.dueDateShiftPreview(context, days),
    enabled: false,
    retry: false,
    queryFn: ({ signal }) => Effect.runPromise(scope && days !== null
      ? withJiraQueryScope(client, scope, previewDueDateShift(targets, days, { ...jiraRequestScope(client, scope), isCurrent: () => jiraQueryScopeMatches(client, scope) && isCurrent() }))
      : Effect.fail(new DueDateShiftInvalid()), { signal }),
  });
  const mutation = useMutation({
    mutationKey,
    retry: false,
    mutationFn: (job: ShiftJob) => Effect.runPromise(applyDueDateShift(job.preview,
      { ...jiraRequestScope(client, job.scope), isCurrent: () => jiraQueryScopeMatches(client, job.scope) && job.isCurrent() },
      (result) => {
        if (mounted.current) setState((previous) => previous.token === job.token && previous.preview === job.preview ? { ...previous, results: [...previous.results, result] } : previous);
      })),
    onSettled: (_results, _error, job) => {
      if (!jiraQueryScopeMatches(client, job.scope)) {
        for (const row of job.preview.rows) void client.invalidateQueries({ queryKey: jiraKeys.issueDetail(row.key, job.scope), exact: true, refetchType: "none" });
        return;
      }
      for (const row of job.preview.rows) invalidateIssueChange(client, row.key, true);
      void client.invalidateQueries({ queryKey: jiraKeys.allIssues });
    },
  });
  const busy = () => lock.current || client.isMutating({ mutationKey }) > 0;
  const pending = activity !== null || read.isFetching || writing;
  const waitingPrevious = activity !== null && activity.token !== current.token;
  const preview = current.preview;
  const readyCount = preview?.rows.filter((row) => !row.reason && row.after).length ?? 0;
  const canPreview = enabled && !disabled && !!scope && targets.length > 0 && days !== null && !pending;
  const requestPreview = async () => {
    if (!canPreview || busy() || latest.current.token !== current.token) return;
    lock.current = true;
    setActivity({ token: current.token, kind: "preview" });
    stopping.current = false;
    setState((previous) => ({ ...previous, preview: null, error: null }));
    try {
      const result = await read.refetch({ cancelRefetch: false });
      if (!isCurrent()) return;
      setState((previous) => previous.token === current.token ? { ...previous, preview: result.isSuccess ? { days: result.data.days, rows: [...result.data.rows] } : null, error: result.isSuccess ? null : "Vorschau konnte nicht frisch geprüft werden. Keine Änderung gesendet." } : previous);
    } finally { lock.current = false; if (mounted.current) setActivity(null); }
  };
  const confirm = async () => {
    if (!scope || !preview || submitted.current === preview || !readyCount || !enabled || disabled || busy() || !isCurrent() || latest.current.preview !== preview) return;
    submitted.current = preview;
    lock.current = true;
    setActivity({ token: current.token, kind: "write" });
    stopping.current = false;
    setState((previous) => ({ ...previous, results: [], error: null }));
    try {
      await mutation.mutateAsync({ preview, scope, token: current.token, isCurrent: () => isCurrent() && latest.current.preview === preview });
    } catch {
      if (mounted.current) setState((previous) => previous.token === current.token ? { ...previous, error: "Prüfung fehlgeschlagen. Keine weitere Änderung gestartet; bitte Serverstand neu prüfen." } : previous);
    } finally {
      lock.current = false;
      if (mounted.current) setActivity(null);
      if (mounted.current) setState((previous) => previous.token === current.token ? { ...previous, preview: null } : previous);
    }
  };
  return {
    input: current.input,
    setInput: (input: string) => { if (!busy() && latest.current.token === current.token) setState((previous) => ({ ...previous, token: Symbol(), input, preview: null, error: null })); },
    inputError: current.input && days === null ? "Ganze Anzahl Tage ungleich 0 eingeben, z. B. 7 oder -3." : undefined,
    accountLabel: scope ? `${myself.data?.displayName ?? scope.accountId} · ${site.data?.siteName ?? scope.cloudId}` : "Jira-Konto noch nicht bestätigt",
    pending,
    checking: !waitingPrevious && (activity?.kind === "preview" || read.isFetching),
    writing: !waitingPrevious && (activity?.kind === "write" || writing),
    waitingPrevious,
    isBusy: busy,
    canPreview,
    requestPreview: () => void requestPreview(),
    preview: preview ? { days: preview.days > 0 ? `+${preview.days}` : String(preview.days), rows: preview.rows.map((row) => ({ ...row, beforeLabel: dateLabel(row.before), afterLabel: row.after ?? "–" })), readyCount } : null,
    canConfirm: !!scope && enabled && !disabled && !!preview && readyCount > 0 && !pending,
    confirm: () => void confirm(),
    stop: () => { stopping.current = true; },
    results: current.results.map((result) => ({ ...result, label: RESULT_LABELS[result.status], beforeLabel: dateLabel(result.row.before), afterLabel: result.row.after ?? "–" })),
    error: current.error,
  };
}

export type DueDateShiftState = ReturnType<typeof useDueDateShift>;
