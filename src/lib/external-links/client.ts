import { openUrl } from "@tauri-apps/plugin-opener";
import { Data, Effect } from "effect";

export class ExternalLinkError extends Data.TaggedError("ExternalLinkError")<{ message: string }> {}

export const openableUrl = (value: string | null | undefined) => {
  const raw = value?.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    if (!url.hostname || url.username || url.password) return undefined;
    return { href: url.href, host: url.host };
  } catch {
    return undefined;
  }
};

export const openExternalLink = (href: string) =>
  Effect.suspend(() => {
    const target = openableUrl(href);
    if (!target) return Effect.fail(new ExternalLinkError({ message: "Dieser Link kann nicht geöffnet werden." }));
    return Effect.tryPromise({
      try: () => openUrl(target.href),
      catch: () => new ExternalLinkError({ message: "Link konnte nicht geöffnet werden." }),
    });
  });
