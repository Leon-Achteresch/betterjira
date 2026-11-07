import { Schema } from "effect";
import { INLINE_NODES } from "./adf";

const Attrs = Schema.optional(Schema.Record(Schema.String, Schema.Unknown));
const AdfTextMark = Schema.Struct({ type: Schema.String, attrs: Attrs });

interface AdfTextNode {
  readonly type: string;
  readonly text?: string | undefined;
  readonly attrs?: { readonly [key: string]: unknown } | undefined;
  readonly marks?: ReadonlyArray<typeof AdfTextMark.Type> | undefined;
  readonly content?: ReadonlyArray<AdfTextNode> | undefined;
}

const AdfTextNode = Schema.Struct({
  type: Schema.String,
  text: Schema.optional(Schema.String),
  attrs: Attrs,
  marks: Schema.optional(Schema.Array(AdfTextMark)),
  content: Schema.optional(Schema.Array(Schema.suspend((): Schema.Codec<AdfTextNode> => AdfTextNode))),
});
const isAdfTextDoc = Schema.is(Schema.Struct({ type: Schema.Literal("doc"), content: Schema.optional(Schema.Array(AdfTextNode)) }));

export type PlainDescription =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "missing" | "blank" | "unreadable" };

const LIST_ITEM_TYPES = new Set(["listItem", "taskItem", "decisionItem"]);
const UTC_DATE = new Intl.DateTimeFormat("de-DE", { timeZone: "UTC" });

const attr = (node: AdfTextNode, key: string) => {
  const value = node.attrs?.[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
};

const linkHref = (node: AdfTextNode | undefined) => {
  const href = node?.type === "text" ? node.marks?.find((mark) => mark.type === "link")?.attrs?.href : undefined;
  return typeof href === "string" && href.trim() ? href.trim() : undefined;
};

const mentionText = (node: AdfTextNode) => {
  const name = attr(node, "text").trim();
  return !name || name.startsWith("@") ? name : `@${name}`;
};

const dateText = (node: AdfTextNode) => {
  const raw = attr(node, "timestamp");
  const timestamp = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(timestamp) ? UTC_DATE.format(timestamp) : "";
};

const inlineNode = (node: AdfTextNode): string => {
  switch (node.type) {
    case "text":
      return node.text ?? "";
    case "hardBreak":
      return "\n";
    case "mention":
      return mentionText(node);
    case "emoji":
      return attr(node, "text") || attr(node, "shortName");
    case "status":
      return attr(node, "text");
    case "date":
      return dateText(node);
    case "inlineCard":
      return attr(node, "url");
    default:
      return inlineText(node.content);
  }
};

const namesTarget = (label: string, href: string) => {
  const text = label.trim();
  return text === href || text === href.replace(/^mailto:/i, "");
};

function inlineText(nodes: ReadonlyArray<AdfTextNode> = []): string {
  let text = "";
  let label = "";
  nodes.forEach((node, index) => {
    const part = inlineNode(node);
    const href = linkHref(node);
    label = href && linkHref(nodes[index - 1]) === href ? label + part : part;
    text += part;
    if (href && linkHref(nodes[index + 1]) !== href && !namesTarget(label, href)) text += ` (${href})`;
  });
  return text;
}

const isFilled = (text: string) => text.trim() !== "";

const prefixLines = (text: string, first: string, rest: string) =>
  text
    .split("\n")
    .map((line, index) => (index === 0 ? first + line : line ? rest + line : line))
    .join("\n");

const flow = (nodes: ReadonlyArray<AdfTextNode> = [], separator: string) =>
  nodes.every((node) => INLINE_NODES.has(node.type)) ? inlineText(nodes) : nodes.map(block).filter(isFilled).join(separator);

const orderedStart = (node: AdfTextNode) => {
  const order = node.attrs?.order;
  return typeof order === "number" && Number.isInteger(order) ? order : 1;
};

const itemMarker = (list: AdfTextNode, item: AdfTextNode, index: number) => {
  if (item.type === "taskItem") return item.attrs?.state === "DONE" ? "[x] " : "[ ] ";
  if (list.type === "orderedList") return `${orderedStart(list) + index}. `;
  return "- ";
};

const listText = (list: AdfTextNode) =>
  (list.content ?? [])
    .map((item, index) => {
      if (!LIST_ITEM_TYPES.has(item.type)) return prefixLines(block(item), "  ", "  ");
      const marker = itemMarker(list, item, index);
      return prefixLines(flow(item.content, "\n"), marker, " ".repeat(marker.length));
    })
    .filter(isFilled)
    .join("\n");

const tableText = (table: AdfTextNode) =>
  (table.content ?? [])
    .map((row) => (row.content ?? []).map((cell) => flow(cell.content, " ").replace(/\s+/g, " ").trim()))
    .filter((cells) => cells.some(isFilled))
    .map((cells) => cells.join(" | "))
    .join("\n");

function block(node: AdfTextNode): string {
  switch (node.type) {
    case "paragraph":
    case "heading":
    case "codeBlock":
      return inlineText(node.content);
    case "bulletList":
    case "orderedList":
    case "taskList":
    case "decisionList":
      return listText(node);
    case "blockquote":
      return prefixLines(flow(node.content, "\n\n"), "> ", "> ");
    case "rule":
      return "---";
    case "table":
      return tableText(node);
    case "expand":
    case "nestedExpand":
      return [attr(node, "title"), flow(node.content, "\n\n")].filter(isFilled).join("\n");
    case "blockCard":
    case "embedCard":
      return attr(node, "url");
    default:
      return INLINE_NODES.has(node.type) ? inlineNode(node) : flow(node.content, "\n\n");
  }
}

export const plainDescription = (value: unknown): PlainDescription => {
  if (value === null || value === undefined) return { kind: "missing" };
  const text = typeof value === "string" ? value : isAdfTextDoc(value) ? flow(value.content, "\n\n") : undefined;
  if (text === undefined) return { kind: "unreadable" };
  const normalized = text.replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "").trim();
  return normalized ? { kind: "text", text: normalized } : { kind: "blank" };
};
