import { Effect, Schema, Semaphore } from "effect";
import { openExternalLink } from "../external-links/client";
import { RolloutDraft } from "./model";
import { getOutlookAccount, removeOutlookEvent, upsertOutlookEvent } from "./outlook";
import { CalendarError, calendarError, loadRollouts, setOutlookAccountId, writeRollouts } from "./storage";
import { normalizeRolloutDraft, validateRolloutDraft } from "./validation";

export { loadRollouts } from "./storage";
export { currentOutlookAccount, listOutlookEvents, openOutlookEvent } from "./outlook";

const writeLock = Semaphore.makeUnsafe(1);

export const saveRollout = (input: RolloutDraft, id?: string) => Effect.gen(function* () {
  const draft = yield* Schema.decodeUnknownEffect(RolloutDraft)(input).pipe(Effect.mapError(calendarError("Ungültiger Rollout.")));
  const validation = validateRolloutDraft(draft);
  if (validation) return yield* new CalendarError({ message: validation });
  const rows = yield* loadRollouts;
  const previous = id ? rows.find((row) => row.id === id) : undefined;
  if (id && !previous) return yield* new CalendarError({ message: "Dieser Rollout wurde bereits gelöscht. Bitte den Kalender aktualisieren." });
  const row = {
    id: previous?.id ?? crypto.randomUUID(),
    ...normalizeRolloutDraft(draft),
    outlookEventId: previous?.outlookEventId ?? null,
    outlookAccountId: previous?.outlookAccountId ?? null,
    outlookWebLink: previous?.outlookWebLink ?? null,
  };
  yield* writeRollouts(previous ? rows.map((existing) => existing.id === id ? row : existing) : [...rows, row]);
  return row;
}).pipe(writeLock.withPermits(1));

export const deleteRollout = (id: string) => Effect.gen(function* () {
  const rows = yield* loadRollouts;
  const row = rows.find((existing) => existing.id === id);
  if (!row) return;
  if (row.outlookEventId) yield* removeOutlookEvent(row);
  yield* writeRollouts(rows.filter((existing) => existing.id !== id));
}).pipe(writeLock.withPermits(1));

export const syncRolloutToOutlook = (id: string) => Effect.gen(function* () {
  const rows = yield* loadRollouts;
  const row = rows.find((existing) => existing.id === id);
  if (!row) return yield* new CalendarError({ message: "Dieser Rollout wurde bereits gelöscht." });
  const saved = yield* upsertOutlookEvent(row);
  const next = { ...row, outlookEventId: saved.id, outlookAccountId: saved.accountId, outlookWebLink: null };
  yield* writeRollouts(rows.map((existing) => existing.id === id ? next : existing));
  return next;
}).pipe(writeLock.withPermits(1));

export const connectOutlook = () => Effect.gen(function* () {
  const account = yield* getOutlookAccount();
  yield* setOutlookAccountId(account.id);
  return account;
}).pipe(writeLock.withPermits(1));

export const disconnectOutlook = setOutlookAccountId(null).pipe(writeLock.withPermits(1));

export const openCalendarIssue = (url: string) =>
  openExternalLink(url).pipe(Effect.mapError(calendarError("Das verknüpfte Ticket konnte nicht geöffnet werden.")));
