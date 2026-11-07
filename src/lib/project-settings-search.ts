import { normalizeQuery } from "@/lib/search/search-params";

export type ProjectSettingsSearch = { q?: string };

const textOf = (value: unknown) =>
  typeof value === "string" ? value : typeof value === "number" && Number.isFinite(value) ? String(value) : "";

export const parseProjectSettingsSearch = ({ q }: Record<string, unknown>): ProjectSettingsSearch => ({
  q: normalizeQuery(textOf(q)) || undefined,
});

export const projectMatchLabel = (shown: number, total: number) =>
  shown === total ? `${total} ${total === 1 ? "Bereich" : "Bereiche"}` : `${shown} von ${total} ${total === 1 ? "Bereich" : "Bereichen"}`;
