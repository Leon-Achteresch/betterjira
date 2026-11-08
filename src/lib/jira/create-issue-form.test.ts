import { describe, expect, it } from "vitest";
import { JiraApiError, JiraAuthError } from "./client";
import { CreateIssueResponseError, type CreateField } from "./create-issue";
import { createErrors, createPayload, defaultIssueType, jiraCreateUrl, missingFields, planFields, type CreateDraft } from "./create-issue-form";

const field = (fieldId: string, schema: CreateField["schema"], extra: Partial<CreateField> = {}): CreateField => ({
  fieldId,
  name: fieldId,
  required: true,
  schema,
  operations: ["set"],
  ...extra,
});

const doc = { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: "Details" }] }] };
const blankDoc = { type: "doc", version: 1, content: [{ type: "paragraph" }] };

const FIELDS = [
  field("summary", { type: "string", system: "summary" }),
  field("issuetype", { type: "issuetype", system: "issuetype" }, { allowedValues: [{ id: "1" }] }),
  field("project", { type: "project", system: "project" }, { allowedValues: [{ id: "10000" }] }),
  field("description", { type: "string", system: "description" }, { required: false }),
  field("reporter", { type: "user", system: "reporter" }, { hasDefaultValue: true }),
  field("priority", { type: "priority", system: "priority" }, { allowedValues: [{ id: "3", name: "Mittel" }] }),
  field("customfield_10", { type: "string", custom: "com.atlassian.jira.plugin.system.customfieldtypes:textfield" }),
  field("labels", { type: "array", items: "string", system: "labels" }, { required: false }),
];

const draft = (patch: Partial<CreateDraft> = {}): CreateDraft => ({ summary: "", description: null, values: {}, ...patch });

describe("planFields", () => {
  it("zeigt nur eigene Pflichtfelder ohne Standardwert", () => {
    const plan = planFields(FIELDS);
    expect(plan.description?.fieldId).toBe("description");
    expect(plan.inputs.map(({ field, kind }) => [field.fieldId, kind])).toEqual([
      ["priority", "single"],
      ["customfield_10", "text"],
    ]);
    expect(plan.blocked).toEqual([]);
  });

  it("sperrt nicht unterstützte Pflichtfelder statt Werte zu raten", () => {
    const plan = planFields([
      field("customfield_team", { type: "team", custom: "com.atlassian.teams:rm-teams-custom-field-team" }),
      field("customfield_choice", { type: "option" }, { allowedValues: [] }),
      field("parent", { type: "issuelink", system: "parent" }),
      field("customfield_sprint", { type: "array", items: "json", custom: "com.pyxis.greenhopper.jira:gh-sprint" }, { required: false }),
    ]);
    expect(plan.inputs).toEqual([]);
    expect(plan.blocked.map((entry) => entry.fieldId)).toEqual(["customfield_team", "customfield_choice", "parent"]);
  });

  it("findet den ersten Nicht-Unteraufgaben-Typ ohne festen Namen", () => {
    expect(defaultIssueType([{ id: "5", name: "Sub", subtask: true }, { id: "9", name: "Anything" }])?.id).toBe("9");
    expect(defaultIssueType([{ id: "5", name: "Sub", subtask: true }])).toBeUndefined();
  });
});

describe("Pflichtfelder und Payload", () => {
  const plan = planFields(FIELDS);

  it("meldet fehlenden Titel und leere Pflichtfelder", () => {
    expect(missingFields(draft({ summary: "  " }), plan)).toEqual(["summary", "priority", "customfield_10"]);
    expect(missingFields(draft({ summary: "Titel", values: { priority: { id: "3" }, customfield_10: "x" } }), plan)).toEqual([]);
  });

  it("prüft eine verpflichtende Beschreibung als ADF", () => {
    const required = planFields(FIELDS.map((entry) => (entry.fieldId === "description" ? { ...entry, required: true } : entry)));
    const values = { priority: { id: "3" }, customfield_10: "x" };
    expect(missingFields(draft({ summary: "T", description: blankDoc, values }), required)).toEqual(["description"]);
    expect(missingFields(draft({ summary: "T", description: doc, values }), required)).toEqual([]);
  });

  it("baut den Payload nur aus Feldern der aktuellen Metadaten", () => {
    const payload = createPayload(
      "10000",
      "1",
      draft({
        summary: "  Neues Ticket ",
        description: doc,
        values: { priority: { id: "3", name: "Mittel" }, customfield_10: "Kunde", stale_field: "alt" },
      }),
      plan,
    );
    expect(payload).toEqual({
      fields: {
        project: { id: "10000" },
        issuetype: { id: "1" },
        summary: "Neues Ticket",
        description: doc,
        priority: { id: "3" },
        customfield_10: "Kunde",
      },
    });
  });

  it("lässt leere Beschreibung und Beschreibung ohne Metadaten weg", () => {
    expect(createPayload("1", "2", draft({ summary: "T", description: blankDoc }), plan).fields).not.toHaveProperty("description");
    const withoutDescription = planFields(FIELDS.filter((entry) => entry.fieldId !== "description"));
    expect(createPayload("1", "2", draft({ summary: "T", description: doc }), withoutDescription).fields).not.toHaveProperty("description");
  });
});

describe("createErrors", () => {
  const plan = planFields(FIELDS);
  const body = (value: unknown) => JSON.stringify(value);

  it("ordnet 400-Feldfehler dem Feld zu und fremde Felder global", () => {
    const error = new JiraApiError({
      status: 400,
      body: body({ errorMessages: ["Bitte prüfen"], errors: { customfield_10: "Wert ungültig", components: "Pflicht", summary: "Zu lang" } }),
    });
    expect(createErrors(error, FIELDS, plan)).toEqual({
      global: ["Bitte prüfen", "components: Pflicht"],
      fields: { customfield_10: "Wert ungültig", summary: "Zu lang" },
      uncertain: false,
    });
  });

  it("erklärt fehlende Berechtigung bei 403", () => {
    const error = new JiraApiError({ status: 403, body: body({ errorMessages: [], errors: {} }) });
    expect(createErrors(error, FIELDS, plan).global[0]).toMatch(/Berechtigung/);
  });

  it("nennt Netz- und Antwortfehler als unsicher, ohne doppeltes Erstellen nahezulegen", () => {
    expect(createErrors(new JiraAuthError({ message: "Atlassian ist nicht erreichbar" }), FIELDS, plan)).toMatchObject({
      global: ["Atlassian ist nicht erreichbar"],
      uncertain: true,
    });
    expect(createErrors(new CreateIssueResponseError(), FIELDS, plan).uncertain).toBe(true);
    expect(createErrors(new JiraApiError({ status: 503, body: "<html>" }), FIELDS, plan).global[0]).toMatch(/503/);
  });

  it("liefert ohne Fehler nichts", () => {
    expect(createErrors(null, FIELDS, plan)).toEqual({ global: [], fields: {}, uncertain: false });
  });
});

describe("jiraCreateUrl", () => {
  it("öffnet den Jira-Erstellen-Dialog mit Projekt, Typ und Titel", () => {
    expect(jiraCreateUrl("https://acme.atlassian.net/", "10000", "1", " Titel & mehr ")).toBe(
      "https://acme.atlassian.net/secure/CreateIssueDetails!init.jspa?pid=10000&issuetype=1&summary=Titel+%26+mehr",
    );
  });
});
