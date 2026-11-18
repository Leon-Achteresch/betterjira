import { isAdfDoc, isEditableAdf } from "./adf";
import { creationFieldScope, validatedCreationDraft, isEmptyCreationValue as isEmpty, type CreationDraft, type IssueTemplate, type TemplateApplicationReport } from "./create-issue-drafts";
import type { CreatePlan } from "./create-issue-form";

const CONTEXT_FIELDS = new Set(["project", "issuetype", "status", "parent", "summary", "description"]);

const validDate = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export const applyTemplateToTarget = (current: CreationDraft, template: IssueTemplate, target: {
  projectId: string;
  issueTypeId: string;
  plan: CreatePlan;
}): CreationDraft => {
  const scope = creationFieldScope(target.projectId, target.issueTypeId);
  const checked = validatedCreationDraft(template, target.plan).draft;
  const values = { ...current.values[scope] };
  const skipped: TemplateApplicationReport["skipped"][number][] = [];
  const appliedFields: string[] = [];
  for (const [fieldId, value] of Object.entries(template.values)) {
    const input = target.plan.inputs.find(({ field }) => field.fieldId === fieldId);
    const reason = CONTEXT_FIELDS.has(fieldId)
      ? "Projekt, Vorgangstyp, Status und übergeordnetes Ticket bleiben durch das Ziel vorgegeben."
      : !input
        ? "Dieses Feld wird im gewählten Ziel nicht zur Eingabe angeboten."
        : input.kind === "user" || input.kind === "users"
          ? "Die Verfügbarkeit dieser Person muss im Zielprojekt erneut geprüft werden. Bitte dort auswählen."
          : !(fieldId in checked.values) || (input.kind === "date" && !isEmpty(value) && !validDate(value))
            ? "Der Wert ist für dieses Zielfeld nicht gültig oder nicht mehr verfügbar."
            : undefined;
    if (reason) {
      if (!isEmpty(value)) skipped.push({ fieldId, label: input?.field.name ?? template.fieldNames?.[fieldId] ?? fieldId, value, reason });
    } else if (!isEmpty(value)) {
      values[fieldId] = value;
      appliedFields.push(fieldId);
    }
  }
  const canDescribe = !!target.plan.description && (!target.plan.description.operations?.length || target.plan.description.operations.includes("set"));
  const validDescription = isAdfDoc(template.description) && isEditableAdf(template.description);
  const description = canDescribe && validDescription && !isEmpty(template.description) ? template.description : current.description;
  if (canDescribe && validDescription && !isEmpty(template.description)) appliedFields.push("description");
  if (template.summary.trim()) appliedFields.push("summary");
  if (!isEmpty(template.description) && (!canDescribe || !validDescription)) {
    skipped.push({ fieldId: "description", label: "Beschreibung", value: template.description, reason: canDescribe ? "Die Beschreibung enthält kein gültiges ADF-Dokument." : "Der gewählte Vorgangstyp bietet keine bearbeitbare Beschreibung an." });
  }
  return {
    ...current,
    summary: template.summary.trim() ? template.summary : current.summary,
    description,
    values: { ...current.values, [scope]: values },
    templateReports: { ...current.templateReports, [scope]: {
      templateId: template.id, templateName: template.name, sourceProjectId: template.projectId, sourceIssueTypeId: template.issueTypeId, appliedFields, skipped,
    } },
  };
};

export const templateValueText = (value: unknown) => JSON.stringify(value, null, 2) ?? "Nicht gesetzt";
