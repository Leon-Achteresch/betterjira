import { Schema } from "effect";

export const DescriptionFormat = Schema.Literals(["adf", "wiki", "text"]);
export type DescriptionFormat = typeof DescriptionFormat.Type;

export const DescriptionBasis = Schema.Struct({
  version: Schema.Literal(1),
  format: DescriptionFormat,
  value: Schema.Json,
});
export type DescriptionBasis = typeof DescriptionBasis.Type;

const isJsonArray = (value: Schema.Json): value is Schema.JsonArray => Array.isArray(value);

export const descriptionBasis = (format: DescriptionFormat, value: unknown): DescriptionBasis | undefined => {
  if (!Schema.is(Schema.Json)(value)) return undefined;
  if (value !== null && (format === "adf"
    ? typeof value !== "object" || isJsonArray(value) || value.type !== "doc"
    : typeof value !== "string")) return undefined;
  return { version: 1, format, value };
};

const canonicalJson = (value: Schema.Json): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (isJsonArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
};

export const sameDescription = (left: DescriptionBasis, right: DescriptionBasis) =>
  left.format === right.format && canonicalJson(left.value) === canonicalJson(right.value);
