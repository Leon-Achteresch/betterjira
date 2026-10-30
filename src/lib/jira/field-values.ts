import { isAdfDoc, isBlankAdf } from "./adf";
import type { JiraEditField } from "./queries";

export type JiraFieldMeta = Omit<JiraEditField, "operations">;
export type JiraOption = { id: string; name?: string; value?: string; disabled?: boolean; children?: JiraOption[] };
type Ref = { id?: string; accountId?: string; child?: { id: string } | null };
export type Kind = "single" | "multi" | "cascade" | "user" | "users" | "text" | "richtext" | "number" | "date" | "datetime" | "list";

export const kindOf = (field: JiraFieldMeta): Kind | undefined => {
  const { type, items, system, custom } = field.schema;
  if (type === "option-with-child") return "cascade";
  if (field.allowedValues) return type === "array" ? "multi" : "single";
  if (type === "user") return "user";
  if (type === "array" && items === "user") return "users";
  if (type === "array" && items === "string") return "list";
  if (type === "string") {
    const rich = custom?.endsWith(":textarea") || system === "description" || system === "environment";
    return rich ? "richtext" : "text";
  }
  if (type === "number" || type === "date" || type === "datetime") return type;
  return undefined;
};

export const optionsOf = (field: JiraFieldMeta) =>
  (field.allowedValues ?? []).filter(
    (option): option is JiraOption =>
      typeof option === "object" && option !== null && typeof (option as JiraOption).id === "string" && !(option as JiraOption).disabled,
  );

export const labelOf = (option: JiraOption) => option.name ?? option.value ?? option.id;

const pad = (n: number) => String(n).padStart(2, "0");

export const toLocalInput = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const initialValue = (kind: Kind, current: unknown) => {
  if (kind === "richtext") return isAdfDoc(current) ? current : null;
  if (kind === "multi" || kind === "users") return Array.isArray(current) ? current : [];
  if (kind === "list") return Array.isArray(current) ? current.join(", ") : "";
  if (kind === "datetime") return typeof current === "string" ? toLocalInput(current) : "";
  if (kind === "number") return current == null ? "" : String(current);
  if (kind === "text" || kind === "date") return current ?? "";
  return current ?? null;
};

export const isEmpty = (value: unknown) =>
  value == null || value === "" || (Array.isArray(value) && value.length === 0) || (isAdfDoc(value) && isBlankAdf(value));

const toRef = (value: Ref) =>
  value.accountId ? { accountId: value.accountId } : value.child ? { id: value.id, child: { id: value.child.id } } : { id: value.id };

export const encode = (kind: Kind, value: unknown) => {
  if (kind === "text" || kind === "date") return value || null;
  if (kind === "richtext") return isEmpty(value) ? null : value;
  if (kind === "number") return value === "" ? null : Number(value);
  if (kind === "datetime") return value ? new Date(String(value)).toISOString().replace("Z", "+0000") : null;
  if (kind === "list") return String(value).split(",").map((item) => item.trim()).filter(Boolean);
  if (Array.isArray(value)) return value.map(toRef);
  return value ? toRef(value as Ref) : null;
};

export const jiraErrors = (error: unknown) => {
  if (!error) return { messages: [] as string[], fields: {} as Record<string, string> };
  if ((error as { _tag?: string })._tag === "JiraApiError") {
    try {
      const body = JSON.parse((error as { body: string }).body) as { errorMessages?: string[]; errors?: Record<string, string> };
      return { messages: body.errorMessages ?? [], fields: body.errors ?? {} };
    } catch {}
  }
  return { messages: [error instanceof Error ? error.message : String(error)], fields: {} as Record<string, string> };
};
