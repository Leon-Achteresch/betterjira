import { invoke } from "@tauri-apps/api/core";
import { Data, Effect, Schema } from "effect";
import { attentionContext, type AttentionContextInput } from "./context";

export const ATTENTION_EVENT = "attention-updated";

const AttentionPort = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 65535 }));

export const attentionCallbackUrl = (port: number) => `http://127.0.0.1:${port}/attention`;

export const attentionKeys = {
  all: ["attention"] as const,
  result: ["attention", "result"] as const,
  server: (token: string) => ["attention", "server", token] as const,
};

export class AttentionError extends Data.TaggedError("AttentionError")<{ message: string; cause?: unknown }> {}

const attentionError = (message: string) => (cause: unknown) =>
  cause instanceof AttentionError ? cause : new AttentionError({ message: typeof cause === "string" ? cause : message, cause });

export const AttentionUrgency = Schema.Literals(["now", "today", "soon"]);
export type AttentionUrgency = typeof AttentionUrgency.Type;

export const AttentionResult = Schema.Struct({
  runId: Schema.String,
  generatedAt: Schema.String,
  summary: Schema.String,
  items: Schema.Array(
    Schema.Struct({
      key: Schema.String,
      title: Schema.String,
      urgency: AttentionUrgency,
      reason: Schema.String,
      action: Schema.String,
      waitingOn: Schema.optional(Schema.NullOr(Schema.String)),
    }),
  ),
});
export type AttentionResult = typeof AttentionResult.Type;
export type AttentionItem = AttentionResult["items"][number];

export const serveAttention = (token: string) =>
  Effect.tryPromise({
    try: () => invoke<unknown>("attention_serve", { token }),
    catch: attentionError("Lokaler Endpunkt konnte nicht starten"),
  }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(AttentionPort)),
    Effect.mapError(attentionError("Lokaler Endpunkt hat einen ungültigen Port zurückgegeben")),
  );

export const readAttention = Effect.gen(function* () {
  const raw = yield* Effect.tryPromise({
    try: () => invoke<unknown>("attention_read"),
    catch: attentionError("Briefing konnte nicht gelesen werden"),
  }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(Schema.NullOr(Schema.String))),
    Effect.mapError(attentionError("Briefing konnte nicht gelesen werden")),
  );
  if (raw === null) return null;
  return yield* Effect.try({ try: () => JSON.parse(raw) as unknown, catch: attentionError("Briefing ist kein JSON") }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(AttentionResult)),
    Effect.mapError(attentionError("Das Briefing des Agents hat ein unerwartetes Format")),
  );
});

export const triggerAttention = (webhookUrl: string, input: AttentionContextInput, port: number) =>
  attentionContext(input).pipe(
    Effect.flatMap((context) =>
      Effect.tryPromise({
        try: () => invoke<unknown>("attention_trigger", {
          url: webhookUrl,
          body: JSON.stringify({ runId: input.runId, context, callbackUrl: attentionCallbackUrl(port) }),
        }),
        catch: attentionError("Webhook konnte nicht aufgerufen werden"),
      }).pipe(
        Effect.flatMap(Schema.decodeUnknownEffect(Schema.Null)),
        Effect.mapError(attentionError("Webhook hat eine unerwartete Antwort zurückgegeben")),
      ),
    ),
  );
