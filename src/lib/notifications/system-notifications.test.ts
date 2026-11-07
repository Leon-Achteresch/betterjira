import { beforeEach, describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
import { readSystemPermission, requestSystemPermission, sendSystemNotification, SystemNotificationError } from "./system-notifications";

const plugin = vi.hoisted(() => ({
  isPermissionGranted: vi.fn<() => Promise<unknown>>(),
  requestPermission: vi.fn<() => Promise<unknown>>(),
  sendNotification: vi.fn<(options: unknown) => void>(),
}));
vi.mock("@tauri-apps/plugin-notification", () => plugin);

const failure = async (effect: Effect.Effect<unknown, SystemNotificationError>) => {
  const error = await Effect.runPromise(Effect.flip(effect));
  expect(error).toBeInstanceOf(SystemNotificationError);
  return error.message;
};

beforeEach(() => {
  plugin.isPermissionGranted.mockReset();
  plugin.requestPermission.mockReset();
  plugin.sendNotification.mockReset();
});

describe("readSystemPermission", () => {
  it.each([
    [true, "granted"],
    [false, "denied"],
    [null, "prompt"],
  ])("liest %j als %s, ohne eine Berechtigung anzufordern", async (answer, expected) => {
    plugin.isPermissionGranted.mockResolvedValue(answer);
    expect(await Effect.runPromise(readSystemPermission)).toBe(expected);
    expect(plugin.requestPermission).not.toHaveBeenCalled();
  });

  it("meldet unbekannte Antworten und Ausfälle als getaggten Fehler", async () => {
    plugin.isPermissionGranted.mockResolvedValue("ja");
    expect(await failure(readSystemPermission)).toContain("unbekannten Berechtigungsstatus");
    plugin.isPermissionGranted.mockRejectedValue(new Error("IPC weg"));
    expect(await failure(readSystemPermission)).toContain("nicht gelesen werden");
  });
});

describe("requestSystemPermission", () => {
  it.each([
    ["granted", "granted"],
    ["denied", "denied"],
    ["default", "prompt"],
    ["prompt", "prompt"],
    ["prompt-with-rationale", "prompt"],
  ])("ordnet %s als %s ein", async (answer, expected) => {
    plugin.requestPermission.mockResolvedValue(answer);
    expect(await Effect.runPromise(requestSystemPermission)).toBe(expected);
  });

  it("meldet Ablehnung des Aufrufs und unbekannte Antworten als Fehler", async () => {
    plugin.requestPermission.mockRejectedValue(new Error("abgebrochen"));
    expect(await failure(requestSystemPermission)).toContain("Anfrage an das System");
    plugin.requestPermission.mockResolvedValue(undefined);
    expect(await failure(requestSystemPermission)).toContain("unbekannte Antwort");
  });
});

describe("sendSystemNotification", () => {
  it("reicht Titel und Text durch und fängt synchrone Fehler ab", async () => {
    await Effect.runPromise(sendSystemNotification({ title: "DEMO-1", body: "Text" }));
    expect(plugin.sendNotification).toHaveBeenCalledWith({ title: "DEMO-1", body: "Text" });
    plugin.sendNotification.mockImplementation(() => {
      throw new Error("kein Fenster");
    });
    expect(await failure(sendSystemNotification({ title: "x", body: "y" }))).toContain("nicht angezeigt");
  });
});
