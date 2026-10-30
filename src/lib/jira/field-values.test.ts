import { describe, expect, it } from "vitest";
import { JiraApiError } from "./client";
import { encode, initialValue, isEmpty, jiraErrors, kindOf, type JiraFieldMeta } from "./field-values";

const field = (schema: JiraFieldMeta["schema"], allowedValues?: unknown[]): JiraFieldMeta => ({
  required: false,
  name: "Feld",
  schema,
  ...(allowedValues && { allowedValues }),
});

const blankDoc = { type: "doc", version: 1, content: [{ type: "paragraph" }] };
const doc = { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: "Hallo" }] }] };

describe("kindOf", () => {
  it("leitet die Eingabeart aus dem Feldschema ab", () => {
    expect(kindOf(field({ type: "option" }, []))).toBe("single");
    expect(kindOf(field({ type: "array", items: "option" }, []))).toBe("multi");
    expect(kindOf(field({ type: "option-with-child" }, []))).toBe("cascade");
    expect(kindOf(field({ type: "user" }))).toBe("user");
    expect(kindOf(field({ type: "array", items: "user" }))).toBe("users");
    expect(kindOf(field({ type: "array", items: "string", system: "labels" }))).toBe("list");
    expect(kindOf(field({ type: "string", custom: "com.atlassian.jira.plugin.system.customfieldtypes:textarea" }))).toBe("richtext");
    expect(kindOf(field({ type: "string", system: "description" }))).toBe("richtext");
    expect(kindOf(field({ type: "string" }))).toBe("text");
    expect(kindOf(field({ type: "datetime" }))).toBe("datetime");
    expect(kindOf(field({ type: "sd-servicelevelagreement" }))).toBeUndefined();
  });
});

describe("encode", () => {
  it("schickt Referenzen statt ganzer Objekte", () => {
    expect(encode("single", { id: "10", value: "Web" })).toEqual({ id: "10" });
    expect(encode("multi", [{ id: "1", value: "a" }, { id: "2", value: "b" }])).toEqual([{ id: "1" }, { id: "2" }]);
    expect(encode("cascade", { id: "1", value: "A", child: { id: "2", value: "B" } })).toEqual({ id: "1", child: { id: "2" } });
    expect(encode("user", { accountId: "abc", displayName: "Leon" })).toEqual({ accountId: "abc" });
    expect(encode("users", [{ accountId: "a" }, { accountId: "b" }])).toEqual([{ accountId: "a" }, { accountId: "b" }]);
  });

  it("leert Felder mit null bzw. leerer Liste", () => {
    expect(encode("single", null)).toBeNull();
    expect(encode("user", null)).toBeNull();
    expect(encode("users", [])).toEqual([]);
    expect(encode("text", "")).toBeNull();
    expect(encode("number", "")).toBeNull();
    expect(encode("date", "")).toBeNull();
    expect(encode("datetime", "")).toBeNull();
    expect(encode("richtext", blankDoc)).toBeNull();
    expect(encode("richtext", null)).toBeNull();
  });

  it("wandelt Text-Eingaben in Jira-Typen um", () => {
    expect(encode("number", "3.5")).toBe(3.5);
    expect(encode("list", "a, b,, c ")).toEqual(["a", "b", "c"]);
    expect(encode("date", "2026-10-30")).toBe("2026-10-30");
    expect(encode("richtext", doc)).toBe(doc);
  });

  it("überträgt Datum mit Uhrzeit ohne Zeitverschiebung", () => {
    const local = initialValue("datetime", "2026-10-30T14:15:00.000+0100");
    const encoded = encode("datetime", local) as string;
    expect(encoded).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+0000$/);
    expect(new Date(encoded.replace("+0000", "Z")).getTime()).toBe(new Date("2026-10-30T13:15:00Z").getTime());
  });
});

describe("initialValue", () => {
  it("füllt mit dem aktuellen Wert vor", () => {
    expect(initialValue("richtext", doc)).toBe(doc);
    expect(initialValue("richtext", "kein ADF")).toBeNull();
    expect(initialValue("list", ["a", "b"])).toBe("a, b");
    expect(initialValue("number", 0)).toBe("0");
    expect(initialValue("multi", null)).toEqual([]);
    expect(initialValue("single", undefined)).toBeNull();
  });
});

describe("isEmpty", () => {
  it("erkennt leere Werte aller Arten", () => {
    for (const value of [null, undefined, "", [], blankDoc]) expect(isEmpty(value)).toBe(true);
    for (const value of [0, "x", [1], { id: "1" }, doc]) expect(isEmpty(value)).toBe(false);
  });
});

describe("jiraErrors", () => {
  it("verteilt Jira-Fehler auf Felder und allgemeine Meldungen", () => {
    const error = new JiraApiError({ status: 400, body: JSON.stringify({ errorMessages: ["Nope"], errors: { customfield_1: "Pflicht" } }) });
    expect(jiraErrors(error)).toEqual({ messages: ["Nope"], fields: { customfield_1: "Pflicht" } });
  });

  it("fällt bei unlesbaren Antworten auf die Fehlermeldung zurück", () => {
    expect(jiraErrors(new JiraApiError({ status: 502, body: "<html>" })).messages[0]).toContain("502");
    expect(jiraErrors(new Error("offline"))).toEqual({ messages: ["offline"], fields: {} });
    expect(jiraErrors(null)).toEqual({ messages: [], fields: {} });
  });
});
