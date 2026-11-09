import type { CreateField, CreateIssuePayload, CreateIssueType } from "./create-issue";
import { encode, initialValue, isEmpty, jiraErrors, kindOf, optionsOf, type Kind } from "./field-values";

export type CreateInput = { field: CreateField; kind: Kind };
export type CreatePlan = { description?: CreateField; inputs: CreateInput[]; blocked: CreateField[] };
export type CreateDraft = { summary: string; description: unknown; values: Record<string, unknown> };
export type CreateErrors = { global: string[]; fields: Record<string, string>; uncertain: boolean };

const HANDLED = new Set(["project", "issuetype", "summary", "description"]);
const OPTION_KINDS = new Set<Kind>(["single", "multi", "cascade"]);

const isSettable = (field: CreateField) => !field.operations?.length || field.operations.includes("set");

const inputKind = (field: CreateField) => {
  const kind = kindOf(field);
  if (!kind || !isSettable(field)) return undefined;
  return OPTION_KINDS.has(kind) && optionsOf(field).length === 0 ? undefined : kind;
};

export const planFields = (fields: readonly CreateField[]): CreatePlan => {
  const plan: CreatePlan = { description: fields.find((field) => field.fieldId === "description"), inputs: [], blocked: [] };
  for (const field of fields) {
    if (HANDLED.has(field.fieldId) || !field.required || field.hasDefaultValue) continue;
    const kind = inputKind(field);
    if (kind) plan.inputs.push({ field, kind });
    else plan.blocked.push(field);
  }
  return plan;
};

export const defaultIssueType = (types: readonly CreateIssueType[]) => types.find((type) => !type.subtask);

export const inputValue = (draft: CreateDraft, { field, kind }: CreateInput) =>
  field.fieldId in draft.values ? draft.values[field.fieldId] : initialValue(kind, undefined);

export const missingFields = (draft: CreateDraft, plan: CreatePlan) => [
  ...(draft.summary.trim() ? [] : ["summary"]),
  ...(plan.description?.required && isEmpty(draft.description) ? ["description"] : []),
  ...plan.inputs
    .filter((input) => isEmpty(encode(input.kind, inputValue(draft, input))))
    .map(({ field }) => field.fieldId),
];

export const createPayload = (projectId: string, issueTypeId: string, draft: CreateDraft, plan: CreatePlan): CreateIssuePayload => {
  const fields: Record<string, unknown> = {
    project: { id: projectId },
    issuetype: { id: issueTypeId },
    summary: draft.summary.trim(),
  };
  const description = plan.description ? encode("richtext", draft.description) : null;
  if (description) fields.description = description;
  for (const input of plan.inputs) {
    const value = encode(input.kind, inputValue(draft, input));
    if (!isEmpty(value)) fields[input.field.fieldId] = value;
  }
  return { fields };
};

const tagOf = (error: unknown) => (typeof error === "object" && error !== null ? (error as { _tag?: unknown })._tag : undefined);
const statusOf = (error: unknown) => (tagOf(error) === "JiraApiError" ? (error as { status: number }).status : undefined);

export const createErrors = (error: unknown, fields: readonly CreateField[], plan: CreatePlan): CreateErrors => {
  if (!error) return { global: [], fields: {}, uncertain: false };
  const parsed = jiraErrors(error);
  const shown = new Set(["summary", ...(plan.description ? ["description"] : []), ...plan.inputs.map(({ field }) => field.fieldId)]);
  const nameOf = (id: string) => fields.find((field) => field.fieldId === id)?.name ?? id;
  const atField: Record<string, string> = {};
  const global: string[] = [];
  if (statusOf(error) === 403) global.push("Dir fehlt die Berechtigung, in diesem Projekt Tickets zu erstellen.");
  const uncertain = tagOf(error) === "JiraAuthError" || tagOf(error) === "CreateIssueResponseError";
  if (tagOf(error) === "CreateIssueResponseError") global.push("Jira hat unerwartet geantwortet.");
  else global.push(...parsed.messages);
  for (const [id, message] of Object.entries(parsed.fields)) {
    if (shown.has(id)) atField[id] = message;
    else global.push(`${nameOf(id)}: ${message}`);
  }
  if (global.length === 0 && Object.keys(atField).length === 0) global.push("Ticket konnte nicht erstellt werden.");
  return { global, fields: atField, uncertain };
};

export const jiraCreateUrl = (siteUrl: string, projectId: string, issueTypeId?: string, summary = "") => {
  const params = new URLSearchParams({ pid: projectId });
  if (issueTypeId) params.set("issuetype", issueTypeId);
  if (summary.trim()) params.set("summary", summary.trim());
  return `${siteUrl.replace(/\/+$/, "")}/secure/CreateIssueDetails!init.jspa?${params}`;
};
