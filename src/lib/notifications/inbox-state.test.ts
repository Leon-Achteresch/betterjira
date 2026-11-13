import { describe, expect, it } from "vitest";
import { ACTIVITY_LOOKBACK_MS, restoreInbox } from "./inbox-state";

const item = { id: "c:1", issueKey: "X-1", summary: "Test", created: 1, read: false, kind: "direct", title: "Kommentar", body: "Text", actor: { displayName: "Sam", avatarUrls: { "48x48": "" } } };

describe("restoreInbox", () => {
  it("repairs persisted duplicates without losing read state", () => {
    const restored = restoreInbox({ owner: "a", checkedAt: 20, items: [item, { ...item, read: true }, item] });
    expect(restored.items).toEqual([{ ...item, read: true }]);
    expect(restored.seen).toEqual({ "c:1": 1 });
  });

  it("keeps deduplication history beyond the visible inbox after a restart", () => {
    const restored = restoreInbox({ owner: "a", checkedAt: 20, items: [item], seen: { "c:2": 2 } });
    expect(restoreInbox(JSON.parse(JSON.stringify(restored))).seen).toEqual({ "c:1": 1, "c:2": 2 });
  });

  it("migrates legacy kinds, ignores invalid items and expires old history", () => {
    const { kind: _, ...legacy } = item;
    const restored = restoreInbox({ items: [null, { id: "broken" }, legacy], checkedAt: ACTIVITY_LOOKBACK_MS + 10, seen: { old: 0, recent: ACTIVITY_LOOKBACK_MS } });
    expect(restored.items).toEqual([{ ...item, kind: "watching" }]);
    expect(restored.seen.old).toBeUndefined();
    expect(restored.seen.recent).toBe(ACTIVITY_LOOKBACK_MS);
  });

  it.each([undefined, null, "broken", { owner: 1 }, { items: "broken" }])("safely restores malformed storage %j", (raw) => {
    expect(restoreInbox(raw)).toMatchObject({ owner: null, checkedAt: null, items: [], seen: {} });
  });
});
