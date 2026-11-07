import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { queryOf } from "@/lib/search/search-params";
import type { Rollout } from "./model";

export type KalenderSearch = { q?: string };

export type RolloutSearchStatus = "idle" | "pending" | "error" | "ready";

export const ROLLOUT_SEARCH_LIMIT = 8;

export const parseKalenderSearch = (raw: Record<string, unknown>): KalenderSearch => ({ q: queryOf(raw.q) });

const LOCALE = "de-DE";

export const searchTerms = (query: string) => query.toLocaleLowerCase(LOCALE).split(/\s+/).filter(Boolean);

const haystack = (rollout: Rollout) =>
  [rollout.title, rollout.notes, ...rollout.issues.map((issue) => issue.key)].join("\n").toLocaleLowerCase(LOCALE);

export const searchRollouts = (rollouts: readonly Rollout[], query: string) => {
  const terms = searchTerms(query);
  if (terms.length === 0) return [];
  return rollouts
    .filter((rollout) => {
      const text = haystack(rollout);
      return terms.every((term) => text.includes(term));
    })
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
};

export const rolloutSearchStatus = ({ query, pending, loaded }: { query: string; pending: boolean; loaded: boolean }): RolloutSearchStatus =>
  searchTerms(query).length === 0 ? "idle" : pending ? "pending" : loaded ? "ready" : "error";

export const resultDate = (iso: string) => format(parseISO(iso), "EEE, d. MMM yyyy", { locale: de });
