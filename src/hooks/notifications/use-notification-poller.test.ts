import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JiraNotification } from "@/lib/jira/notifications";
import { useActivityAlertPrefs } from "./use-activity-alert-prefs";
import { alertCooldown, deliverActivityAlerts } from "./use-notification-poller";
import { useNotifications } from "./use-notification-store";

const native = vi.hoisted(() => ({
  isPermissionGranted: vi.fn<() => Promise<boolean | null>>(),
  requestPermission: vi.fn<() => Promise<string>>(),
  sendNotification: vi.fn<(options: unknown) => void>(),
}));
const sonner = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("@tauri-apps/plugin-notification", () => native);
vi.mock("sonner", () => sonner);

const notification = (id: string): JiraNotification => ({
  id,
  issueKey: `DEMO-${id}`,
  summary: "Testticket",
  created: 1,
  read: false,
  kind: "direct",
  title: "hat kommentiert",
  body: "",
  actor: { displayName: "Sam", avatarUrls: { "48x48": "" } },
});

const openIssue = { issue: () => undefined, inbox: () => undefined };

const deferred = <T,>() => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

beforeEach(() => {
  native.isPermissionGranted.mockReset().mockResolvedValue(true);
  native.requestPermission.mockReset();
  native.sendNotification.mockReset();
  sonner.toast.mockReset();
  useActivityAlertPrefs.setState({ inApp: true, system: true, watching: false, systemEpoch: 0 });
  alertCooldown.clear();
  useNotifications.setState({ owner: "konto-a", items: [], checkedAt: 1 });
});

