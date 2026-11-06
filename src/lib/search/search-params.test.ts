import { describe, expect, it } from "vitest";
import { QUERY_MAX_LENGTH, parseSucheSearch, searchModeOf, withMode } from "./search-params";

describe("parseSucheSearch", () => {
  it("öffnet alte JQL-Links weiter im JQL-Modus", () => {
    const search = parseSucheSearch({ jql: 'project = "DEMO" ORDER BY updated DESC' });
    expect(search).toEqual({ jql: 'project = "DEMO" ORDER BY updated DESC' });
    expect(searchModeOf(search)).toBe("jql");
  });

  it("startet ohne Parameter einfach", () => {
    expect(parseSucheSearch({})).toEqual({});
    expect(searchModeOf({})).toBe("einfach");
  });

  it("überschreibt ungültige Werte explizit, damit keine Rohwerte durchsickern", () => {
    const search = parseSucheSearch({ projekt: "nicht gültig!", q: "  " });
    expect(Object.keys(search).sort()).toEqual(["jql", "modus", "projekt", "q"]);
    expect(search.projekt).toBeUndefined();
  });

  it("verwirft unbekannte und ungültige Parameter", () => {
    expect(parseSucheSearch({ foo: "bar", modus: "experte", jql: "  ", projekt: 'DEMO" OR 1=1', q: ["a"] })).toEqual({});
    expect(parseSucheSearch({ jql: 42, projekt: "1ABC" })).toEqual({});
  });

  it("normalisiert Projekt und Suchtext", () => {
    expect(parseSucheSearch({ projekt: " demo ", q: "  Login Fehler " })).toEqual({ projekt: "DEMO", q: "Login Fehler" });
    expect(parseSucheSearch({ q: 1234 })).toEqual({ q: "1234" });
    expect(parseSucheSearch({ q: "x".repeat(QUERY_MAX_LENGTH + 20) }).q).toHaveLength(QUERY_MAX_LENGTH);
  });

  it("behält eine gemerkte JQL im einfachen Modus", () => {
    const search = parseSucheSearch({ modus: "einfach", jql: "assignee = currentUser()", q: "login" });
    expect(search).toEqual({ modus: "einfach", jql: "assignee = currentUser()", q: "login" });
    expect(searchModeOf(search)).toBe("einfach");
  });

  it("lässt den abgeleiteten Modus aus der URL heraus", () => {
    expect(parseSucheSearch({ modus: "jql", jql: "a = 1" })).toEqual({ jql: "a = 1" });
    expect(parseSucheSearch({ modus: "einfach" })).toEqual({});
    expect(parseSucheSearch({ modus: "jql" })).toEqual({ modus: "jql" });
  });
});

describe("withMode", () => {
  it("wechselt ohne Daten zu verlieren", () => {
    const simple = { projekt: "DEMO", q: "login", jql: "a = 1", modus: "einfach" as const };
    expect(withMode(simple, "jql")).toEqual({ projekt: "DEMO", q: "login", jql: "a = 1" });
    expect(withMode({ projekt: "DEMO", jql: "a = 1" }, "einfach")).toEqual({ projekt: "DEMO", jql: "a = 1", modus: "einfach" });
  });

  it("übernimmt nur bekannte Parameter", () => {
    const raw = { q: "x", foo: "bar" };
    expect(withMode(raw, "einfach")).toEqual({ q: "x" });
  });

  it("entfernt leere Werte", () => {
    expect(withMode({ jql: undefined, q: "x" }, "jql")).toEqual({ q: "x", modus: "jql" });
  });
});
