import { useEffect, useRef, useState } from "react";
import { useIsFetching, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLatestRef } from "../use-latest-ref";
import type { useIssueSearch } from "./use-issue-search";
import { jiraKeys } from "@/lib/jira/keys";
import { jiraQueryScopeMatches } from "@/lib/jira/query-scope";
import { loadRemainingSearch, searchContinuation, searchLoadProgress, SEARCH_LOAD_MAX_ENTRIES, SEARCH_LOAD_MAX_PAGES, type SearchData, type SearchLoadProgress, type SearchLoadResult } from "@/lib/jira/search-loading";
import { PAGE_SIZE } from "@/lib/jira/search";

const MESSAGES = {
  end: "Jira liefert keine nächste Seite. Der Bestand kann sich während des Ladens geändert haben.",
  limit: "Ladelimit erreicht. Die geladenen Treffer sind ein Teilstand.",
  cancelled: "Abgebrochen. Bereits geladene Treffer bleiben verfügbar.",
  error: "Weitere Treffer konnten nicht geladen werden, etwa wegen fehlender Berechtigung oder Verbindung. Die bisherigen Treffer bleiben verfügbar.",
  changed: "Suchdaten wurden zwischenzeitlich geändert. Lauf beendet; bitte den aktuellen Stand prüfen.",
  cursor: "Jira liefert keine verwendbare Fortsetzung. Das ist kein bestätigtes vollständiges Ergebnis.",
};
type State = { context: string; token: symbol; progress: SearchLoadProgress; result: SearchLoadResult | null };

export function useSearchLoad(search: ReturnType<typeof useIssueSearch>, viewContext: string, ready: boolean) {
  const context = JSON.stringify([viewContext, search.queryKey]);
  const client = useQueryClient();
  const fresh = (): State => ({ context, token: Symbol(), progress: searchLoadProgress(search.data, 0), result: null });
  const [state, setState] = useState(fresh);
  const current = state.context === context ? state : fresh();
  if (current !== state) setState(current);
  const latest = useLatestRef(current);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const [active, setActive] = useState(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
  useEffect(() => () => controller.current?.abort(), [context]);
  const queryKey = search.queryKey;
  const jobKey = jiraKeys.searchLoad(queryKey);
  const sharedPending = useIsFetching({ queryKey: jobKey, exact: true }) > 0;
  const isCurrent = () => mounted.current && latest.current.token === current.token && jiraQueryScopeMatches(client, search.scope);
  const job = useQuery({
    queryKey: jobKey, enabled: false, retry: false, gcTime: 0,
    queryFn: async ({ signal }) => {
      const own = controller.current;
      if (!own) throw new Error("Kein bestätigter Ladelauf");
      const abort = () => own.abort();
      signal.addEventListener("abort", abort, { once: true });
      let waiting = false;
      const cancelPage = () => { if (waiting) void client.cancelQueries({ queryKey, exact: true }); };
      own.signal.addEventListener("abort", cancelPage, { once: true });
      try {
        return await loadRemainingSearch({
          read: () => client.getQueryData<SearchData>(queryKey), signal: own.signal, isCurrent, pageSize: PAGE_SIZE,
          next: async () => { waiting = true; try { await search.fetchNextPage({ cancelRefetch: false, throwOnError: true }); } finally { waiting = false; } },
          onProgress: (progress) => { if (mounted.current) setState((previous) => previous.token === current.token ? { ...previous, progress } : previous); },
        });
      } finally { signal.removeEventListener("abort", abort); own.signal.removeEventListener("abort", cancelPage); }
    },
  });
  const busy = () => !!controller.current || client.isFetching({ queryKey: jobKey, exact: true }) > 0;
  const pending = active || sharedPending;
  const rawCount = search.data?.pages.reduce((sum, page) => sum + page.issues.length, 0) ?? 0;
  const limitReached = rawCount + PAGE_SIZE > SEARCH_LOAD_MAX_ENTRIES;
  const continuation = search.data && searchContinuation(search.data);
  const canStart = ready && !!search.scope && continuation?.kind === "more" && !search.isFetching && !pending && !limitReached;
  const start = async () => {
    if (!canStart || busy() || !isCurrent()) return;
    const own = new AbortController();
    controller.current = own;
    setActive(true);
    setState((previous) => ({ ...previous, progress: searchLoadProgress(search.data, 0), result: null }));
    try {
      const result = await job.refetch({ cancelRefetch: false });
      if (isCurrent()) setState((previous) => previous.token === current.token ? { ...previous, result: result.isSuccess ? result.data : { ...previous.progress, reason: "error" } } : previous);
    } finally {
      if (controller.current === own) controller.current = null;
      if (mounted.current) setActive(false);
    }
  };
  const result = current.result;
  const progress = pending ? current.progress : searchLoadProgress(search.data, result?.pages ?? 0);
  return {
    pending, canStart, isBusy: busy,
    visible: ready && !!search.data && (continuation?.kind !== "end" || !!result || pending),
    start: () => void start(), stop: () => controller.current?.abort(),
    loaded: progress.loaded, pages: progress.pages, duplicates: progress.duplicates,
    message: pending ? "Weitere Seiten werden geladen …" : result ? MESSAGES[result.reason] : continuation?.kind === "cursor" ? MESSAGES.cursor : limitReached ? MESSAGES.limit : undefined,
    limits: `Maximal ${SEARCH_LOAD_MAX_ENTRIES} geladene Einträge und ${SEARCH_LOAD_MAX_PAGES} weitere Seiten pro Lauf.`,
  };
}
export type SearchLoadState = ReturnType<typeof useSearchLoad>;
