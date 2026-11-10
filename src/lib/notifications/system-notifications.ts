import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { Data, Effect, Schema } from "effect";
import type { SystemPermission } from "./activity-alerts";

export class SystemNotificationError extends Data.TaggedError("SystemNotificationError")<{ message: string; cause?: unknown }> {}

export const systemNotificationKeys = {
  permission: ["system-notifications", "permission"] as const,
};

const PermissionCheck = Schema.NullOr(Schema.Boolean);
const PermissionAnswer = Schema.Literals(["granted", "denied", "default", "prompt", "prompt-with-rationale"]);

const failure = (message: string) => (cause: unknown) => new SystemNotificationError({ message, cause });

const toPermission = (answer: typeof PermissionAnswer.Type): SystemPermission =>
  answer === "granted" || answer === "denied" ? answer : "prompt";

export const readSystemPermission = Effect.tryPromise({
  try: () => isPermissionGranted(),
  catch: failure("Der Berechtigungsstatus konnte nicht gelesen werden."),
}).pipe(
  Effect.flatMap((value) =>
    Schema.decodeUnknownEffect(PermissionCheck)(value).pipe(Effect.mapError(failure("Das System hat einen unbekannten Berechtigungsstatus gemeldet."))),
  ),
  Effect.map((granted): SystemPermission => (granted === null ? "prompt" : granted ? "granted" : "denied")),
);

export const requestSystemPermission = Effect.tryPromise({
  try: () => requestPermission(),
  catch: failure("Die Anfrage an das System ist fehlgeschlagen."),
}).pipe(
  Effect.flatMap((value) =>
    Schema.decodeUnknownEffect(PermissionAnswer)(value).pipe(Effect.mapError(failure("Das System hat eine unbekannte Antwort gegeben."))),
  ),
  Effect.map(toPermission),
);

export const sendSystemNotification = (alert: { title: string; body: string }) =>
  Effect.try({
    try: () => sendNotification(alert),
    catch: failure("Der Systemhinweis konnte nicht angezeigt werden."),
  });
