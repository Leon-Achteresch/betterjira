import { beforeEach, describe, expect, it, vi } from "vitest";
import { Effect } from "effect";

const { openUrl } = vi.hoisted(() => ({ openUrl: vi.fn<(url: string) => Promise<void>>() }));

vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl }));

import { openExternalLink } from "./client";

beforeEach(() => {
  openUrl.mockReset();
  openUrl.mockResolvedValue(undefined);
});

describe("openExternalLink", () => {
  it("öffnet ein normalisiertes Webziel erst beim Ausführen des Effects", async () => {
    const program = openExternalLink("HTTPS://Example.test/guide");
    expect(openUrl).not.toHaveBeenCalled();
    await Effect.runPromise(program);
    expect(openUrl).toHaveBeenCalledExactlyOnceWith("https://example.test/guide");
  });

  it.each(["javascript:alert(1)", "https://user:password@example.test/private"])("übergibt %s nicht an den nativen Opener", async (href) => {
    const error = await Effect.runPromise(Effect.flip(openExternalLink(href)));
    expect(error._tag).toBe("ExternalLinkError");
    expect(openUrl).not.toHaveBeenCalled();
    expect(error.message).not.toContain(href);
  });

  it("übersetzt native Fehler ohne interne Details oder Zieladresse", async () => {
    openUrl.mockRejectedValue(new Error("native failure at https://example.test/private?session=example"));
    const error = await Effect.runPromise(Effect.flip(openExternalLink("https://example.test/private")));
    expect(error).toMatchObject({ _tag: "ExternalLinkError", message: "Link konnte nicht geöffnet werden." });
    expect(error.message).not.toContain("example.test");
  });
});
