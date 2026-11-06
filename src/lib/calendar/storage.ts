import { Data, Effect, Schema } from "effect";
import { Rollouts } from "./model";
import type { Rollout } from "./model";
import { ROLLOUT_ID, validateRolloutDraft } from "./validation";

export class CalendarError extends Data.TaggedError("CalendarError")<{ message: string; cause?: unknown }> {}

export const ROLLOUT_STORAGE_KEY = "betterjira:calendar:rollouts:v1";
export const OUTLOOK_STORAGE_KEY = "betterjira:calendar:outlook:v1";

export const calendarError = (message: string) => (cause: unknown) =>
  new CalendarError({ message: typeof cause === "string" ? cause : message, cause });

export const readRollouts = () => {
  const raw = localStorage.getItem(ROLLOUT_STORAGE_KEY);
  if (raw === null) return [];
  const rows = Schema.decodeUnknownSync(Rollouts)(JSON.parse(raw));
  if (rows.some((row) => !ROLLOUT_ID.test(row.id) || validateRolloutDraft(row))) throw new Error("Ungültige Rollout-Daten");
  if (new Set(rows.map((row) => row.id)).size !== rows.length) throw new Error("Doppelte Rollout-IDs");
  return rows;
};

export const loadRollouts = Effect.try({
  try: readRollouts,
  catch: calendarError("Die gespeicherten Rollouts konnten nicht gelesen werden. Die Daten wurden nicht überschrieben."),
});

export const writeRollouts = (rollouts: readonly Rollout[]) => Effect.try({
  try: () => localStorage.setItem(ROLLOUT_STORAGE_KEY, JSON.stringify(rollouts)),
  catch: calendarError("Die Rollouts konnten nicht gespeichert werden. Bitte den verfügbaren Speicher prüfen."),
});

export const readOutlookAccountId = () => localStorage.getItem(OUTLOOK_STORAGE_KEY);

export const setOutlookAccountId = (id: string | null) => Effect.try({
  try: () => id === null ? localStorage.removeItem(OUTLOOK_STORAGE_KEY) : localStorage.setItem(OUTLOOK_STORAGE_KEY, id),
  catch: calendarError("Die Outlook-Verbindung konnte nicht gespeichert werden."),
});
