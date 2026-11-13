import { beforeEach, describe, expect, it, vi } from "vitest";
import { Data, Effect } from "effect";
import type { JiraNotification } from "@/lib/jira/notifications";
import { useNotifications } from "./use-notification-store";
import { useActivityAlertPrefs } from "./use-activity-alert-prefs";
import { pollNotificationActivity } from "./use-notification-poller";

const activity = vi.hoisted(() => vi.fn<(me: string, since: number) => Effect.Effect<JiraNotification[], PollTestError>>());
vi.mock("@/lib/jira/notifications", async () => ({
  ...await vi.importActual<typeof import("@/lib/jira/notifications")>("@/lib/jira/notifications"),
  fetchActivity: activity,
}));

class PollTestError extends Data.TaggedError("PollTestError")<{ message: string }> {}

const item: JiraNotification = { id: "c:1", issueKey: "X-1", summary: "Test", created: Date.now(), read: false, kind: "direct", title: "Kommentar", body: "Text", actor: { displayName: "Sam", avatarUrls: { "48x48": "" } } };
const open = { issue: () => undefined, inbox: () => undefined };
let owner: string | null = "a";
const poll = (signal = new AbortController().signal) => pollNotificationActivity("a", "me", signal, open, () => owner, () => true);
const pendingActivity = () => {
  let resolve: (items: JiraNotification[]) => void = () => undefined;
  const pending = new Promise<JiraNotification[]>((done) => { resolve = done; });
  activity.mockReturnValue(Effect.tryPromise({ try: () => pending, catch: () => new PollTestError({ message: "failed" }) }));
  return resolve;
};

beforeEach(() => {
  owner = "a";
  activity.mockReset().mockReturnValue(Effect.succeed([item]));
  useActivityAlertPrefs.setState({ inApp: false, system: false });
  useNotifications.setState({ owner: "a", items: [], checkedAt: Date.now() - 1000, seen: {} });
});

describe("notification polling lifecycle", () => {
  it("establishes a baseline without replaying history on first login", async () => {
    useNotifications.setState({ checkedAt: null });
    await poll();
    expect(activity).not.toHaveBeenCalled();
    expect(useNotifications.getState().checkedAt).not.toBeNull();
  });

  it("does not adopt or fetch for an obsolete session", async () => {
    owner = "b";
    useNotifications.getState().adopt("b");
    await poll();
    expect(useNotifications.getState().owner).toBe("b");
    expect(activity).not.toHaveBeenCalled();
  });

  it.each([null, "b"])("discards a response after the active session becomes %s before the store changes", async (nextOwner) => {
    const resolve = pendingActivity();
    const before = useNotifications.getState().checkedAt;
    const result = poll();
    owner = nextOwner;
    resolve([item]);
    await result;
    expect(useNotifications.getState()).toMatchObject({ items: [], checkedAt: before });
  });

  it("preserves the cursor on failure so reconnect can recover missing activity", async () => {
    const before = useNotifications.getState().checkedAt;
    activity.mockReturnValueOnce(Effect.fail(new PollTestError({ message: "offline" })));
    await expect(poll()).rejects.toThrow("offline");
    expect(useNotifications.getState().checkedAt).toBe(before);
    await poll();
    expect(activity.mock.calls.map(([, since]) => since)).toEqual([before, before]);
    expect(useNotifications.getState().items).toEqual([item]);
  });

  it("does not write a cancelled response", async () => {
    const resolve = pendingActivity();
    const controller = new AbortController();
    const before = useNotifications.getState().checkedAt;
    const result = poll(controller.signal).catch(() => undefined);
    controller.abort();
    resolve([item]);
    await result;
    expect(useNotifications.getState()).toMatchObject({ items: [], checkedAt: before });
  });

  it("discards a late response after a newer poll already succeeded", async () => {
    const resolve = pendingActivity();
    const first = poll();
    activity.mockReturnValue(Effect.succeed([item]));
    await poll();
    const checkedAt = useNotifications.getState().checkedAt;
    resolve([{ ...item, id: "late" }]);
    await first;
    expect(useNotifications.getState()).toMatchObject({ items: [item], checkedAt });
  });
});
