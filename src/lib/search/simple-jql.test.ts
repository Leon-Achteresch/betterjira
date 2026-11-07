import { describe, expect, it } from "vitest";
import { ALL_PROJECTS_JQL, projectClause, searchTerms, simpleSearchJql } from "./simple-jql";

describe("searchTerms", () => {
  it("entfernt Zeichen, die die Jira-Textsuche ablehnt", () => {
    expect(searchTerms('Login "Fehler" (Safari) *')).toBe("Login Fehler Safari");
    expect(searchTerms("*?\\")).toBe("");
    expect(searchTerms("-a- b")).toBe("a b");
  });

  it("lässt Schlüssel und Bindestriche im Wort stehen", () => {
    expect(searchTerms("DEMO-12 e-mail")).toBe("DEMO-12 e-mail");
  });
});

describe("simpleSearchJql", () => {
  it("durchsucht ohne Projekt alle zugänglichen Projekte", () => {
    expect(simpleSearchJql(undefined, "")).toBe(`${ALL_PROJECTS_JQL} ORDER BY updated DESC`);
  });

  it("begrenzt auf ein Projekt und ergänzt den Suchtext", () => {
    expect(simpleSearchJql("DEMO", "login")).toBe('project = "DEMO" AND text ~ "login*" ORDER BY updated DESC');
  });

  it("schreibt Projekt und Text nur maskiert in die JQL", () => {
    expect(projectClause('A" OR project = "B')).toBe('project = "A\\" OR project = \\"B"');
    expect(simpleSearchJql(undefined, '") OR (1 = 1')).toBe(`${ALL_PROJECTS_JQL} AND text ~ "OR 1 = 1*" ORDER BY updated DESC`);
  });

  it("sendet ungültigen Text nicht als Bedingung", () => {
    expect(simpleSearchJql("DEMO", "***")).toBe('project = "DEMO" ORDER BY updated DESC');
  });
});
