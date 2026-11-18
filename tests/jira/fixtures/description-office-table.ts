export const officeTableTsv = "Name\tPreis\tNotiz\t\nBüro\t\t =1+2 \tEnde";

const paragraph = (value: string) => ({ type: "paragraph", ...(value !== "" && { content: [{ type: "text", text: value }] }) });
const unknownBlock = { type: "bodiedExtension", attrs: { extensionKey: "future", parameters: { flag: true } }, content: [
  paragraph("Bestehende Erweiterung"),
] };
const existingTable = { type: "table", attrs: { localId: "original-table" }, content: [{
  type: "tableRow", content: [{ type: "tableCell", attrs: { colspan: 2 }, content: [{ type: "paragraph" }] }],
}] };
export const officeTableInitial = { type: "doc", version: 1, content: [unknownBlock, existingTable, paragraph("Bestehender Absatz")] };
export const officeTableRemote = { ...officeTableInitial, content: [...officeTableInitial.content, paragraph("Änderung auf Jira")] };
const imported = { type: "table", attrs: { isNumberColumnEnabled: false, layout: "default" }, content: [
  ["Name", "Preis", "Notiz", ""],
  ["Büro", "42", " =1+2 ", "Ende"],
].map((cells) => ({ type: "tableRow", content: cells.map((value) => ({
  type: "tableCell", attrs: {}, content: [paragraph(value)],
})) })) };
export const officeTableSaved = { ...officeTableInitial, content: [...officeTableInitial.content, imported] };
