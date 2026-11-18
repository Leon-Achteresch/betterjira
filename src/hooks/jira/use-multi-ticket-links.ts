import { useId, useRef, useState } from "react";
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Effect } from "effect";
import { useContextSession } from "@/hooks/use-context-session";
import { useLatestRef } from "@/hooks/use-latest-ref";
import { useJiraMyself, useJiraSite } from "@/lib/jira/queries";
import { jiraKeys } from "@/lib/jira/keys";
import { issueLinkKeys } from "@/lib/jira/issue-links";
import {
  fetchLinkTypes,
  issueLinkActionKeys,
} from "@/lib/jira/issue-link-actions";
import {
  jiraQueryScopeMatches,
  jiraRequestScope,
  withJiraQueryScope,
  type JiraQueryScope,
} from "@/lib/jira/query-scope";
import {
  applyMultiTicketLinks,
  InvalidMultiLink,
  linkChoiceIdentity,
  parseMultiLinkTargets,
  multiLinkChoices,
  previewMultiTicketLinks,
  type MultiLinkLedger,
  type MultiLinkPreview,
  type MultiLinkResult,
} from "@/lib/jira/multi-ticket-links";

type Draft = {
  context: string;
  token: symbol;
  open: boolean;
  input: string;
  choiceId: string;
  preview: { data: MultiLinkPreview; owner: unknown } | null;
  results: MultiLinkResult[];
  started: boolean;
  error: string | null;
};
const empty = (context: string): Draft => ({
  context,
  token: Symbol(),
  open: false,
  input: "",
  choiceId: "",
  preview: null,
  results: [],
  started: false,
  error: null,
});
type Job = {
  scope: JiraQueryScope;
  host: string;
  preview: MultiLinkPreview;
  token: symbol;
  ledgerKey: ReturnType<typeof jiraKeys.multiLinkLedger>;
  isCurrent: () => boolean;
  onResult: (row: MultiLinkResult) => void;
};
const labels = {
  confirmed: "Bestätigt",
  rejected: "Abgelehnt",
  uncertain: "Unklar",
  "not-started": "Nicht begonnen",
  sending: "Bestätigung offen",
} as const;

