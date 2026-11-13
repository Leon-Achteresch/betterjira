import { afterEach, describe, expect, it, vi } from "vitest";
import { restoreInbox } from "./inbox-state";
import { retainInboxItems, snoozeUntil, validSnoozes, wakeSnoozed } from "./snooze";

const item = { id: "c:1", issueKey: "X-1", summary: "Test", created: 1, read: true, kind: "direct" as const, title: "Kommentar", body: "Text", actor: { displayName: "Sam", avatarUrls: { "48x48": "" } } };

afterEach(() => vi.unstubAllEnvs());

describe("notification snooze", () => {
  it("uses local morning across spring and autumn daylight saving changes", () => {
    vi.stubEnv("TZ", "Europe/Berlin");
    for (const day of ["2026-03-28T09:00:00", "2026-10-24T09:00:00"]) {
      const now = new Date(day);
      const tomorrow = new Date(snoozeUntil("tomorrow", now.getTime()));
      expect(tomorrow.getDate()).toBe(now.getDate() + 1);
      expect(tomorrow.getHours()).toBe(9);
    }
    const spring = new Date("2026-03-28T09:00:00").getTime();
    expect(snoozeUntil("tomorrow", spring) - spring).toBe(23 * 60 * 60_000);
  });

  it("keeps the three-hour preset exact and advances a week on the calendar", () => {
    const now = new Date(2026, 10, 29, 23, 30).getTime();
    expect(snoozeUntil("later", now) - now).toBe(3 * 60 * 60_000);
    expect(new Date(snoozeUntil("next-week", now)).getHours()).toBe(9);
    expect(new Date(snoozeUntil("next-week", now)).getDate()).toBe(6);
  });

  it("preserves scheduled notifications beyond the ordinary inbox limit", () => {
    const batch = Array.from({ length: 220 }, (_, index) => ({ ...item, id: String(index), issueKey: `X-${index}`, created: index }));
    const kept = retainInboxItems(batch, { "X-0": 1000 }, 200);
    expect(kept).toHaveLength(201);
    expect(kept.some((entry) => entry.issueKey === "X-0")).toBe(true);
  });

  it("wakes only due tickets, marks their events unread and tolerates a backwards clock", () => {
    const items = [item, { ...item, issueKey: "X-2", id: "c:2" }];
    const snoozed = { "X-1": 1000, "X-2": 2000 };
    expect(wakeSnoozed(items, snoozed, 900).changed).toBe(false);
    const due = wakeSnoozed(items, snoozed, 1000);
    expect(due.snoozed).toEqual({ "X-2": 2000 });
    expect(due.items.map((entry) => entry.read)).toEqual([false, true]);
    expect(wakeSnoozed(due.items, due.snoozed, 1000).changed).toBe(false);
  });

  it("restores future schedules and catches up on overdue schedules after restart", () => {
    const state = { owner: "account", items: [item], snoozed: { "X-1": 1000 } };
    expect(restoreInbox(state, 900).snoozed).toEqual({ "X-1": 1000 });
    expect(restoreInbox(state, 1100)).toMatchObject({ snoozed: {}, items: [{ read: false }] });
  });

  it("ignores orphaned, malformed and out-of-range schedules", () => {
    expect(validSnoozes({ "X-1": "tomorrow", "X-2": Infinity, "X-3": 1000, "X-4": -1, "X-5": 9e15, missing: 1000 }, new Set(["X-1", "X-2", "X-3", "X-4", "X-5"]))).toEqual({ "X-3": 1000 });
    expect(restoreInbox({ owner: "one", items: [item], snoozed: "broken" }).items).toEqual([item]);
  });
});
