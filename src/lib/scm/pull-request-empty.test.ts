import { describe, expect, it } from "vitest";
import { pullRequestsEmptyText } from "./pull-request-empty";

const context = { query: "Login", filterLabel: "Offen", checksLabel: "Keine Angabe", partial: false };

describe("pullRequestsEmptyText", () => {
  it("keeps unknown check information distinct from successful checks", () => {
    const text = pullRequestsEmptyText({ ...context, reason: "checks" });
    expect(text.title).toBe("Keine Pull Requests mit Prüfstatus „Keine Angabe“");
    expect(text.title).not.toMatch(/erfolgreich|keine Tests/i);
    expect(text.description).toContain("nur für die geladenen Pull Requests");
  });

  it("keeps missing repositories visible in every empty state", () => {
    for (const reason of ["checks", "query", "status"] as const) {
      const text = pullRequestsEmptyText({ ...context, reason, partial: true });
      expect(text.description).toContain("Einige Repositories konnten nicht geladen werden.");
      expect(text.description).toContain("geladenen Pull Requests");
    }
  });

  it("names search and status independently", () => {
    expect(pullRequestsEmptyText({ ...context, reason: "query" }).title).toBe("Keine Treffer für „Login“");
    expect(pullRequestsEmptyText({ ...context, reason: "status" }).title).toBe("Keine Pull Requests mit Status „Offen“");
  });
});
