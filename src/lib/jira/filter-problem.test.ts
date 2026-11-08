import { describe, expect, it } from "vitest";
import { JiraApiError, JiraAuthError } from "./client";
import { filterProblem } from "./filter-problem";

const apiError = (status: number) => new JiraApiError({ status, body: JSON.stringify({ errorMessages: [`Antwort ${status}`] }) });

describe("filter problem", () => {
  it("names a 404 as not found without claiming deletion or logout", () => {
    const problem = filterProblem(apiError(404));
    expect(problem.description).toContain("404");
    expect(`${problem.title} ${problem.description}`).not.toMatch(/gelöscht|abgemeldet|anmelden/i);
    expect(problem.detail).toBe("Antwort 404");
  });

  it("keeps the session for a 403", () => {
    const problem = filterProblem(apiError(403));
    expect(problem.description).toContain("403");
    expect(problem.description).toContain("Anmeldung bleibt bestehen");
    expect(problem.title).not.toMatch(/gelöscht/i);
  });

  it("treats server and network failures as temporary", () => {
    expect(filterProblem(apiError(503)).title).toBe("Filter konnte nicht geladen werden");
    const offline = filterProblem(new JiraAuthError({ message: "Atlassian ist nicht erreichbar" }));
    expect(offline.title).toBe("Filter konnte nicht geladen werden");
    expect(offline.detail).toBe("Atlassian ist nicht erreichbar");
  });
});
