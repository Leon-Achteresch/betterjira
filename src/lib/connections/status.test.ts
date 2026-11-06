import { describe, expect, it } from "vitest";
import { checkState, lastReachable, outlookStatus, scmLabel } from "./status";

describe("checkState", () => {
  it("bleibt ungeprüft ohne Antwort und Fehler", () => {
    expect(checkState({ dataUpdatedAt: 0, errorUpdatedAt: 0, isFetching: false })).toBe("unchecked");
  });

  it("meldet eine laufende Prüfung vor jedem früheren Ergebnis", () => {
    expect(checkState({ dataUpdatedAt: 10, errorUpdatedAt: 20, isFetching: true })).toBe("checking");
  });

  it("wertet den jüngeren Fehler als fehlgeschlagene Prüfung trotz älterer Daten", () => {
    expect(checkState({ dataUpdatedAt: 10, errorUpdatedAt: 20, isFetching: false })).toBe("failed");
  });

  it("wertet eine spätere erfolgreiche Antwort wieder als erreichbar", () => {
    expect(checkState({ dataUpdatedAt: 30, errorUpdatedAt: 20, isFetching: false })).toBe("ok");
  });
});

describe("lastReachable", () => {
  it("nennt ohne Antwort keinen Zeitpunkt", () => {
    expect(lastReachable(0)).toBeNull();
  });

  it("nennt die Uhrzeit der letzten Antwort", () => {
    const today = new Date();
    today.setHours(9, 5, 0, 0);
    expect(lastReachable(today.getTime())).toBe("Zuletzt erreichbar um 09:05");
  });
});

describe("outlookStatus", () => {
  it("zeigt einen Fehler auch dann, wenn ein älteres Konto bekannt ist", () => {
    expect(outlookStatus({ isPending: false, paused: false, hasAccount: true, failed: true })).toBe("failed");
  });

  it("unterscheidet nicht verbunden und verbunden", () => {
    expect(outlookStatus({ isPending: false, paused: false, hasAccount: false, failed: false })).toBe("unconnected");
    expect(outlookStatus({ isPending: false, paused: false, hasAccount: true, failed: false })).toBe("connected");
  });

  it("behauptet offline ohne bekannten Stand weder verbunden noch getrennt", () => {
    expect(outlookStatus({ isPending: true, paused: true, hasAccount: false, failed: false })).toBe("waiting");
  });
});

describe("scmLabel", () => {
  it("unterscheidet keine und konfigurierte Verbindungen ohne Erreichbarkeit zu behaupten", () => {
    expect(scmLabel(0, false).label).toBe("Keine Verbindung");
    expect(scmLabel(0, true).label).toBe("Wird gelesen …");
    expect(scmLabel(2, true)).toEqual({ label: "2 konfiguriert", tone: "neutral" });
  });
});
