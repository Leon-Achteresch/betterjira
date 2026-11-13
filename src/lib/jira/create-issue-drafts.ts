import { Schema } from "effect";
import { isAdfDoc } from "./adf";
import type { CreateDraft, CreateInput, CreatePlan } from "./create-issue-form";
import { isEmpty, optionsOf } from "./field-values";

export const CREATE_DRAFT_STORAGE_KEY = "betterjira-create-drafts";

export const CreationDraft = Schema.Struct({
  projectId: Schema.optional(Schema.String),
  issueTypeId: Schema.optional(Schema.String),
  summary: Schema.String,
  description: Schema.Unknown,
  values: Schema.Record(Schema.String, Schema.Record(Schema.String, Schema.Unknown)),
});

export type CreationDraft = typeof CreationDraft.Type;

export const IssueTemplate = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  projectId: Schema.String,
  issueTypeId: Schema.String,
  summary: Schema.String,
  description: Schema.Unknown,
  values: Schema.Record(Schema.String, Schema.Unknown),
});

export type IssueTemplate = typeof IssueTemplate.Type;

export const CreationWorkspace = Schema.Struct({
  draft: CreationDraft,
  templates: Schema.Array(IssueTemplate),
  parentDrafts: Schema.optional(Schema.Record(Schema.String, CreationDraft)),
});

export type CreationWorkspace = typeof CreationWorkspace.Type;

export const EMPTY_CREATION_DRAFT: CreationDraft = { summary: "", description: null, values: {} };
export const EMPTY_CREATION_WORKSPACE: CreationWorkspace = { draft: EMPTY_CREATION_DRAFT, templates: [] };

const Persisted = Schema.Struct({ workspaces: Schema.Record(Schema.String, Schema.Unknown) });
const OptionReference = Schema.Struct({ id: Schema.String, child: Schema.optional(Schema.Struct({ id: Schema.String })) });
const UserReference = Schema.Struct({ accountId: Schema.String });

export function readCreationWorkspaces(value: unknown): Record<string, CreationWorkspace> {
  if (!Schema.is(Persisted)(value)) return {};
  return Object.fromEntries(Object.entries(value.workspaces).filter((entry): entry is [string, CreationWorkspace] =>
    Schema.is(CreationWorkspace)(entry[1]),
  ));
}

export const creationFieldScope = (projectId: string | undefined, issueTypeId: string | undefined) =>
  JSON.stringify([projectId ?? "", issueTypeId ?? ""]);

export const hasCreationContent = (draft: CreationDraft) =>
  !!draft.summary.trim() || !isEmpty(draft.description) || Object.values(draft.values).some((fields) => Object.values(fields).some((value) => !isEmpty(value)));

function validInput(input: CreateInput, value: unknown, editing: boolean): boolean {
  const { kind, field } = input;
  if (isEmpty(value)) return true;
  if (kind === "richtext") return isAdfDoc(value);
  if (kind === "text" || kind === "list" || kind === "date") return typeof value === "string";
  if (kind === "datetime") return typeof value === "string" && (editing || Number.isFinite(new Date(value).getTime()));
  if (kind === "number") return (typeof value === "string" || typeof value === "number") && (editing || Number.isFinite(Number(value)));
  if (kind === "user") return Schema.is(UserReference)(value);
  if (kind === "users") return Schema.is(Schema.Array(UserReference))(value);
  const options = optionsOf(field);
  const validOption = (option: unknown) => Schema.is(OptionReference)(option) && options.some(({ id }) => id === option.id);
  if (kind === "multi") return Array.isArray(value) && value.every(validOption);
  if (!Schema.is(OptionReference)(value) || !validOption(value)) return false;
  if (kind !== "cascade" || !value.child) return true;
  return !!options.find(({ id }) => id === value.id)?.children?.some(({ id, disabled }) => !disabled && id === value.child?.id);
}

export function validatedCreationDraft(draft: CreateDraft, plan: CreatePlan, editing = false): { draft: CreateDraft; removed: string[] } {
  const values: Record<string, unknown> = {};
  const removed: string[] = [];
  for (const [id, value] of Object.entries(draft.values)) {
    const input = plan.inputs.find(({ field }) => field.fieldId === id);
    if (input && validInput(input, value, editing)) values[id] = value;
    else if (!isEmpty(value)) removed.push(input?.field.name ?? id);
  }
  const description = isAdfDoc(draft.description) ? draft.description : null;
  if (!isEmpty(draft.description) && !description) removed.push("Beschreibung");
  return { draft: { summary: draft.summary, description, values }, removed };
}

export function nextCreationDraft(draft: CreationDraft): CreationDraft {
  return { ...draft, summary: "", description: null };
}
