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
