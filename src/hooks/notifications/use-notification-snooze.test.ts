import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JiraNotification } from "@/lib/jira/notifications";
import { useNotifications } from "./use-notification-store";

const item: JiraNotification = {
  id: "c:1", issueKey: "X-1", summary: "Summary", created: 100, read: true,
  kind: "direct", title: "Kommentar", body: "", actor: { displayName: "Sam", avatarUrls: { "48x48": "" } },
};

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(1000);
  useNotifications.setState({ owner: "one", items: [item], checkedAt: 1000, seen: {}, snoozed: {} });
});
afterEach(() => vi.restoreAllMocks());

describe("persisted notification snooze actions", () => {
  it("rejects invalid times, unknown issues and foreign owners", () => {
    const { setSnooze } = useNotifications.getState();
    expect(setSnooze("one", "X-1", 1000)).toBe(false);
    expect(setSnooze("one", "X-1", NaN)).toBe(false);
    expect(setSnooze("one", "X-2", 2000)).toBe(false);
    expect(setSnooze("two", "X-1", 2000)).toBe(false);
    expect(useNotifications.getState().snoozed).toEqual({});
  });

  it("guards undo against new schedules and account changes", () => {
    const { setSnooze } = useNotifications.getState();
    expect(setSnooze("one", "X-1", 2000)).toBe(true);
    expect(setSnooze("one", "X-1", 3000)).toBe(true);
    expect(setSnooze("one", "X-1", null, 2000)).toBe(false);
    expect(setSnooze("one", "X-1", null, 3000)).toBe(true);
    expect(useNotifications.getState().items[0].read).toBe(true);
    setSnooze("one", "X-1", 2000);
    useNotifications.getState().adopt("two");
    useNotifications.setState({ items: [item] });
    expect(setSnooze("one", "X-1", 2000)).toBe(false);
    expect(useNotifications.getState().snoozed).toEqual({});
  });

  it("new activity wakes the ticket while a duplicate poll keeps it snoozed", () => {
    useNotifications.getState().setSnooze("one", "X-1", 2000);
    useNotifications.getState().receive([item], 1100);
    expect(useNotifications.getState().snoozed).toEqual({ "X-1": 2000 });
    useNotifications.getState().receive([{ ...item, id: "c:2", created: 1200, read: false }], 1200);
    expect(useNotifications.getState().snoozed).toEqual({});
    expect(useNotifications.getState().items[0].read).toBe(false);
  });

  it("mark-all leaves snoozed activity unchanged and waking is idempotent", () => {
    useNotifications.setState({ items: [{ ...item, read: false }] });
    useNotifications.getState().setSnooze("one", "X-1", 2000);
    useNotifications.getState().markAllRead();
    expect(useNotifications.getState().items[0].read).toBe(false);
    useNotifications.getState().setRead([item.id], true);
    useNotifications.getState().wakeDue(2000);
    expect(useNotifications.getState().snoozed).toEqual({});
    expect(useNotifications.getState().items[0].read).toBe(false);
    const snapshot = useNotifications.getState();
    useNotifications.getState().wakeDue(3000);
    expect(useNotifications.getState()).toBe(snapshot);
  });
});
