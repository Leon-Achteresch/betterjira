import { describe, expect, it } from "vitest";
import type { JiraNotification } from "@/lib/jira/notifications";
import {
  activityAlertChannel,
  DEFAULT_ACTIVITY_ALERT_PREFS,
  alertableItems,
  alertMessage,
  parseActivityAlertPrefs,
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
    expect(parseActivityAlertPrefs({ inApp: false, system: true, watching: true })).toEqual({ inApp: false, system: true, watching: true });
  });

  it.each([undefined, null, "kaputt", 42, [], { inApp: "nein", system: 0 }])("fällt bei %j auf die Standardwerte zurück", (value) => {
    expect(parseActivityAlertPrefs(value)).toEqual(DEFAULT_ACTIVITY_ALERT_PREFS);
  });

  it("behält gültige Felder und ersetzt nur defekte", () => {
    expect(parseActivityAlertPrefs({ inApp: "x", system: false, extra: true })).toEqual({ inApp: true, system: false, watching: false });
  });
});

describe("activityAlertChannel", () => {
  it("entspricht mit Standardwerten dem bisherigen Verhalten", () => {
    expect(activityAlertChannel(true, DEFAULT_ACTIVITY_ALERT_PREFS)).toBe("in-app");
    expect(activityAlertChannel(false, DEFAULT_ACTIVITY_ALERT_PREFS)).toBe("system");
  });

  it("stoppt nur die ausgeschaltete Hinweisart und weicht nicht auf die andere aus", () => {
    const prefs = (inApp: boolean, system: boolean) => ({ inApp, system, watching: false });
    expect(activityAlertChannel(true, prefs(false, true))).toBeNull();
    expect(activityAlertChannel(false, prefs(false, true))).toBe("system");
    expect(activityAlertChannel(false, prefs(true, false))).toBeNull();
    expect(activityAlertChannel(true, prefs(true, false))).toBe("in-app");
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

describe("alertMessage", () => {
  it("fasst eine Abfrage zu genau einem Hinweis zusammen", () => {
    expect(alertMessage([])).toBeNull();
    expect(alertMessage([notification("1")])).toEqual({ title: "DEMO-1 · Sam", body: "hat kommentiert: Bitte prüfen", issueKey: "DEMO-1" });
    const sameIssue = [notification("1"), { ...notification("1"), id: "2", actor: { displayName: "Kim", avatarUrls: { "48x48": "" } } }];
    expect(alertMessage(sameIssue)).toEqual({ title: "DEMO-1 · Testticket", body: "2 Neuigkeiten von Sam und Kim", issueKey: "DEMO-1" });
    expect(alertMessage(["1", "2", "3", "4", "5"].map(notification))).toEqual({
      title: "5 Neuigkeiten in 5 Tickets",
      body: "DEMO-1, DEMO-2, DEMO-3 und 2 weitere",
      issueKey: null,
    });
  });
});

describe("alertableItems", () => {
  it("lässt beobachtete Tickets und Tickets in der Ruhezeit weg", () => {
    const items = [notification("1"), { ...notification("2"), kind: "watching" as const }, notification("3")];
    const cooldown = new Map([["DEMO-3", 1_000]]);
    expect(alertableItems(items, false, cooldown, 2_000).map((item) => item.id)).toEqual(["1"]);
    expect(alertableItems(items, true, cooldown, 2_000).map((item) => item.id)).toEqual(["1", "2"]);
    expect(alertableItems(items, false, cooldown, 1_000 + 5 * 60_000).map((item) => item.id)).toEqual(["1", "3"]);
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
