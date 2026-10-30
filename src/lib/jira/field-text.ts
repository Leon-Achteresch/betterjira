import { isAdfDoc, type AdfNode } from "./adf";

const adfText = (node: AdfNode): string =>
  node.text ?? (node.content ?? []).map(adfText).join(node.type === "paragraph" ? "" : " ").trim();

const LABEL_KEYS = ["displayName", "name", "value", "key"] as const;

export const fieldText = (value: unknown): string => {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(fieldText).filter(Boolean).join(", ");
  if (isAdfDoc(value)) return adfText(value).replace(/\s+/g, " ");
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const label = LABEL_KEYS.map((key) => record[key]).find((item) => typeof item === "string");
    const child = record.child ? fieldText(record.child) : "";
    return [label, child].filter(Boolean).join(" › ");
  }
  return "";
};
