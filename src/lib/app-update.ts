import { getVersion } from "@tauri-apps/api/app";
import { Channel, invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { Data, Effect, Schema } from "effect";

export class AppUpdateError extends Data.TaggedError("AppUpdateError")<{ message: string; cause?: unknown }> {}

export const RELEASES_URL = "https://github.com/Leon-Achteresch/betterjira/releases";

export const appUpdateKeys = {
  check: ["app-update"] as const,
  version: ["app-update", "version"] as const,
  releases: ["app-update", "releases"] as const,
};

const RELEASES_API = "https://api.github.com/repos/Leon-Achteresch/betterjira/releases?per_page=30";

const GithubReleases = Schema.Array(
  Schema.Struct({
    tag_name: Schema.String,
    published_at: Schema.NullOr(Schema.String),
    draft: Schema.Boolean,
    prerelease: Schema.Boolean,
  }),
);

export type Release = { version: string; publishedAt: string | null };

export function toReleases(releases: typeof GithubReleases.Type): Release[] {
  return releases
    .filter((release) => !release.draft && !release.prerelease)
    .map((release) => ({ version: release.tag_name.replace(/^v/, ""), publishedAt: release.published_at }));
}

export function compareVersions(a: string, b: string): number {
  const parts = (version: string) => version.split("-")[0].split(".").map((part) => Number(part) || 0);
  const left = parts(a);
  const right = parts(b);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0);
    if (diff !== 0) return Math.sign(diff);
  }
  return 0;
}

export const listReleases = Effect.tryPromise({
  try: async (signal) => {
    const response = await fetch(RELEASES_API, { signal, headers: { Accept: "application/vnd.github+json" } });
    if (!response.ok) throw new Error(`GitHub antwortet mit ${response.status}`);
    return (await response.json()) as unknown;
  },
  catch: (cause) => new AppUpdateError({ message: "Versionen konnten nicht geladen werden", cause }),
}).pipe(
  Effect.flatMap(Schema.decodeUnknownEffect(GithubReleases)),
  Effect.mapError((cause) => (cause instanceof AppUpdateError ? cause : new AppUpdateError({ message: "Ungültige Versionsliste", cause }))),
  Effect.map(toReleases),
);

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

export const restartApp = Effect.tryPromise({
  try: () => relaunch(),
  catch: (cause) => new AppUpdateError({ message: "Neustart fehlgeschlagen", cause }),
});

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
  });

export const installVersion = (version: string, onProgress: (percent: number) => void) =>
  Effect.tryPromise({
    try: () => {
      const channel = new Channel<{ downloaded: number; total: number | null }>();
      channel.onmessage = ({ downloaded, total }) => {
        const percent = downloadPercent(downloaded, total ?? 0);
        if (percent !== null) onProgress(percent);
      };
      return invoke("update_install_version", { version, onProgress: channel });
    },
    catch: (cause) => new AppUpdateError({ message: `Version ${version} konnte nicht installiert werden`, cause }),
  });
