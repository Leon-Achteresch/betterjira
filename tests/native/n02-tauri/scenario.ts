import { invoke } from "@tauri-apps/api/core";
import { button, check, click, fixtureDriver, same, signOut, wait } from "../c1-tauri/driver";
import type { TableFieldApplyResult } from "../../../src/lib/jira/table-field-apply";

declare global {
  interface Window {
    __N02_FIELD_RUNS__: () => { status: string; result?: TableFieldApplyResult[] }[];
  }
}

const { control, preflight } = fixtureDriver("n02");
type Ledger = {
  reads: { kind: string; key: string; id?: string; due?: string | null }[];
  writes: { key: string; path: string; payload: unknown; status: number }[];
  held: string | null;
  released: string[];
  unexpected: number;
  dates: Record<string, string>;
};
const ledger = async (): Promise<Ledger> => (await control("state")).json();
const dialog = () => document.querySelector<HTMLElement>('[role=dialog][aria-label="Sammelbearbeitung"]');
const input = () => dialog()?.querySelector<HTMLTextAreaElement>("textarea");
const apply = () => button("Fälligkeiten anwenden", dialog());
const rowControl = (key: string) => document.querySelector<HTMLButtonElement>(`button[role=checkbox][aria-label="${key} auswählen"]`);
const previewRows = () => [...(dialog()?.querySelectorAll('[aria-label="Prüfung je Tabellenzeile"] li') ?? [])];
const resultRows = () => [...(dialog()?.querySelectorAll('[aria-label="Ergebnisse der Fälligkeitsänderung"] li') ?? [])];

const press = (element: HTMLElement, key: string) => {
  element.focus();
  element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
};
const select = async (key: string, checked: boolean) => {
  const checkbox = await wait(() => rowControl(key), `${key} selection`);
  if ((checkbox.getAttribute("aria-checked") === "true") !== checked) checkbox.click();
  await wait(() => rowControl(key)?.getAttribute("aria-checked") === String(checked), `${key} selection updated`);
};
const openTable = async () => {
  if (!dialog()) await click(() => button("Bearbeiten"), "selected issue bulk actions");
  if (input()) return;
  const operation = await wait(() => dialog()?.querySelector<HTMLElement>("#bulk-operation"), "bulk operation selector");
  press(operation, "Enter");
  const choice = await wait(() => [...document.querySelectorAll<HTMLElement>("[role=option]")].find(
    (item) => item.textContent.trim() === "Tabellenwerte prüfen",
  ), "table field preview option");
  press(choice, "Enter");
  await wait(input, "TSV editor");
};
const fill = async (text: string) => {
  const field = await wait(input, "TSV editor");
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(field, text);
  field.dispatchEvent(new Event("input", { bubbles: true }));
};
const preview = async (rows: string[]) => {
  await fill(rows.join("\n"));
  await click(() => button("Vorschau prüfen", dialog()), "preview entered TSV");
  await wait(() => previewRows().length === rows.length && previewRows().every((row) => row.getClientRects().length), "review of all entered rows");
};
const acknowledge = async () => {
  await click(() => dialog()?.querySelector<HTMLElement>("[role=checkbox]"), "acknowledge current preview");
  await wait(() => apply()?.disabled === false, "explicit Apply enabled");
};
const confirm = async () => {
  await acknowledge();
  const submit = await wait(apply, "confirm N02 mutation");
  submit.click();
  submit.click();
};
const completed = async (count: number) => wait(() => {
  const runs = window.__N02_FIELD_RUNS__();
  return runs.length === count && runs.every(({ status }) => status === "success") ? runs.at(-1)?.result : undefined;
}, `${count} settled N02 mutations`);

const put = (key: string, id: string, duedate: string, status: number) => ({
  key, path: `/ex/jira/mock-cloud/rest/api/3/issue/${id}`, payload: { fields: { duedate } }, status,
});
const mixedWrites = [
  put("DEMO-1", "10000", "2026-12-18", 204), put("DEMO-3", "10002", "2026-12-20", 403),
  put("DEMO-5", "10004", "2026-12-22", 204), put("DEMO-6", "10005", "2026-12-23", 503),
];
const lateWrite = put("DEMO-7", "10006", "2027-01-07", 204);

