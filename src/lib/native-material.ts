import { invoke } from "@tauri-apps/api/core";
import { Data, Effect, Schema } from "effect";

export class NativeMaterialError extends Data.TaggedError("NativeMaterialError")<{ cause: unknown }> {}

export const nativeMaterialKeys = { enabled: ["native-material", "enabled"] as const };

export const enableNativeMaterial = Effect.tryPromise({
  try: () => invoke<unknown>("native_material_enable"),
  catch: (cause) => new NativeMaterialError({ cause }),
}).pipe(
  Effect.flatMap(Schema.decodeUnknownEffect(Schema.Boolean)),
  Effect.mapError((cause) => new NativeMaterialError({ cause })),
);
