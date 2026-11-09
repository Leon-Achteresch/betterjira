import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Data, Effect, Schema } from "effect";
import { Connection } from "./model";

export class ZammadError extends Data.TaggedError("ZammadError")<{
  message: string;
  status?: number;
  cause?: unknown;
}> {}
const failure = (message: string) => (cause: unknown) =>
  cause instanceof ZammadError
    ? cause
    : new ZammadError({
        message: typeof cause === "string" ? cause : message,
        cause,
      });
const Response = Schema.Struct({ status: Schema.Number, body: Schema.String });
export const zammad = <S extends Schema.Decoder<unknown>>(
  path: string,
  schema: S,
  method = "GET",
  body?: unknown,
) =>
  Effect.tryPromise({
    try: () =>
      invoke<unknown>("zammad_request", {
        path,
        method,
        body: body === undefined ? null : JSON.stringify(body),
      }),
    catch: failure("Zammad-Anfrage fehlgeschlagen"),
  }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(Response)),
    Effect.mapError(failure("Ungültige Zammad-Antwort")),
    Effect.flatMap((response) => {
      if (response.status < 200 || response.status >= 300) {
        const message =
          response.status === 401
            ? "Zammad-Token ungültig oder abgelaufen. Bitte neu verbinden."
            : response.status === 403
              ? "Keine Berechtigung für diese Zammad-Funktion."
              : response.status === 404
                ? "Ticket nicht gefunden oder kein Zugriff."
                : response.status === 429
                  ? "Zu viele Anfragen. Bitte kurz warten und erneut versuchen."
                  : `Zammad meldet Fehler ${response.status}. Eingaben und Berechtigungen prüfen.`;
        return Effect.fail(
          new ZammadError({ message, status: response.status }),
        );
      }
      return Effect.try({
        try: () =>
          response.body.trim() ? (JSON.parse(response.body) as unknown) : null,
        catch: failure("Zammad liefert kein gültiges JSON"),
      });
    }),
    Effect.flatMap((value) =>
      Schema.decodeUnknownEffect(schema)(value).pipe(
        Effect.mapError(failure("Unerwartetes Zammad-Antwortformat")),
      ),
    ),
    Effect.mapError(failure("Zammad-Anfrage fehlgeschlagen")),
  );
export const readConnection = Effect.tryPromise({
  try: () => invoke<unknown>("zammad_connection_get"),
  catch: failure("Zammad-Verbindung konnte nicht gelesen werden"),
}).pipe(
  Effect.flatMap(Schema.decodeUnknownEffect(Schema.NullOr(Connection))),
  Effect.mapError(failure("Ungültige gespeicherte Verbindung")),
);
export const connect = (baseUrl: string, token: string) =>
  Effect.tryPromise({
    try: () => invoke<unknown>("zammad_connect", { baseUrl, token }),
    catch: failure("Zammad konnte nicht verbunden werden"),
  }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(Connection)),
    Effect.mapError(failure("Ungültige Verbindung")),
  );
export const disconnect = Effect.tryPromise({
  try: () => invoke("zammad_disconnect"),
  catch: failure("Verbindung konnte nicht getrennt werden"),
});
export const openZammad = (baseUrl: string, path = "") =>
  Effect.tryPromise({
    try: () => openUrl(`${baseUrl}/#${path}`),
    catch: failure("Zammad konnte nicht geöffnet werden"),
  });