async function run() {
  await preflight();
  check(window.__N02_NATIVE_FIXTURE__ === true, "Native host did not install the fixture marker");
  history.replaceState(null, "", "/suche?projekt=DEMO");
  await import("../../../src/main");

  const controlBuild = import.meta.env.MODE === "n02-control";
  const keys = Array.from({ length: controlBuild ? 2 : 7 }, (_, index) => `DEMO-${index + 1}`);
  for (const key of keys) await select(key, true);
  await openTable();
  const mixedRows = Array.from({ length: controlBuild ? 2 : 8 }, (_, index) => `DEMO-${index + 1}\t2026-12-${18 + index}`);
  await preview(mixedRows);
  check(dialog()?.textContent.includes(`${keys.length} ausgewählt`), "Preview did not show the actual selection count");
  for (const [index, row] of previewRows().entries()) {
    check(row.textContent?.includes(`DEMO-${index + 1}`) && row.textContent.includes(`2026-12-${18 + index}`), "Row was not bound to the entered TSV value");
  }
  same((await ledger()).writes, [], "Opening or previewing TSV dispatched a PUT");
  if (controlBuild) {
    check(!apply() && !dialog()?.querySelector("[role=checkbox]"), "Production capability allowed Apply in the native control");
    check((await ledger()).reads.filter(({ kind }) => kind === "issue").length === 2, "Control did not read both ticket values");
    await signOut();
    same((await ledger()).writes, [], "Native read-only control dispatched a PUT");
    return;
  }

  check(previewRows()[7]?.textContent?.includes("Ticket ist nicht ausgewählt"), "Unselected issue was not flagged");
  check(apply()?.disabled && previewRows()[0]?.textContent?.includes("2026-12-01"), "Preview lacked the original date or pre-confirmation guard");
  await acknowledge();
  await fill(mixedRows.join("\n").replace("2026-12-18", "2026-12-17"));
  await wait(() => !apply() && previewRows().length === 0, "edited TSV invalidated the old confirmation");
  same((await ledger()).writes, [], "Reviewed or modified TSV dispatched before confirmation");
  await preview(mixedRows);
  check(apply()?.disabled, "A refreshed preview reused a prior acknowledgement");
  const before = await ledger();
  check(!before.reads.some(({ kind, key }) => kind === "issue" && key === "DEMO-8"), "Unselected issue was read as a change target");

  await control("stale", "POST");
  await confirm();
  await completed(1);
  await wait(() => resultRows().length === 8, "mixed results displayed per issue");
  for (const [index, text] of [
    "DEMO-1 · Bestätigt", "Ticket oder Fälligkeit hat sich seit der Vorschau geändert", "Jira hat die Änderung abgelehnt (HTTP 403)",
    "Ticket oder Fälligkeit hat sich seit der Vorschau geändert", "DEMO-5 · Bestätigt", "DEMO-6 · Unklar",
    "Nach unklarem Ergebnis angehalten", "Diese Zeile war in der Vorschau gesperrt",
  ].entries()) check(resultRows()[index]?.textContent?.includes(text), `Result ${index + 1} lacked ${text}`);
  check(resultRows()[5]?.textContent?.includes("keine automatische Wiederholung") && !apply(), "Unclear or consumed Apply was retryable");
  const mixed = await ledger();
  same(mixed.writes, mixedWrites, "Mixed run dispatched a wrong, stale, unconfirmed or repeated PUT");
  same([mixed.dates["DEMO-1"], mixed.dates["DEMO-3"], mixed.dates["DEMO-5"], mixed.dates["DEMO-6"]],
    ["2026-12-18", "2026-12-03", "2026-12-22", "2026-12-23"], "Synthetic dates disagree with the mixed results");
  const rechecks = mixed.reads.slice(before.reads.length);
  check(rechecks.some(({ kind, key, due }) => kind === "issue" && key === "DEMO-2" && due === "2026-12-29"), "Changed date was not freshly read");
  check(rechecks.some(({ kind, key, id }) => kind === "issue" && key === "DEMO-4" && id === "99104"), "Changed ticket identity was not freshly read");

  await preview(["DEMO-7\t2027-01-06", "DEMO-5\t2027-01-05"]);
  await control("hold?method=GET", "POST");
  await confirm();
  await wait(async () => (await ledger()).held === "GET DEMO-7", "last read before PUT parked at the stub");
  await select("DEMO-7", false);
  await wait(() => !dialog() || input()?.value === "", "new selection invalidated the old preview");
  await control("release", "POST");
  const stopped = await completed(2);
  same(stopped.map(({ row, status }) => [row.key, status]), [["DEMO-7", "blocked"], ["DEMO-5", "blocked"]], "Scope loss did not block the old selection");
  same((await ledger()).writes, mixedWrites, "A late GET from the previous selection dispatched a PUT");

  await select("DEMO-7", true);
  await select("DEMO-9", true);
  await openTable();
  await preview(["DEMO-7\t2027-01-07", "DEMO-9\t2027-01-09"]);
  await control("hold?method=PUT", "POST");
  await confirm();
  await wait(async () => (await ledger()).held === "PUT DEMO-7", "dispatched PUT response parked at the stub");
  same((await ledger()).writes, [...mixedWrites, lateWrite], "Expected one real dispatch before account loss");
  await signOut();
  await wait(() => !dialog(), "previous scope's bulk dialog removed");
  await control("release", "POST");
  const late = await completed(3);
  same(late.map(({ row, status }) => [row.key, status]), [["DEMO-7", "applied"], ["DEMO-9", "blocked"]], "Late confirmation did not stay with its original run");
  const final = await ledger();
  same(final.writes, [...mixedWrites, lateWrite], "Late response after account loss dispatched a new PUT");
  same(final.released, ["GET DEMO-7", "PUT DEMO-7"], "Expected both delayed responses to be released");
  check(final.dates["DEMO-9"] === "2026-12-09" && !final.held && final.unexpected === 0, "Account loss left an unexpected request or date change");
}

void run().then(
  () => invoke("fixture_finish"),
  (error: unknown) => invoke("fixture_finish", { error: String(error) }),
);
