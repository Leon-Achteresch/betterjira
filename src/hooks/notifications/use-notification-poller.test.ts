import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JiraNotification } from "@/lib/jira/notifications";
import { useActivityAlertPrefs } from "./use-activity-alert-prefs";
import { deliverActivityAlerts } from "./use-notification-poller";
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

const openIssue = () => undefined;

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
  useActivityAlertPrefs.setState({ inApp: true, system: true, systemEpoch: 0 });
  useNotifications.setState({ owner: "konto-a", items: [], checkedAt: 1 });
});

describe("deliverActivityAlerts", () => {
  it("zeigt mit Standardwerten Popups in der App und Systemhinweise im Hintergrund", async () => {
    await deliverActivityAlerts(["1", "2", "3", "4"].map(notification), true, openIssue);
    expect(sonner.toast).toHaveBeenCalledTimes(3);
    expect(native.isPermissionGranted).not.toHaveBeenCalled();

    await deliverActivityAlerts(["5", "6", "7", "8"].map(notification), false, openIssue);
    expect(native.sendNotification).toHaveBeenCalledTimes(4);
    expect(native.requestPermission).not.toHaveBeenCalled();
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