export function useMultiTicketLinks(source: string) {
  const client = useQueryClient();
  const site = useJiraSite();
  const myself = useJiraMyself();
  const scope =
    site.data?.cloudId.trim() && myself.data?.accountId.trim()
      ? { cloudId: site.data.cloudId, accountId: myself.data.accountId }
      : undefined;
  const host = site.data?.siteUrl ?? "";
  const context = JSON.stringify([scope, host, source]);
  const [state, setState] = useState(() => empty(context));
  const current = state.context === context ? state : empty(context);
  if (current !== state) setState(current);
  const latest = useLatestRef(current);
  const instance = useId();
  const lifetime = useContextSession(instance);
  const types = useQuery({
    queryKey: issueLinkActionKeys.types(JSON.stringify([scope, host])),
    enabled: !!scope && !!host && current.open,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: ({ signal }) =>
      Effect.runPromise(
        withJiraQueryScope(
          client,
          scope,
          fetchLinkTypes(
            scope ? { ...jiraRequestScope(client, scope), siteUrl: host } : undefined,
          ),
        ),
        { signal },
      ),
  });
  const choices = multiLinkChoices(types.data ?? []);
  const choice = choices.find((entry) => entry.id === current.choiceId);
  const selection = JSON.stringify([
    context,
    current.input,
    current.open,
    choice && linkChoiceIdentity(choice),
  ]);
  const session = useContextSession(selection);
  const lock = useRef(false);
  const stopped = useRef(false);
  const submitted = useRef(new WeakSet<MultiLinkPreview>());
  const [activity, setActivity] = useState<"preview" | "write" | null>(null);
  const mutationKey = jiraKeys.multiLinkWrite(scope);
  const writing = useIsMutating({ mutationKey }) > 0;
  const busy = () => lock.current || client.isMutating({ mutationKey }) > 0;
  const matches = () =>
    !!host &&
    session.isCurrent() &&
    latest.current.token === current.token &&
    jiraQueryScopeMatches(client, scope) &&
    client.getQueryData<typeof site.data>(jiraKeys.site)?.siteUrl === host;
  const isCurrent = () => matches() && !stopped.current;
  const ledgerKey = scope
    ? jiraKeys.multiLinkLedger(scope, host, source, choice?.id ?? "")
    : null;
  useQuery<MultiLinkLedger>({
    queryKey:
      ledgerKey ??
      jiraKeys.multiLinkLedger(
        { cloudId: "", accountId: "" },
        host,
        source,
        "",
      ),
    enabled: false,
    gcTime: Infinity,
    queryFn: () =>
      ledgerKey ? (client.getQueryData<MultiLinkLedger>(ledgerKey) ?? {}) : {},
  });
  const ledger = () =>
    ledgerKey ? (client.getQueryData<MultiLinkLedger>(ledgerKey) ?? {}) : {};
  const read = useQuery({
    queryKey: jiraKeys.multiLinkPreview(`${instance}:${selection}`, 0),
    enabled: false,
    retry: false,
    gcTime: 0,
    queryFn: ({ signal }) =>
      Effect.runPromise(
        scope && choice && isCurrent()
          ? withJiraQueryScope(
              client,
              scope,
              previewMultiTicketLinks(
                source,
                current.input,
                choice,
                { ...jiraRequestScope(client, scope), siteUrl: host, isCurrent },
                ledger(),
              ),
            )
          : Effect.fail(
              new InvalidMultiLink({
                message: "Auswahl oder Konto ist nicht mehr aktuell.",
              }),
            ),
        { signal },
      ),
  });
  const mutation = useMutation({
    mutationKey,
    retry: false,
    mutationFn: (job: Job) =>
      Effect.runPromise(
        applyMultiTicketLinks(
          job.preview,
          {
            ...jiraRequestScope(client, job.scope),
            siteUrl: job.host,
            isCurrent: job.isCurrent,
          },
          () => client.getQueryData<MultiLinkLedger>(job.ledgerKey) ?? {},
          (result) => {
            if (
              result.status === "confirmed" ||
              result.status === "uncertain" ||
              result.status === "sending"
            )
              client.setQueryData<MultiLinkLedger>(job.ledgerKey, (old) => ({
                ...old,
                [result.key]:
                  result.status === "confirmed" ? "confirmed" : "uncertain",
              }));
            if (result.status === "rejected")
              client.setQueryData<MultiLinkLedger>(job.ledgerKey, (old) => {
                const next = { ...old };
                delete next[result.key];
                return next;
              });
            job.onResult(result);
          },
        ),
      ),
    onSettled: (_data, _error, job) => {
      const refetchType =
        jiraQueryScopeMatches(client, job.scope) &&
        client.getQueryData<typeof site.data>(jiraKeys.site)?.siteUrl === job.host
          ? "active"
          : "none";
      for (const key of [
        job.preview.source.key,
        ...job.preview.rows.map((row) => row.key),
      ]) {
        void client.invalidateQueries({
          queryKey: issueLinkKeys.issue(
            job.scope.cloudId,
            job.scope.accountId,
            key,
          ),
          refetchType,
        });
        void client.invalidateQueries({
          queryKey: jiraKeys.issueDetail(key, job.scope),
          refetchType,
        });
      }
    },
  });
  const patch = (input: Partial<Draft>) => {
    const next = {
      ...current,
      ...input,
      token: Symbol(),
      preview: null,
      results: [],
      started: false,
      error: null,
    };
    latest.current = next;
    setState(next);
  };
  const parsed = parseMultiLinkTargets(source, current.input);
  const validPreview =
    current.preview?.owner === session.token ? current.preview.data : null;
  const pending = activity !== null || writing;
  const canPreview =
    current.open &&
    !!scope &&
    !!host &&
    !!choice &&
    types.isSuccess &&
    !parsed.error &&
    !pending;
  const requestPreview = async () => {
    if (!canPreview || busy() || !matches()) return;
    lock.current = true;
    stopped.current = false;
    setActivity("preview");
    setState((previous) => ({
      ...previous,
      preview: null,
      error: null,
      results: [],
      started: false,
    }));
    try {
      const result = await read.refetch({ cancelRefetch: false });
      if (!isCurrent()) return;
      setState((previous) =>
        previous.token !== current.token
          ? previous
          : {
              ...previous,
              preview: result.isSuccess
                ? {
                    data: { ...result.data, rows: [...result.data.rows] },
                    owner: session.token,
                  }
                : null,
              error: result.isSuccess
                ? null
                : result.error instanceof InvalidMultiLink
                  ? result.error.message
                  : "Vorschau konnte nicht frisch geprüft werden. Keine Abgabe erfolgt; Quelle, Typ und Berechtigungen prüfen.",
            },
      );
    } finally {
      lock.current = false;
      if (lifetime.isCurrent()) setActivity(null);
    }
  };
  const ready = validPreview?.rows.filter((row) => !row.reason).length ?? 0;
  const confirm = async () => {
    if (
      !scope ||
      !ledgerKey ||
      !validPreview ||
      !ready ||
      busy() ||
      !isCurrent() ||
      submitted.current.has(validPreview) ||
      latest.current.preview?.data !== validPreview
    )
      return;
    submitted.current.add(validPreview);
    lock.current = true;
    stopped.current = false;
    setActivity("write");
    setState((previous) => ({
      ...previous,
      results: [],
      started: true,
      error: null,
    }));
    try {
      await mutation.mutateAsync({
        scope,
        host,
        preview: validPreview,
        token: current.token,
        ledgerKey,
        isCurrent: () =>
          isCurrent() && latest.current.preview?.data === validPreview,
        onResult: (row) => {
          if (session.isCurrent() && latest.current.token === current.token)
            setState((previous) =>
              previous.token === current.token
                ? {
                    ...previous,
                    results: [
                      ...previous.results.filter((old) => old.key !== row.key),
                      row,
                    ],
                  }
                : previous,
            );
        },
      });
    } catch {
      if (session.isCurrent())
        setState((previous) =>
          previous.token !== current.token
            ? previous
            : {
                ...previous,
                error:
                  "Lauf unterbrochen. Offene Ausgänge in Jira prüfen; keine automatische Wiederholung.",
              },
        );
    } finally {
      lock.current = false;
      if (lifetime.isCurrent()) setActivity(null);
    }
  };
  const results =
    current.started && validPreview
      ? validPreview.rows.map(
          (row) =>
            current.results.find((result) => result.key === row.key) ?? {
              key: row.key,
              status: "not-started" as const,
              message: row.reason ?? "Noch nicht begonnen.",
            },
        )
      : [];
  const displayedResults = results.map((row) => ({
    ...row,
    label: labels[row.status],
  }));
  return {
    source,
    open: current.open,
    setOpen: (open: boolean) => {
      if (session.isCurrent() && latest.current.token === current.token) {
        stopped.current = true;
        patch({ open });
      }
    },
    input: current.input,
    setInput: (input: string) => {
      if (!busy() && matches()) patch({ input });
    },
    choiceId: current.choiceId,
    setChoice: (choiceId: string) => {
      if (!busy() && matches()) patch({ choiceId });
    },
    choices: choices.map((entry) => ({
      id: entry.id,
      label: `${entry.label} · ${entry.direction}`,
    })),
    metadataLoading: !!scope && !!host && types.isPending,
    noTypes: types.isSuccess && choices.length === 0,
    metadataError:
      !scope || !host
        ? "Jira-Konto oder Host konnte nicht bestätigt werden."
        : types.isError
          ? "Jira-Beziehungstypen konnten nicht geladen werden."
          : null,
    retryMetadata: () => {
      if (!scope || !host) {
        if (
          lifetime.isCurrent() &&
          session.isCurrent() &&
          latest.current.token === current.token
        ) {
          void site.refetch();
          void myself.refetch();
        }
        return;
      }
      if (matches() && !busy()) void types.refetch();
    },
    account: scope
      ? `${myself.data?.displayName ?? scope.accountId} · ${scope.accountId} · ${host || scope.cloudId}`
      : "Jira-Konto noch nicht bestätigt",
    inputError: current.input ? parsed.error : null,
    canPreview,
    requestPreview: () => void requestPreview(),
    checking: activity === "preview",
    writing: activity === "write",
    pending,
    preview: validPreview
      ? {
          ...validPreview,
          rows: validPreview.rows.map((row) => ({
            ...row,
            result: displayedResults.find((result) => result.key === row.key),
          })),
          directionLabel: `${validPreview.source.key} ${validPreview.choice.label} … (${validPreview.choice.direction})`,
          ready,
          total: validPreview.rows.length,
        }
      : null,
    canConfirm: !!validPreview && ready > 0 && !pending && !current.started,
    confirm: () => void confirm(),
    stop: () => {
      if (matches()) {
        stopped.current = true;
        setState((previous) => ({
          ...previous,
          error:
            "Weitere Abgaben gestoppt. Bereits abgegebene Anfragen können nicht zurückgerufen werden.",
        }));
      }
    },
    results: displayedResults,
    resultSummary: results.length
      ? Object.entries(labels)
          .map(
            ([status, label]) =>
              `${results.filter((row) => row.status === status).length} ${label}`,
          )
          .join(" · ")
      : null,
    error: current.error,
  };
}

export type MultiTicketLinksState = ReturnType<typeof useMultiTicketLinks>;
