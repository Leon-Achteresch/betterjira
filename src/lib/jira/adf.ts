import { Mark, Node, getSchema, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

export type AdfMark = { type: string; attrs?: Record<string, unknown> };
export type AdfNode = {
  type: string;
  version?: number;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: AdfMark[];
  content?: AdfNode[];
};

const EDITABLE_NODES = new Set(["paragraph", "heading", "bulletList", "orderedList", "listItem", "codeBlock", "blockquote", "hardBreak", "rule"]);
const INLINE_NODES = new Set(["text", "hardBreak", "mention", "emoji", "date", "status", "inlineCard", "mediaInline", "placeholder", "inlineExtension"]);
const MARKS_TO_EDITOR: Record<string, string> = { strong: "bold", em: "italic", code: "code", strike: "strike", underline: "underline", link: "link" };
const MARKS_FROM_EDITOR = Object.fromEntries(Object.entries(MARKS_TO_EDITOR).map(([adf, editor]) => [editor, adf]));

export const isAdfDoc = (value: unknown): value is AdfNode =>
  typeof value === "object" && value !== null && (value as AdfNode).type === "doc";

export const isBlankAdf = (doc: AdfNode) =>
  (doc.content ?? []).every((node) => node.type === "paragraph" && !node.content?.length);

const linkAttrs = (attrs: Record<string, unknown> = {}) => ({ href: attrs.href, ...(attrs.title ? { title: attrs.title } : {}) });

const marksToEditor = (marks: AdfMark[]) => {
  const known = marks
    .filter((mark) => mark.type in MARKS_TO_EDITOR)
    .map((mark) => (mark.type === "link" ? { type: "link", attrs: linkAttrs(mark.attrs) } : { type: MARKS_TO_EDITOR[mark.type]! }));
  const unknown = marks.filter((mark) => !(mark.type in MARKS_TO_EDITOR));
  return unknown.length > 0 ? [...known, { type: "adfMarks", attrs: { json: JSON.stringify(unknown) } }] : known;
};

const marksFromEditor = (marks: JSONContent["marks"] = []): AdfMark[] =>
  marks.flatMap((mark) => {
    if (mark.type === "adfMarks") return JSON.parse(String(mark.attrs?.json)) as AdfMark[];
    if (mark.type === "link") return [{ type: "link", attrs: linkAttrs(mark.attrs) }];
    return MARKS_FROM_EDITOR[mark.type] ? [{ type: MARKS_FROM_EDITOR[mark.type]! }] : [];
  });

const attrsToEditor = (node: AdfNode) => {
  if (node.type === "heading") return { level: node.attrs?.level ?? 1 };
  if (node.type === "codeBlock") return { language: node.attrs?.language ?? null };
  if (node.type === "orderedList") return { start: node.attrs?.order ?? 1 };
  return undefined;
};

const attrsFromEditor = (node: JSONContent) => {
  if (node.type === "heading") return { level: node.attrs?.level };
  if (node.type === "codeBlock" && typeof node.attrs?.language === "string") return { language: node.attrs.language };
  if (node.type === "orderedList") return { order: node.attrs?.start ?? 1 };
  return undefined;
};

const nodeToEditor = (node: AdfNode): JSONContent => {
  if (node.type === "text") return { type: "text", text: node.text, ...(node.marks?.length && { marks: marksToEditor(node.marks) }) };
  if (!EDITABLE_NODES.has(node.type) || node.marks?.length) {
    return { type: INLINE_NODES.has(node.type) ? "adfInline" : "adfBlock", attrs: { json: JSON.stringify(node) } };
  }
  const attrs = attrsToEditor(node);
  return {
    type: node.type === "rule" ? "horizontalRule" : node.type,
    ...(attrs && { attrs }),
    ...(node.content && { content: node.content.map(nodeToEditor) }),
  };
};

const nodeFromEditor = (node: JSONContent): AdfNode => {
  if (node.type === "adfInline" || node.type === "adfBlock") return JSON.parse(String(node.attrs?.json)) as AdfNode;
  if (node.type === "text") {
    const marks = marksFromEditor(node.marks);
    return { type: "text", text: node.text ?? "", ...(marks.length > 0 && { marks }) };
  }
  const attrs = attrsFromEditor(node);
  return {
    type: node.type === "horizontalRule" ? "rule" : node.type!,
    ...(attrs && { attrs }),
    ...(node.content && { content: node.content.map(nodeFromEditor) }),
  };
};

export const adfToEditor = (doc: AdfNode): JSONContent => ({ type: "doc", content: (doc.content ?? []).map(nodeToEditor) });

export const editorToAdf = (doc: JSONContent): AdfNode => ({ type: "doc", version: 1, content: (doc.content ?? []).map(nodeFromEditor) });

const preserved = (name: string, inline: boolean) =>
  Node.create({
    name,
    group: inline ? "inline" : "block",
    inline,
    atom: true,
    selectable: true,
    addAttributes: () => ({ json: { default: "{}", rendered: false } }),
    parseHTML: () => [{ tag: `${inline ? "span" : "div"}[data-adf]`, getAttrs: (element) => ({ json: element.dataset.adf }) }],
    renderHTML: ({ node }) => [inline ? "span" : "div", { "data-adf": node.attrs.json }],
  });

export const AdfInline = preserved("adfInline", true);
export const AdfBlock = preserved("adfBlock", false);

export const AdfMarks = Mark.create({
  name: "adfMarks",
  addAttributes: () => ({ json: { default: "[]", rendered: false } }),
  parseHTML: () => [{ tag: "span[data-adf-marks]", getAttrs: (element) => ({ json: element.dataset.adfMarks }) }],
  renderHTML: ({ mark }) => {
    const color = (JSON.parse(String(mark.attrs.json)) as AdfMark[]).find((item) => item.type === "textColor")?.attrs?.color;
    return ["span", { "data-adf-marks": mark.attrs.json, ...(typeof color === "string" && { style: `color: ${color}` }) }, 0];
  },
});

export const AdfStarterKit = StarterKit.configure({ trailingNode: false, link: { openOnClick: false, autolink: true } });

export const adfSchema = getSchema([AdfStarterKit, AdfInline, AdfBlock, AdfMarks]);

export const isEditableAdf = (doc: AdfNode) => {
  try {
    adfSchema.nodeFromJSON(adfToEditor(doc)).check();
    return true;
  } catch {
    return false;
  }
};

const INLINE_PARENTS = new Set(["paragraph", "heading", "codeBlock"]);

export const adfToText = (node: AdfNode): string => {
  if (node.text !== undefined) return node.text;
  if (node.type === "mention") return String(node.attrs?.text ?? "");
  if (node.type === "hardBreak") return "\n";
  const parts = (node.content ?? []).map(adfToText);
  return INLINE_PARENTS.has(node.type) ? parts.join("") : parts.filter(Boolean).join("\n");
};
