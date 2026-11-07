import { describe, expect, it } from "vitest";
import { JiraApiError } from "./client";
import { notificationSyncError, notificationSyncPhase } from "./notification-sync";

describe("notificationSyncPhase", () => {
  it("prüft nur mit aktivem Abruf und vorhandener Sitzung", () => {
    expect(notificationSyncPhase(undefined, true, true)).toBe("unavailable");
    expect(notificationSyncPhase({ status: "pending", fetchStatus: "idle" }, true, true)).toBe("unavailable");
    expect(notificationSyncPhase({ status: "success", fetchStatus: "idle" }, false, true)).toBe("unavailable");
  });

  it("meldet offline statt laufender Prüfung, wenn der Abruf pausiert", () => {
    expect(notificationSyncPhase({ status: "success", fetchStatus: "idle" }, true, false)).toBe("offline");
    expect(notificationSyncPhase({ status: "success", fetchStatus: "paused" }, true, true)).toBe("offline");
  });

  it("unterscheidet laufende Prüfung von prüfbereit, auch nach Fehler", () => {
    expect(notificationSyncPhase({ status: "pending", fetchStatus: "fetching" }, true, true)).toBe("checking");
    expect(notificationSyncPhase({ status: "error", fetchStatus: "fetching" }, true, true)).toBe("checking");
    expect(notificationSyncPhase({ status: "error", fetchStatus: "idle" }, true, true)).toBe("ready");
  });
});

describe("notificationSyncError", () => {
  it("zeigt Jira-Meldungen statt des rohen Antwortkörpers", () => {
    const error = new JiraApiError({ status: 503, body: JSON.stringify({ errorMessages: ["Wartung"], errors: {} }) });
    expect(notificationSyncError(error)).toBe("Wartung");
  });

  it("fällt ohne Jira-Meldung auf den Status zurück", () => {
    expect(notificationSyncError(new JiraApiError({ status: 418, body: JSON.stringify({ message: "x" }) }))).toBe("Jira antwortet mit 418.");
    expect(notificationSyncError(null)).toBe("");
  });
});
