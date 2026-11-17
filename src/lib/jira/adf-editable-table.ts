import { Node, type Editor, type JSONContent } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import { Selection } from "@tiptap/pm/state";
import { goToNextCell } from "@tiptap/pm/tables";
import type { AdfNode } from "./adf";

export const EDITABLE_TABLE = "adfTable";
const ROW = "adfTableRow";
const CELL = "adfTableCell";
const roles: Partial<Record<string, string>> = { [EDITABLE_TABLE]: "table", [ROW]: "row", [CELL]: "cell" };

const sourceAttrs = () => ({ sourceAttrs: { default: null, rendered: false } });

export const adfTableExtensions = [
  Node.create({
    name: EDITABLE_TABLE,
    group: "block",
    content: `${ROW}+`,
    isolating: true,
    addAttributes: sourceAttrs,
    extendNodeSchema: (extension) => roles[extension.name] ? { tableRole: roles[extension.name] } : {},
    addKeyboardShortcuts() {
      const next = goToNextCell(1);
      const previous = goToNextCell(-1);
      return {
        Tab: () => this.editor.isEditable && next(this.editor.state, this.editor.view.dispatch),
        "Shift-Tab": () => this.editor.isEditable && previous(this.editor.state, this.editor.view.dispatch),
      };
    },
    renderHTML: () => ["div", { "data-adf-table-scroll": "" }, ["table", ["tbody", 0]]],
  }),
  Node.create({
    name: ROW,
    content: `${CELL}+`,
    renderHTML: () => ["tr", 0],
  }),
  Node.create({
    name: CELL,
    content: "paragraph+",
    isolating: true,
    addAttributes: sourceAttrs,
    renderHTML: () => ["td", 0],
  }),
];

const withSourceAttrs = (attrs: AdfNode["attrs"]) => attrs && { attrs: { sourceAttrs: attrs } };

export function tableToEditor(table: AdfNode, toEditor: (node: AdfNode) => JSONContent): JSONContent | undefined {
  if (table.type !== "table" || !Array.isArray(table.content) || !table.content.length) return undefined;
  if (!Object.entries(table.attrs ?? {}).every(([key, value]) =>
    (key === "layout" && (value === "default" || value === "center")) ||
    (key === "isNumberColumnEnabled" && value === false),
  )) return undefined;
  const width = table.content[0]?.content?.length;
  const rows: JSONContent[] = [];
  for (const row of table.content) {
    if (row?.type !== "tableRow" || !Array.isArray(row.content) || !width || row.content.length !== width) return undefined;
    const cells: JSONContent[] = [];
    for (const cell of row.content) {
      if (cell?.type !== "tableCell" || Object.keys(cell.attrs ?? {}).length || !Array.isArray(cell.content) ||
        !cell.content.length || !cell.content.every((block) => block?.type === "paragraph")) return undefined;
      cells.push({ type: CELL, ...withSourceAttrs(cell.attrs), content: cell.content.map(toEditor) });
    }
    rows.push({ type: ROW, content: cells });
  }
  return { type: EDITABLE_TABLE, ...withSourceAttrs(table.attrs), content: rows };
}

const adfTypes: Partial<Record<string, string>> = { [EDITABLE_TABLE]: "table", [ROW]: "tableRow", [CELL]: "tableCell" };

export function tableNodeFromEditor(node: JSONContent, fromEditor: (node: JSONContent) => AdfNode): AdfNode | undefined {
  const type = node.type && adfTypes[node.type];
  if (!type) return undefined;
  return {
    type,
    ...(node.attrs?.sourceAttrs && { attrs: node.attrs.sourceAttrs }),
    content: (node.content ?? []).map(fromEditor),
  };
}

export function insertEditableTable(editor: Editor, table: JSONContent) {
  if (!editor.isEditable || editor.isDestroyed) return false;
  const { $from } = editor.state.selection;
  const position = $from.depth === 0 ? $from.pos : $from.after(1);
  const tr = editor.state.tr.insert(position, editor.schema.nodeFromJSON(table));
  const selection = Selection.findFrom(tr.doc.resolve(position), 1, true);
  if (selection) tr.setSelection(selection);
  editor.view.dispatch(closeHistory(tr).scrollIntoView());
  editor.view.dispatch(closeHistory(editor.state.tr));
  return true;
}
