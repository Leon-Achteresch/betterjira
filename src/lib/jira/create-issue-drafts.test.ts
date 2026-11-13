import { describe, expect, it } from "vitest";
import { planFields, createPayload, missingFields } from "./create-issue-form";
import type { CreateField } from "./create-issue";
import {
  creationFieldScope,
  EMPTY_CREATION_DRAFT,
  EMPTY_CREATION_WORKSPACE,
  hasCreationContent,
  nextCreationDraft,
  readCreationWorkspaces,
  validatedCreationDraft,
} from "./create-issue-drafts";

const priority: CreateField = { fieldId: "priority", name: "Priorität", required: true, schema: { type: "priority" }, allowedValues: [{ id: "2", name: "Hoch" }, { id: "3", disabled: true }] };
const plan = planFields([priority, { fieldId: "customer", name: "Kunde", required: true, schema: { type: "string" } }]);

describe("Erstellungsentwürfe und Vorlagen", () => {
  it("isoliert Projekt-/Typ-Felder auch bei mehrdeutigen IDs", () => {
    expect(creationFieldScope("a/b", "c")).not.toBe(creationFieldScope("a", "b/c"));
    expect(creationFieldScope("a", "b")).not.toBe(creationFieldScope("b", "a"));
  });

  it("behält gültige Konten und verwirft beschädigte Speicherstände", () => {
    expect(readCreationWorkspaces(null)).toEqual({});
    expect(readCreationWorkspaces({ workspaces: { own: EMPTY_CREATION_WORKSPACE, broken: { draft: 17 } } })).toEqual({ own: EMPTY_CREATION_WORKSPACE });
  });

  it("entfernt gelöschte und deaktivierte Optionen vor Pflichtfeldprüfung und Payload", () => {
    for (const id of ["3", "deleted"]) {
      const { draft, removed } = validatedCreationDraft({ summary: "Titel", description: null, values: { priority: { id }, customer: "ACME", obsolete: "Alt" } }, plan);
      expect(removed).toEqual(["Priorität", "obsolete"]);
      expect(missingFields(draft, plan)).toEqual(["priority"]);
      expect(createPayload("1", "2", draft, plan).fields).toEqual({ project: { id: "1" }, issuetype: { id: "2" }, summary: "Titel", customer: "ACME" });
    }
  });

  it("behält gültige Werte, akzeptiert aber keine falschen Eingabetypen", () => {
    const valid = validatedCreationDraft({ summary: "Titel", description: null, values: { priority: { id: "2" }, customer: "ACME" } }, plan);
    expect(valid.removed).toEqual([]);
    const invalid = validatedCreationDraft({ summary: "Titel", description: { arbitrary: true }, values: { priority: "2", customer: { id: "wrong" } } }, plan);
    expect(invalid.draft).toEqual({ summary: "Titel", description: null, values: {} });
    expect(invalid.removed).toEqual(["Priorität", "Kunde", "Beschreibung"]);
  });

  it("erkennt unbekannte Kaskadenwerte, ungültige Zahlen und Zeitpunkte", () => {
    const fields: CreateField[] = [
      { fieldId: "choice", name: "Auswahl", required: true, schema: { type: "option-with-child" }, allowedValues: [{ id: "parent", children: [{ id: "child" }] }] },
      { fieldId: "points", name: "Punkte", required: true, schema: { type: "number" } },
      { fieldId: "time", name: "Zeit", required: true, schema: { type: "datetime" } },
    ];
    const result = validatedCreationDraft({ summary: "T", description: null, values: { choice: { id: "parent", child: { id: "gone" } }, points: "NaN", time: "not-a-date" } }, planFields(fields));
    expect(result.draft.values).toEqual({});
    expect(result.removed).toEqual(["Auswahl", "Punkte", "Zeit"]);
  });

  it("behält bei Weitererfassung den Kontext und leert Titel und Beschreibung", () => {
    const scope = creationFieldScope("1", "2");
    const before = { projectId: "1", issueTypeId: "2", summary: "Fertig", description: { type: "doc", version: 1, content: [] }, values: { [scope]: { customer: "ACME" } } };
    const after = nextCreationDraft(before);
    expect(after).toEqual({ ...before, summary: "", description: null });
    expect(after.values).toBe(before.values);
    expect(hasCreationContent(after)).toBe(true);
    expect(hasCreationContent(EMPTY_CREATION_DRAFT)).toBe(false);
  });

  it("lässt Zwischenstände beim Tippen zu, aber überträgt keine ungültigen Zahlen", () => {
    const plan = planFields([{ fieldId: "number", name: "Zahl", required: true, schema: { type: "number" } }]);
    const input = { summary: "T", description: null, values: { number: "-" } };
    expect(validatedCreationDraft(input, plan, true).draft.values.number).toBe("-");
    expect(missingFields(validatedCreationDraft(input, plan).draft, plan)).toEqual(["number"]);
  });
});
