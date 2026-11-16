import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import fixture from "../../../tests/jira/fixtures/template-target.json";
import rich from "../../../tests/jira/fixtures/description-conflict.json";
import { CreateField } from "./create-issue";
import { IssueTemplate, creationFieldScope, hasCreationContent, readCreationWorkspaces, type CreationDraft } from "./create-issue-drafts";
import { createPayload, planFields } from "./create-issue-form";
import { applyTemplateToTarget, templateValueText } from "./template-application";

const template = Schema.decodeUnknownSync(IssueTemplate)(fixture.template);
const fields = Schema.decodeUnknownSync(Schema.Array(CreateField))(fixture.fields);
const target = { projectId: "target", issueTypeId: "target-type", plan: planFields(fields) };
const scope = creationFieldScope(target.projectId, target.issueTypeId);
const current: CreationDraft = { projectId: "target", issueTypeId: "target-type", summary: "Eigen", description: null,
  values: { [scope]: { customer: "Alt", points: "3", due: "2026-11-17", assignee: { accountId: "target-user" } }, other: { keep: "erhalten" } },
};

describe("Vorlage im tatsächlichen Zielkontext", () => {
  it("übernimmt nur gültige Zielfelder und ändert Projekt, Typ und Quellvorlage nicht", () => {
    const snapshot = JSON.stringify(template);
    const result = applyTemplateToTarget(current, template, target);
    expect(result).toMatchObject({ projectId: "target", issueTypeId: "target-type", summary: "Aus der Vorlage", description: template.description });
    expect(result.values[scope]).toEqual({ customer: "ACME", priority: template.values.priority, points: "3", due: "2026-11-17", assignee: { accountId: "target-user" } });
    expect(result.values.other).toBe(current.values.other);
    expect(JSON.stringify(template)).toBe(snapshot);
    expect(current.summary).toBe("Eigen");
  });

  it("behält abgelehnte Rohwerte mit Grund und Quellnamen persistent, selbst wenn die Quelle entfernt wird", () => {
    const result = applyTemplateToTarget(current, template, target);
    const workspace = { draft: result, templates: [] };
    const restored = readCreationWorkspaces(JSON.parse(JSON.stringify({ workspaces: { account: workspace } }))).account;
    const skipped = restored.draft.templateReports?.[scope].skipped ?? [];
    expect(skipped.map((entry) => entry.fieldId)).toEqual(["project", "issuetype", "status", "points", "due", "assignee", "choice", "old_field"]);
    for (const entry of skipped) {
      expect(entry.value).toEqual(template.values[entry.fieldId]);
      expect(entry.reason.length).toBeGreaterThan(0);
    }
    expect(skipped.at(-1)?.label).toBe("Altes Quellfeld");
    expect(restored.templates).toEqual([]);
    expect(hasCreationContent(restored.draft)).toBe(true);
  });

  it("ersetzt entfernte/deaktivierte Optionen und ungültige Kaskaden nicht durch andere IDs", () => {
    for (const id of ["gone", "disabled"]) {
      const result = applyTemplateToTarget(current, { ...template, values: { priority: { id }, choice: template.values.choice } }, target);
      expect(result.values[scope]).not.toHaveProperty("priority");
      expect(result.values[scope]).not.toHaveProperty("choice");
      expect(result.templateReports?.[scope].skipped.map((entry) => entry.fieldId)).toEqual(["priority", "choice"]);
    }
  });

  it("bewahrt die eigene Beschreibung, wenn das Ziel sie nicht anbietet, und erklärt die Quelle verlustfrei", () => {
    const own = { type: "doc", version: 1, content: [{ type: "paragraph" }] };
    const noDescription = { ...target, plan: planFields(fields.filter((field) => field.fieldId !== "description")) };
    const result = applyTemplateToTarget({ ...current, description: own }, template, noDescription);
    expect(result.description).toBe(own);
    expect(result.templateReports?.[scope].skipped.at(-1)).toMatchObject({ fieldId: "description", value: template.description });
  });

  it("markiert ungültige Beschreibung und falsche Feldtypen, ohne vorhandene Zielwerte zu löschen", () => {
    const result = applyTemplateToTarget(current, { ...template, description: { invalid: true }, values: { customer: { id: "not-text" } } }, target);
    expect(result.values[scope].customer).toBe("Alt");
    expect(result.templateReports?.[scope].skipped.map((entry) => entry.fieldId)).toEqual(["customer", "description"]);
  });

  it("behält Medien, Mentions und Tabellen originalgetreu und weist strukturell defekte Dokumente zurück", () => {
    const result = applyTemplateToTarget(current, { ...template, description: rich.base }, target);
    expect(result.description).toBe(rich.base);
    const invalid = { type: "doc", content: "kein Knotenarray" };
    const blocked = applyTemplateToTarget(current, { ...template, description: invalid }, target);
    expect(blocked.description).toBe(current.description);
    expect(blocked.templateReports?.[scope].skipped.at(-1)?.value).toBe(invalid);
  });

  it("setzt Berichte und Felder getrennt nach tatsächlichem Ziel ab", () => {
    const first = applyTemplateToTarget(current, template, target);
    const otherTarget = { ...target, projectId: "other", issueTypeId: "other-type" };
    const otherScope = creationFieldScope("other", "other-type");
    const second = applyTemplateToTarget({ ...first, projectId: "other", issueTypeId: "other-type" }, template, otherTarget);
    expect(second.values[scope]).toBe(first.values[scope]);
    expect(second.templateReports?.[scope]).toBe(first.templateReports?.[scope]);
    expect(second.values[otherScope].customer).toBe("ACME");
    expect(second.projectId).toBe("other");
  });

  it("sendet weder Berichte noch verworfene Kontextwerte im Erstellungspayload", () => {
    const result = applyTemplateToTarget(current, template, target);
    const payload = createPayload("target", "target-type", { ...result, values: result.values[scope] }, target.plan);
    expect(payload.fields.project).toEqual({ id: "target" });
    expect(payload.fields.issuetype).toEqual({ id: "target-type" });
    expect(payload.fields).not.toHaveProperty("status");
    expect(payload.fields).not.toHaveProperty("templateReports");
    expect(payload.fields).not.toHaveProperty("old_field");
    expect(payload.fields.assignee).toEqual({ accountId: "target-user" });
  });

  it("erhält auch nur abgelehnte Werte als lokalen Entwurfsinhalt und formatiert Rohwerte eindeutig", () => {
    const result = applyTemplateToTarget({ summary: "", description: null, values: {} }, { ...template, summary: "", description: null, values: { obsolete: { id: "lost" } } }, target);
    expect(hasCreationContent(result)).toBe(true);
    expect(result.templateReports?.[scope].appliedFields).toEqual([]);
    expect(templateValueText({ id: "lost" })).toBe('{\n  "id": "lost"\n}');
    expect(templateValueText("  Original\nText")).toBe('"  Original\\nText"');
  });
});
