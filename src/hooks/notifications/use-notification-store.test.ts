import { describe, expect, it } from "vitest";
import type { JiraNotification } from "@/lib/jira/notifications";
import { useNotifications } from "./use-notification-store";

const notification = (id: string): JiraNotification => ({
  id,
  issueKey: "X-1",
  summary: "Summary",
  created: 1,
  read: false,
  kind: "direct",
  title: "hat kommentiert",
  body: "",
  actor: { displayName: "Sam", avatarUrls: { "48x48": "" } },
});

describe("useNotifications", () => {
  it("does not assign unowned legacy items to the first account", () => {
    useNotifications.setState({ owner: null, items: [notification("a")], checkedAt: 5 });
    useNotifications.getState().adopt("first");
    expect(useNotifications.getState()).toMatchObject({ owner: "first", items: [], checkedAt: null });
  });

  it("retains the current account items and drops them when the account changes", () => {
    useNotifications.setState({ owner: "first", items: [notification("a")], checkedAt: 5 });

    useNotifications.getState().adopt("first");
    expect(useNotifications.getState().items).toHaveLength(1);

    useNotifications.getState().adopt("second");
    expect(useNotifications.getState()).toMatchObject({ owner: "second", items: [], checkedAt: null });
  });
});

describe("notification deduplication", () => {
  it("accepts an event only once within the same response", () => {
    useNotifications.getState().adopt("batch");
    const item = notification("duplicate");
    expect(useNotifications.getState().receive([item, item], 10)).toHaveLength(1);
    expect(useNotifications.getState().items).toHaveLength(1);
  });

  it("remembers events evicted from the visible inbox across overlapping polls", () => {
    useNotifications.getState().adopt("overflow");
    const batch = Array.from({ length: 250 }, (_, index) => notification(String(index)));
    useNotifications.getState().receive(batch, 10);
    useNotifications.getState().markAllRead();
    expect(useNotifications.getState().items).toHaveLength(200);
    expect(useNotifications.getState().receive(batch, 20)).toEqual([]);
    expect(useNotifications.getState().items.every((item) => item.read)).toBe(true);
  });

  it("never moves the successful polling watermark backwards", () => {
    useNotifications.getState().adopt("watermark");
    useNotifications.getState().receive([], 20);
    useNotifications.getState().receive([], 10);
    expect(useNotifications.getState().checkedAt).toBe(20);
  });
});
