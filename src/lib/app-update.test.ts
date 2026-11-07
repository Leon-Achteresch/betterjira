import { describe, expect, it } from "vitest";
import { compareVersions, toReleases } from "./app-update";

describe("compareVersions", () => {
  it("orders numerically, not lexically", () => {
    expect(compareVersions("0.10.0", "0.9.0")).toBe(1);
    expect(compareVersions("0.6.0", "0.7.0")).toBe(-1);
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
  });
});

describe("toReleases", () => {
  it("drops drafts and prereleases and strips the tag prefix", () => {
    const releases = toReleases([
      { tag_name: "v0.7.0", published_at: "2026-11-06T18:14:30Z", draft: false, prerelease: false },
      { tag_name: "v0.8.0", published_at: null, draft: true, prerelease: false },
      { tag_name: "v0.8.0-beta", published_at: null, draft: false, prerelease: true },
    ]);
    expect(releases).toEqual([{ version: "0.7.0", publishedAt: "2026-11-06T18:14:30Z" }]);
  });
});