describe("deliverActivityAlerts", () => {
  it("zeigt mit Standardwerten Popups in der App und Systemhinweise im Hintergrund", async () => {
    await deliverActivityAlerts(["1", "2", "3", "4"].map(notification), true, openIssue);
    expect(sonner.toast).toHaveBeenCalledTimes(1);
    expect(sonner.toast).toHaveBeenCalledWith("4 Neuigkeiten in 4 Tickets", expect.anything());
    expect(native.isPermissionGranted).not.toHaveBeenCalled();

    await deliverActivityAlerts(["5", "6", "7", "8"].map(notification), false, openIssue);
    expect(native.sendNotification).toHaveBeenCalledTimes(1);
    expect(native.requestPermission).not.toHaveBeenCalled();
  });

  it("meldet dasselbe Ticket innerhalb der Ruhezeit nur einmal", async () => {
    await deliverActivityAlerts([notification("1")], false, openIssue, undefined, 0);
    await deliverActivityAlerts([{ ...notification("1"), id: "x" }], false, openIssue, undefined, 60_000);
    expect(native.sendNotification).toHaveBeenCalledTimes(1);
    await deliverActivityAlerts([{ ...notification("1"), id: "y" }], false, openIssue, undefined, 6 * 60_000);
    expect(native.sendNotification).toHaveBeenCalledTimes(2);
  });

  it("setzt die Ruhezeit beim Kontowechsel zurück", async () => {
    await deliverActivityAlerts([notification("1")], false, openIssue, undefined, 0);
    useNotifications.setState({ owner: "konto-b" });
    await deliverActivityAlerts([{ ...notification("1"), id: "x" }], false, openIssue, () => "konto-b", 60_000);
    expect(native.sendNotification).toHaveBeenCalledTimes(2);
  });

  it("meldet beobachtete Tickets nur, wenn das eingeschaltet ist", async () => {
    await deliverActivityAlerts([{ ...notification("1"), kind: "watching" }], false, openIssue);
    expect(native.sendNotification).not.toHaveBeenCalled();
    useActivityAlertPrefs.getState().setWatching(true);
    await deliverActivityAlerts([{ ...notification("2"), kind: "watching" }], false, openIssue);
    expect(native.sendNotification).toHaveBeenCalledTimes(1);
  });

  it("bleibt bei ausgeschalteten Popups still, ohne auf Systemhinweise auszuweichen", async () => {
    useActivityAlertPrefs.getState().setInApp(false);
    await deliverActivityAlerts([notification("1")], true, openIssue);
    expect(sonner.toast).not.toHaveBeenCalled();
    expect(native.isPermissionGranted).not.toHaveBeenCalled();
    expect(native.sendNotification).not.toHaveBeenCalled();
  });

  it("ruft bei ausgeschalteten Systemhinweisen weder Berechtigung noch Zustellung auf", async () => {
    useActivityAlertPrefs.getState().setSystem(false);
    await deliverActivityAlerts([notification("1")], false, openIssue);
    expect(native.isPermissionGranted).not.toHaveBeenCalled();
    expect(native.requestPermission).not.toHaveBeenCalled();
    expect(native.sendNotification).not.toHaveBeenCalled();
  });

  it.each([false, null])("fordert ohne Berechtigung (%j) im Hintergrund nichts an und sendet nichts", async (granted) => {
    native.isPermissionGranted.mockResolvedValue(granted);
    await deliverActivityAlerts([notification("1")], false, openIssue);
    expect(native.requestPermission).not.toHaveBeenCalled();
    expect(native.sendNotification).not.toHaveBeenCalled();
  });

  it("sendet nicht, wenn der Fehler beim Lesen der Berechtigung auftritt", async () => {
    native.isPermissionGranted.mockRejectedValue(new Error("IPC weg"));
    await expect(deliverActivityAlerts([notification("1")], false, openIssue)).resolves.toBeUndefined();
    expect(native.sendNotification).not.toHaveBeenCalled();
  });

  it.each([
    ["ausgeschaltet", () => useActivityAlertPrefs.getState().setSystem(false)],
    [
      "aus- und wieder eingeschaltet",
      () => {
        useActivityAlertPrefs.getState().setSystem(false);
        useActivityAlertPrefs.getState().setSystem(true);
      },
    ],
    ["auf ein anderes Konto gewechselt", () => useNotifications.getState().adopt("konto-b")],
  ])("verwirft den Hinweis, wenn während der Berechtigungsprüfung %s wird", async (_, change) => {
    const check = deferred<boolean>();
    native.isPermissionGranted.mockReturnValue(check.promise);
    const delivery = deliverActivityAlerts([notification("1")], false, openIssue);
    change();
    check.resolve(true);
    await delivery;
    expect(native.sendNotification).not.toHaveBeenCalled();
  });

  it("stellt nach dem Wiedereinschalten keine Hinweise aus der stummen Zeit nach", async () => {
    useActivityAlertPrefs.getState().setSystem(false);
    await deliverActivityAlerts([notification("1"), notification("2")], false, openIssue);
    useActivityAlertPrefs.getState().setSystem(true);
    await deliverActivityAlerts([notification("3")], false, openIssue);
    expect(native.sendNotification).toHaveBeenCalledTimes(1);
    expect(native.sendNotification).toHaveBeenCalledWith(expect.objectContaining({ title: "DEMO-3 · Sam" }));
  });

  it("lässt das Umschalten der Popups eine laufende Systemzustellung unberührt", async () => {
    const check = deferred<boolean>();
    native.isPermissionGranted.mockReturnValue(check.promise);
    const delivery = deliverActivityAlerts([notification("1")], false, openIssue);
    useActivityAlertPrefs.getState().setInApp(false);
    check.resolve(true);
    await delivery;
    expect(native.sendNotification).toHaveBeenCalledTimes(1);
  });
  it.each([null, "konto-b"])("verwirft Hinweise bei geaenderter Sitzung trotz altem Inbox-Konto (%s)", async (nextOwner) => {
    const check = deferred<boolean>();
    native.isPermissionGranted.mockReturnValue(check.promise);
    let activeOwner: string | null = "konto-a";
    const delivery = deliverActivityAlerts([notification("1")], false, openIssue, () => activeOwner);
    activeOwner = nextOwner;
    check.resolve(true);
    await delivery;
    expect(useNotifications.getState().owner).toBe("konto-a");
    expect(native.sendNotification).not.toHaveBeenCalled();
  });

});

