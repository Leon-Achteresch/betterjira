import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { Data, Effect } from "effect";

export class AppUpdateError extends Data.TaggedError("AppUpdateError")<{ message: string; cause?: unknown }> {}

export const appUpdateKeys = {
  check: ["app-update"] as const,
};

export const checkForUpdate = Effect.tryPromise({
  try: () => check(),
  catch: (cause) => new AppUpdateError({ message: "Suche nach Updates fehlgeschlagen", cause }),
});

export const installUpdate = (update: Update) =>
  Effect.tryPromise({
    try: () => update.downloadAndInstall(),
    catch: (cause) => new AppUpdateError({ message: "Update konnte nicht installiert werden", cause }),
  }).pipe(
    Effect.flatMap(() =>
      Effect.tryPromise({
        try: () => relaunch(),
        catch: (cause) => new AppUpdateError({ message: "Neustart fehlgeschlagen", cause }),
      }),
    ),
  );
