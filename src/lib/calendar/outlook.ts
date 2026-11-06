import { invoke } from "@tauri-apps/api/core";
import { Effect, Schema } from "effect";
import { OutlookAccount, OutlookCalendarEvent } from "./model";
import type { Rollout } from "./model";
import { CalendarError, calendarError, readOutlookAccountId } from "./storage";
import { isInstant, rolloutBody } from "./validation";

const OutlookSavedEvent = Schema.Struct({ id: Schema.String, accountId: Schema.String });

const outlookError = (cause: unknown) => {
  const detail = typeof cause === "string" ? cause : cause instanceof Error ? cause.message : "";
  return new CalendarError({
    message: detail.includes("AADSTS50020")
      ? "Outlook meldet dein Konto bei einer anderen Organisation an (AADSTS50020). Bitte den Microsoft-Dialog schließen und Konto sowie Organisation direkt im klassischen Outlook prüfen. betterjira benötigt keine Entra-App-ID."
      : detail || "Outlook ist nicht erreichbar. Bitte klassisches Outlook unter Windows öffnen und dort den gewünschten Kalender prüfen.",
    cause,
  });
};

const request = <S extends Schema.Decoder<unknown>>(schema: S, payload: Record<string, unknown>) =>
  Effect.tryPromise({
    try: () => invoke<unknown>("outlook_request", { request: payload }),
    catch: outlookError,
  }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(schema)),
    Effect.mapError((cause) => cause instanceof CalendarError ? cause : calendarError("Outlook hat ungültige Daten geliefert.")(cause)),
  );

export const getOutlookAccount = () => request(OutlookAccount, { action: "account" });

const connectedAccountId = Effect.try({
  try: readOutlookAccountId,
  catch: calendarError("Die Outlook-Verbindung konnte nicht gelesen werden."),
}).pipe(Effect.flatMap((id) => id ? Effect.succeed(id) : Effect.fail(new CalendarError({ message: "Bitte zuerst Outlook verbinden." }))));

export const currentOutlookAccount = Effect.gen(function* () {
  const id = yield* Effect.try({ try: readOutlookAccountId, catch: calendarError("Die Outlook-Verbindung konnte nicht gelesen werden.") });
  if (!id) return null;
  const account = yield* getOutlookAccount();
  if (account.id !== id) return yield* new CalendarError({ message: "Das Outlook-Profil wurde gewechselt. Bitte die Verbindung trennen und erneut verbinden." });
  return account;
});

export const listOutlookEvents = (start: string, end: string) => Effect.gen(function* () {
  if (!isInstant(start) || !isInstant(end) || Date.parse(end) <= Date.parse(start)) {
    return yield* new CalendarError({ message: "Ungültiger Kalenderzeitraum." });
  }
  const accountId = yield* connectedAccountId;
  const events = yield* request(Schema.Array(OutlookCalendarEvent), { action: "list", accountId, start, end });
  if (events.some((event) => !event.id || !isInstant(event.start) || !isInstant(event.end) || Date.parse(event.end) <= Date.parse(event.start))) {
    return yield* new CalendarError({ message: "Outlook hat Termine mit ungültigen Zeitangaben geliefert." });
  }
  return events;
});

export const upsertOutlookEvent = (rollout: Rollout) => Effect.gen(function* () {
  const accountId = yield* connectedAccountId;
  if (rollout.outlookAccountId && rollout.outlookAccountId !== accountId) {
    return yield* new CalendarError({ message: "Dieser Rollout gehört zu einem anderen Outlook-Kalender. Bitte das ursprüngliche Profil verbinden." });
  }
  return yield* request(OutlookSavedEvent, {
    action: "upsert", accountId, rollout: {
      id: rollout.id, title: rollout.title, start: rollout.start, end: rollout.end,
      body: rolloutBody(rollout), reminderMinutes: rollout.reminderMinutes, eventId: rollout.outlookEventId,
    },
  });
});

export const removeOutlookEvent = (rollout: Rollout) => Effect.gen(function* () {
  const accountId = yield* connectedAccountId;
  if (rollout.outlookAccountId !== accountId) {
    return yield* new CalendarError({ message: "Zum Löschen bitte den ursprünglichen Outlook-Kalender verbinden. Der lokale Rollout bleibt erhalten." });
  }
  yield* request(Schema.Null, { action: "delete", accountId, eventId: rollout.outlookEventId, rolloutId: rollout.id });
});

export const openOutlookEvent = (eventId: string) => Effect.gen(function* () {
  const accountId = yield* connectedAccountId;
  const [entryId, occurrenceStart] = eventId.split("|");
  if (!entryId || (occurrenceStart && !isInstant(occurrenceStart))) {
    return yield* new CalendarError({ message: "Ungültiger Outlook-Termin." });
  }
  yield* request(Schema.Null, { action: "open", accountId, eventId: entryId, occurrenceStart: occurrenceStart ?? null });
});
