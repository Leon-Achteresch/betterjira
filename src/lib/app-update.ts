import { getVersion } from "@tauri-apps/api/app";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { Data, Effect } from "effect";

export class AppUpdateError extends Data.TaggedError("AppUpdateError")<{ message: string; cause?: unknown }> {}

export const RELEASES_URL = "https://github.com/Leon-Achteresch/betterjira/releases";

export const appUpdateKeys = {
  check: ["app-update"] as const,
  version: ["app-update", "version"] as const,
};

export const checkForUpdate = Effect.tryPromise({
  try: () => check(),
  catch: (cause) => new AppUpdateError({ message: "Suche nach Updates fehlgeschlagen", cause }),
});

export const currentVersion = Effect.tryPromise({
  try: () => getVersion(),
  catch: (cause) => new AppUpdateError({ message: "Version unbekannt", cause }),
});

export function downloadPercent(downloaded: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.min(100, Math.round((downloaded / total) * 100));
}

export const installUpdate = (update: Update, onProgress: (percent: number) => void) =>
  Effect.tryPromise({
    try: () => {
      let downloaded = 0;
      let total = 0;
      return update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
          downloaded = 0;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
        }
        const percent = downloadPercent(downloaded, total);
        if (percent !== null) onProgress(percent);
      });
    },
    catch: (cause) => new AppUpdateError({ message: "Update konnte nicht installiert werden", cause }),
  }).pipe(
    Effect.flatMap(() =>
      Effect.tryPromise({
        try: () => relaunch(),
        catch: (cause) => new AppUpdateError({ message: "Neustart fehlgeschlagen", cause }),
      }),
    ),
  );
