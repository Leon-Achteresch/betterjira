import { describe, expect, it } from "vitest";
import { branchNameFor, mentionsIssue } from "./issue-key";

describe("mentionsIssue", () => {
  it("findet den Key in Titeln und Branch-Namen", () => {
    expect(mentionsIssue("ABC-12: Login reparieren", "ABC-12")).toBe(true);
    expect(mentionsIssue("feature/abc-12-login", "ABC-12")).toBe(true);
  });

  it("verwechselt keine längeren Keys", () => {
    expect(mentionsIssue("ABC-123 Login", "ABC-12")).toBe(false);
    expect(mentionsIssue("XABC-12 Login", "ABC-12")).toBe(false);
  });
});

describe("branchNameFor", () => {
  it("baut einen Branch aus Key und Titel", () => {
    expect(branchNameFor("ABC-12", "Größe der Übersicht anpassen!")).toBe("feature/ABC-12-grosse-der-ubersicht-anpassen");
  });

  it("kommt ohne Titel aus", () => {
    expect(branchNameFor("ABC-12", "!!!")).toBe("feature/ABC-12");
  });
});
