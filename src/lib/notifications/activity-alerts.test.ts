import { describe, expect, it } from "vitest";
import type { JiraNotification } from "@/lib/jira/notifications";
import {
  activityAlertChannel,
  DEFAULT_ACTIVITY_ALERT_PREFS,
  parseActivityAlertPrefs,
  systemAlertMessages,
  systemAlertStatus,
  systemAlertStillAllowed,
} from "./activity-alerts";

const notification = (id: string): JiraNotification => ({
  id,
  issueKey: `DEMO-${id}`,
  summary: "Testticket",
  created: 1,
  read: false,
  kind: "direct",
  title: "hat kommentiert",
  body: "Bitte prüfen",
  actor: { displayName: "Sam", avatarUrls: { "48x48": "" } },
});

describe("parseActivityAlertPrefs", () => {
  it("übernimmt gültige Werte", () => {
    expect(parseActivityAlertPrefs({ inApp: false, system: true })).toEqual({ inApp: false, system: true });
  });

  it.each([undefined, null, "kaputt", 42, [], { inApp: "nein", system: 0 }])("fällt bei %j auf die Standardwerte zurück", (value) => {
    expect(parseActivityAlertPrefs(value)).toEqual(DEFAULT_ACTIVITY_ALERT_PREFS);
  });

  it("behält gültige Felder und ersetzt nur defekte", () => {
    expect(parseActivityAlertPrefs({ inApp: "x", system: false, extra: true })).toEqual({ inApp: true, system: false });
  });
});

describe("activityAlertChannel", () => {
  it("entspricht mit Standardwerten dem bisherigen Verhalten", () => {
    expect(activityAlertChannel(true, DEFAULT_ACTIVITY_ALERT_PREFS)).toBe("in-app");
    expect(activityAlertChannel(false, DEFAULT_ACTIVITY_ALERT_PREFS)).toBe("system");
  });

  it("stoppt nur die ausgeschaltete Hinweisart und weicht nicht auf die andere aus", () => {
    expect(activityAlertChannel(true, { inApp: false, system: true })).toBeNull();
    expect(activityAlertChannel(false, { inApp: false, system: true })).toBe("system");
    expect(activityAlertChannel(false, { inApp: true, system: false })).toBeNull();
    expect(activityAlertChannel(true, { inApp: true, system: false })).toBe("in-app");
  });
});

describe("systemAlertStillAllowed", () => {
  const before = { system: true, systemEpoch: 3, owner: "a" };

  it("erlaubt die Zustellung bei unverändertem Stand", () => {
    expect(systemAlertStillAllowed(before, { ...before })).toBe(true);
  });

  it("verhindert die Zustellung nach Ausschalten, Aus-und-wieder-Ein oder Kontowechsel", () => {
    expect(systemAlertStillAllowed(before, { ...before, system: false, systemEpoch: 4 })).toBe(false);
    expect(systemAlertStillAllowed(before, { ...before, systemEpoch: 5 })).toBe(false);
    expect(systemAlertStillAllowed(before, { ...before, owner: "b" })).toBe(false);
    expect(systemAlertStillAllowed({ ...before, owner: null }, { ...before, owner: null })).toBe(false);
  });
});

describe("systemAlertMessages", () => {
  it("zeigt höchstens drei Einträge und fasst den Rest zusammen", () => {
    const messages = systemAlertMessages(["1", "2", "3", "4", "5"].map(notification));
    expect(messages).toHaveLength(4);
    expect(messages[0]).toEqual({ title: "DEMO-1 · Sam", body: "hat kommentiert: Bitte prüfen" });
    expect(messages[3]).toEqual({ title: "betterjira", body: "2 weitere Benachrichtigungen" });
    expect(systemAlertMessages([notification("1")])).toHaveLength(1);
  });
});

describe("systemAlertStatus", () => {
  it("leitet den angezeigten Status ab, ohne fehlende Berechtigung als verfügbar zu zeigen", () => {
    expect(systemAlertStatus(false, { isError: false, data: "granted" })).toBe("off");
    expect(systemAlertStatus(true, { isError: false, data: undefined })).toBe("checking");
    expect(systemAlertStatus(true, { isError: true, data: "granted" })).toBe("check-failed");
    expect(systemAlertStatus(true, { isError: false, data: "denied" })).toBe("denied");
    expect(systemAlertStatus(true, { isError: false, data: "prompt" })).toBe("prompt");
    expect(systemAlertStatus(true, { isError: false, data: "granted" })).toBe("granted");
  });
});
