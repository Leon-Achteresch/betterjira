import { describe, expect, it } from "vitest";
import { JiraApiError, JiraAuthError, NotAuthenticated } from "./client";
import { issueLoadProblem, issueLoadState, loadedAtLabel } from "./issue-load";

const api = (status: number, errorMessages: string[] = []) => new JiraApiError({ status, body: JSON.stringify({ errorMessages }) });

describe("issueLoadProblem", () => {
  it("nennt 404 nicht sicher gelöscht und nicht abgemeldet", () => {
    const problem = issueLoadProblem(api(404, ["Issue does not exist or you do not have permission to see it."]));
    expect(problem.kind).toBe("not-found");
    expect(problem.description).toContain("kann verschoben, gelöscht oder für dein Konto nicht sichtbar sein");
    expect(problem.description).not.toMatch(/abgemeldet|wurde gelöscht/i);
    expect(problem.detail).toBe("Issue does not exist or you do not have permission to see it.");
  });

  it("behandelt 403 als fehlende Berechtigung bei bestehender Anmeldung", () => {
    const problem = issueLoadProblem(api(403));
    expect(problem.kind).toBe("forbidden");
    expect(problem.description).toContain("weiterhin angemeldet");
    expect(problem.detail).toBe("Jira antwortet mit 403: {\"errorMessages\":[]}");
  });

  it("ordnet vorübergehende Fehler, Netz und Sitzung zu", () => {
    expect(issueLoadProblem(api(503)).kind).toBe("unavailable");
    expect(issueLoadProblem(api(429)).kind).toBe("unavailable");
    expect(issueLoadProblem(api(408)).kind).toBe("unavailable");
    expect(issueLoadProblem(api(401)).kind).toBe("session");
    expect(issueLoadProblem(new NotAuthenticated()).kind).toBe("session");
    expect(issueLoadProblem(new JiraAuthError({ message: "Atlassian ist nicht erreichbar" }))).toMatchObject({
      kind: "connection",
      detail: "Atlassian ist nicht erreichbar",
    });
    expect(issueLoadProblem(api(400)).kind).toBe("unknown");
    expect(issueLoadProblem(new Error("Schema passt nicht")).detail).toBe("Schema passt nicht");
  });
});

describe("issueLoadState", () => {
  it("zeigt ohne Daten und Fehler den Ladezustand", () => {
    expect(issueLoadState({ data: undefined, error: null, loadedAt: 0 })).toEqual({ phase: "loading" });
  });

  it("zeigt einen ersten Fehler ohne Daten als eigenen Zustand", () => {
    const state = issueLoadState({ data: undefined, error: api(503), loadedAt: 0 });
    expect(state.phase).toBe("failed");
  });

  it("behält gecachte Daten bei einem Aktualisierungsfehler", () => {
    const state = issueLoadState({ data: { key: "DEMO-1" }, error: api(503, ["kaputt"]), loadedAt: 42 });
    expect(state).toMatchObject({ phase: "ready", data: { key: "DEMO-1" }, loadedAt: 42, refreshProblem: { kind: "unavailable", detail: "kaputt" } });
  });

  it("meldet nach erfolgreicher Aktualisierung kein Problem", () => {
    expect(issueLoadState({ data: "x", error: null, loadedAt: 1 })).toEqual({ phase: "ready", data: "x", refreshProblem: null, loadedAt: 1 });
  });
});

describe("loadedAtLabel", () => {
  it("zeigt am selben Tag nur die Uhrzeit", () => {
    const loaded = new Date(2026, 10, 7, 9, 5).getTime();
    expect(loadedAtLabel(loaded, new Date(2026, 10, 7, 18, 0).getTime())).toBe("Stand 09:05 Uhr");
  });

  it("nennt an anderen Tagen zusätzlich das Datum", () => {
    const loaded = new Date(2026, 10, 6, 23, 30).getTime();
    expect(loadedAtLabel(loaded, new Date(2026, 10, 7, 0, 10).getTime())).toBe("Stand 06.11.2026, 23:30 Uhr");
  });
});
