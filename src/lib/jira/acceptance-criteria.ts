import { Schema } from "effect";

const Node = Schema.Struct({ type: Schema.String, content: Schema.optional(Schema.Array(Schema.Unknown)) });
const PlainText = Schema.Struct({ type: Schema.Literal("text"), text: Schema.String });
const isNode = Schema.is(Node);
const isPlainText = Schema.is(PlainText);
const isDocument = Schema.is(Schema.Struct({ type: Schema.Literal("doc"), version: Schema.Literal(1), content: Schema.Array(Schema.Unknown) }));
const HEADINGS = new Set(["akzeptanzkriterien", "acceptance criteria"]);
const LISTS = new Set(["bulletList", "orderedList"]);
const MAX_ROWS = 30;
const MAX_LENGTH = 240;

export type AcceptanceCriterion = { line: number; text: string };

const inlineText = (node: typeof Node.Type) => node.content?.every(isPlainText)
  ? node.content.map(({ text }) => text).join("").trim()
  : undefined;

function criterionText(row: unknown) {
  if (!isNode(row) || row.type !== "listItem" || row.content?.length !== 1) return;
  const paragraph = row.content[0];
  if (!isNode(paragraph) || paragraph.type !== "paragraph") return;
  const text = inlineText(paragraph);
  if (text && text.length <= MAX_LENGTH && !/[\r\n\u2028\u2029]/.test(text)) return text;
}

export function acceptanceCriteria(description: unknown) {
  if (!isDocument(description)) return { kind: description == null ? "missing" : "unsupported", rows: [], excluded: 0 } as const;
  const { content } = description;
  const headings = content.flatMap((node, index) =>
    isNode(node) && node.type === "heading" && HEADINGS.has(inlineText(node)?.toLowerCase() ?? "") ? [index] : []);
  if (!headings.length) return { kind: "missing", rows: [], excluded: 0 } as const;
  const list = content[headings[0] + 1];
  const next = content[headings[0] + 2];
  if (headings.length !== 1 || !isNode(list) || !LISTS.has(list.type) || !list.content?.length ||
      list.content.length > MAX_ROWS || (isNode(next) && LISTS.has(next.type)))
    return { kind: "unsupported", rows: [], excluded: 0 } as const;

  const counts = new Map<string, number>();
  const rows = list.content.flatMap((row, index) => {
    const text = criterionText(row);
    if (!text) return [];
    const signature = text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ");
    counts.set(signature, (counts.get(signature) ?? 0) + 1);
    return [{ line: index + 1, text, signature }];
  });
  const distinct = rows.filter(({ signature }) => counts.get(signature) === 1).map(({ line, text }) => ({ line, text }));
  return { kind: "list", rows: distinct, excluded: list.content.length - distinct.length } as const;
}
