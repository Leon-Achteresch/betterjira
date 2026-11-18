import { invoke } from "@tauri-apps/api/core";
import { officeTableInitial, officeTableRemote, officeTableSaved, officeTableTsv } from "../../jira/fixtures/description-office-table";
import { button, check, click, fixtureDriver, same, signOut, wait } from "./driver";
import { confirm, editor, openEditor, requireConflict, save } from "./description-driver";

const { control, preflight } = fixtureDriver("c1");
type Ledger = {
  reads: { cloud: string; status: number; description?: unknown }[];
  writes: { path: string; payload: unknown; status: number }[];
};
type TicketRead = { status: number; description?: unknown };
const ledger = async (): Promise<Ledger> => (await control("state")).json();
const ticketReads = async (): Promise<TicketRead[]> => (await control("ticket-reads")).json();
const popup = () => document.querySelector('[role="dialog"][aria-label="Tabelle übernehmen"]');
const table = () => editor()?.querySelector("[data-adf-table-scroll] table");
const cells = () => [...(table()?.querySelectorAll("td") ?? [])].map((cell) => cell.textContent);
const insert = () => click(() => button("In Entwurf einfügen", popup()), "explicit TSV insert");
const noWrite = async (phase: string) => same((await ledger()).writes, [], `Unexpected Jira write ${phase}`);
const draftValues = ["Name", "Preis", "Notiz", "", "Büro", "", " =1+2 ", "Ende"];
const savedValues = ["Name", "Preis", "Notiz", "", "Büro", "42", " =1+2 ", "Ende"];
const written = {
  path: "/ex/jira/mock-cloud/rest/api/3/issue/10000",
  payload: { fields: { description: officeTableSaved } },
  status: 204,
};

const escapeEditor = async () => {
  const field = await wait(editor, "description editor");
  field.focus();
  field.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  await wait(() => !editor(), "closed description editor");
};
const fill = async (value: string) => {
  const input = await wait(() => popup()?.querySelector("textarea"), "TSV input");
  await wait(() => document.activeElement === input, "TSV input focus");
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await wait(() => button("In Entwurf einfügen", popup())?.disabled === false, "insert action enabled");
};
const waitForTable = async () => {
  await wait(() => table()?.querySelectorAll("td").length === 8 && document.activeElement === editor(),
    "editable TSV table and editor focus");
  same([...table()!.querySelectorAll("tr")].map((row) => row.cells.length), [4, 4], "TSV row and column shape changed");
};

async function importAndSave() {
  await openEditor();
  await wait(() => editor() && document.activeElement === editor(), "initial editor focus");
  same((await ticketReads())[0], { status: 200, description: officeTableInitial }, "Initial detail did not load the fixture ADF");
  const trigger = await wait(() => button("Tabelle aus Zwischenablage übernehmen"), "description toolbar TSV import");
  trigger.focus();
  trigger.click();
  await fill("A\tB\nC");
  await insert();
  await wait(() => popup()?.querySelector('[role="alert"]')?.textContent.includes("gleich viele Spalten"), "ragged TSV error");
  check(!table(), "Invalid TSV inserted an editable table");
  await noWrite("after invalid TSV");

  await fill(officeTableTsv);
  check(!table(), "Typing TSV inserted a table before confirmation");
  await noWrite("before inserting");
  await insert();
  await waitForTable();
  same(cells(), draftValues, "Initial TSV cells lost empty values or formula text");
  check(editor()?.textContent.includes("Bestehende Erweiterung") && editor()?.textContent.includes("Bestehender Absatz"),
    "TSV operation hid existing description content");
  await noWrite("after inserting into the draft");
  await escapeEditor();
  await noWrite("after cancelling");

  await openEditor("Beschreibung: Entwurf fortsetzen");
  await waitForTable();
  same(cells(), draftValues, "Resuming the draft changed the imported table");
  const emptyCell = await wait(() => table()?.querySelectorAll("td")[5]?.querySelector("p"), "editable empty cell");
  getSelection()!.collapse(emptyCell, 0);
  check(document.execCommand("insertText", false, "42"), "WebKit did not type into the cell");
  await wait(() => emptyCell.textContent === "42", "edited cell content");
  same(cells(), savedValues, "Editing the cell changed another cell or the formula text");
  await noWrite("after the cell edit");

  await control("remote?revision=remote", "POST");
  await save();
  await requireConflict("Änderung auf Jira");
  await noWrite("before conflict acknowledgement");
  await confirm();
  await wait(() => !editor() && button("Beschreibung bearbeiten")?.textContent.includes("42"), "saved description in ticket detail");
  const saved = await ledger();
  same(saved.writes, [written], "Confirmed save did not send exactly one correct ADF PUT");
  same(saved.reads, [officeTableRemote, officeTableRemote].map((description) => ({ cloud: "mock-cloud", status: 200, description })),
    "C1 did not re-read the same Jira revision before accepting the confirmation");
}

async function run() {
  const readCount = new URLSearchParams(location.search).get("reloadAfter");
  if (readCount === null) await preflight();
  history.replaceState(null, "", "/issue/DEMO-1");
  await import("../../../src/main");
  if (readCount === null) {
    await importAndSave();
    const count = (await ticketReads()).length;
    location.replace(`/tests/native/c1-tauri/fixture.html?reloadAfter=${count}`);
    return false;
  }
  await wait(async () => (await ticketReads()).length > Number(readCount), "fresh issue detail GET after WebView reload");
  same((await ticketReads()).at(-1), { status: 200, description: officeTableSaved }, "Reload did not receive the exact saved Jira ADF");
  await openEditor();
  await waitForTable();
  same(cells(), savedValues, "Reloaded Jira table was not editable with the saved values");
  await escapeEditor();
  await signOut();
  same((await ledger()).writes, [written], "Reload or logout sent another PUT");
  return true;
}

void run().then(
  (done) => { if (done) return invoke("fixture_finish"); },
  (error: unknown) => invoke("fixture_finish", { error: String(error) }),
);
