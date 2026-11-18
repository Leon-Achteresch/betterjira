import { useEffect, useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useLatestRef } from "../use-latest-ref";
import { creationHintRequest, creationHintRows, creationHintsQuery, CREATION_HINT_LIMITS, type HintProject } from "@/lib/jira/creation-hints";
import { jiraQueryScopeMatches, type JiraQueryScope } from "@/lib/jira/query-scope";

type Phase = "idle" | "running" | "done" | "error" | "cancelled";
export function useCreationHints(input: {
  project: HintProject | undefined; summary: string; context: string; revision: object;
  scope: JiraQueryScope | undefined; ready: boolean; accountLabel: string;
}) {
  const client = useQueryClient(); const navigate = useNavigate(); const owner = useId();
  const context = JSON.stringify([input.context, input.scope, input.project, input.summary, input.ready]);
  const [state, setState] = useState({ context, revision: input.revision, hintToken: Symbol(), generation: 0, phase: "idle" as Phase, open: false });
  const current = state.context === context && state.revision === input.revision ? state : { context, revision: input.revision, hintToken: Symbol(), generation: state.generation + 1, phase: "idle" as Phase, open: false };
  if (current !== state) setState(current);
  const latest = useLatestRef(current);
  const flight = useRef<{ token: symbol; cancelled: boolean } | null>(null);
  const request = creationHintRequest(input.project, input.summary);
  const options = creationHintsQuery(client, input.scope, request, owner, current.generation);
  const query = useQuery(options);
  const allowed = input.ready && !!request && jiraQueryScopeMatches(client, input.scope);
  const isCurrent = () => latest.current.hintToken === current.hintToken && input.ready && jiraQueryScopeMatches(client, input.scope);
  useEffect(() => () => {
    if (flight.current?.token === current.hintToken) flight.current.cancelled = true;
    void client.cancelQueries({ queryKey: options.queryKey, exact: true });
  }, [client, current.hintToken]);

  const start = async () => {
    if (!isCurrent() || !request || flight.current?.token === current.hintToken) return;
    const job = { token: current.hintToken, cancelled: false }; flight.current = job;
    setState((previous) => ({ ...previous, phase: "running", open: true }));
    try {
      const result = await query.refetch({ cancelRefetch: false });
      if (isCurrent() && !job.cancelled) setState((previous) => ({ ...previous, phase: result.isError ? "error" : result.isSuccess ? "done" : "cancelled" }));
    } catch {
      if (isCurrent() && !job.cancelled) setState((previous) => ({ ...previous, phase: "error" }));
    } finally { if (flight.current === job) flight.current = null; }
  };
  const stop = () => {
    if (!isCurrent() || flight.current?.token !== current.hintToken) return;
    flight.current.cancelled = true;
    setState((previous) => ({ ...previous, phase: "cancelled" }));
    void client.cancelQueries({ queryKey: options.queryKey, exact: true });
  };
  const page = allowed && current.phase === "done" ? query.data : undefined;
  const result = page && request ? creationHintRows(page, request.project) : undefined;
  return {
    open: current.open && allowed,
    setOpen: (open: boolean) => { if (open) void start(); else if (latest.current.hintToken === current.hintToken) { stop(); setState((previous) => ({ ...previous, open: false })); } },
    phase: allowed ? current.phase : "idle" as Phase,
    pending: allowed && current.phase === "running",
    canStart: allowed && current.phase !== "running" && !query.isFetching,
    start, stop, result, request,
    accountLabel: input.accountLabel,
    disabledReason: !input.ready ? "Bestätigtes Zielprojekt und verfügbare Erstellangaben erforderlich." : !request ? "Für die Suche braucht der Titel ein Wort mit 3–40 Buchstaben/Ziffern und höchstens 255 Zeichen insgesamt." : !allowed ? "Jira-Konto noch nicht bestätigt." : undefined,
    limits: CREATION_HINT_LIMITS,
    openIssue: (key: string) => { if (isCurrent() && latest.current.phase === "done" && latest.current.open && result?.rows.some((row) => row.key === key)) void navigate({ to: "/issue/$key", params: { key } }); },
  };
}
export type CreationHintsState = ReturnType<typeof useCreationHints>;