describe("delivery races", () => {
  it("does not consume the cooldown when OS permission is denied", async () => {
    native.isPermissionGranted.mockResolvedValue(false);
    await deliverActivityAlerts([notification("1")], false, openIssue, undefined, 0);
    await deliverActivityAlerts([{ ...notification("1"), id: "next" }], true, openIssue, undefined, 1000);
    expect(sonner.toast).toHaveBeenCalledTimes(1);
  });

  it("does not consume the cooldown when native delivery throws", async () => {
    native.sendNotification.mockImplementationOnce(() => { throw new Error("unavailable"); });
    await deliverActivityAlerts([notification("1")], false, openIssue, undefined, 0);
    await deliverActivityAlerts([{ ...notification("1"), id: "next" }], false, openIssue, undefined, 1000);
    expect(native.sendNotification).toHaveBeenCalledTimes(2);
  });

  it("suppresses already read notifications", async () => {
    await deliverActivityAlerts([{ ...notification("1"), read: true }], true, openIssue);
    expect(sonner.toast).not.toHaveBeenCalled();
  });
});

describe("delayed system permission", () => {
  it.each([true, false])("uses only an in-app toast when focus returns (permission %s)", async (permission) => {
    const check = deferred<boolean>();
    native.isPermissionGranted.mockReturnValue(check.promise);
    let focused = false;
    const delivery = deliverActivityAlerts([notification("1")], () => focused, openIssue);
    focused = true;
    check.resolve(permission);
    await delivery;
    expect(sonner.toast).toHaveBeenCalledTimes(1);
    expect(native.sendNotification).not.toHaveBeenCalled();
  });

  it("does not alert after the item was read during the permission check", async () => {
    const check = deferred<boolean>();
    native.isPermissionGranted.mockReturnValue(check.promise);
    useNotifications.setState({ items: [notification("1")] });
    const delivery = deliverActivityAlerts([notification("1")], false, openIssue);
    useNotifications.getState().markAllRead();
    check.resolve(true);
    await delivery;
    expect(native.sendNotification).not.toHaveBeenCalled();
  });

  it("rechecks the watching preference during delivery", async () => {
    const check = deferred<boolean>();
    native.isPermissionGranted.mockReturnValue(check.promise);
    useActivityAlertPrefs.getState().setWatching(true);
    const delivery = deliverActivityAlerts([{ ...notification("1"), kind: "watching" }], false, openIssue);
    useActivityAlertPrefs.getState().setWatching(false);
    check.resolve(true);
    await delivery;
    expect(native.sendNotification).not.toHaveBeenCalled();
  });

  it("reserves the issue while permission is pending to avoid concurrent delivery", async () => {
    const check = deferred<boolean>();
    native.isPermissionGranted.mockReturnValue(check.promise);
    const first = deliverActivityAlerts([notification("1")], false, openIssue);
    const second = deliverActivityAlerts([notification("1")], true, openIssue);
    check.resolve(true);
    await Promise.all([first, second]);
    expect(native.sendNotification).toHaveBeenCalledTimes(1);
    expect(sonner.toast).not.toHaveBeenCalled();
  });

  it("ignores an old toast action after switching accounts", async () => {
    const issue = vi.fn();
    await deliverActivityAlerts([notification("1")], true, { ...openIssue, issue });
    const action = sonner.toast.mock.calls[0][1].action;
    useNotifications.getState().adopt("konto-b");
    useNotifications.setState({ items: [notification("1")] });
    action.onClick();
    expect(issue).not.toHaveBeenCalled();
    expect(useNotifications.getState().items[0].read).toBe(false);
  });
});
