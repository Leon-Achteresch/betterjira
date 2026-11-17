import { invoke } from "@tauri-apps/api/core";
import type { DueDateShiftResult } from "../../../src/lib/jira/due-date-shift";
import { mixedShiftWrites, shiftDates, staleDate } from "../../jira/fixtures/due-date-shift-acceptance";
import { button, check, click, fixtureDriver, same, signOut, wait } from "../c1-tauri/driver";

declare global {
  interface Window {
    __N04_SHIFT_RUNS__: () => { status: string; result?: DueDateShiftResult[] }[];
  }
}

const { control, preflight } = fixtureDriver("n04");
type Ledger = {
  reads: { kind: string; key: string; due?: unknown }[];
  writes: { path: string; payload: unknown; status: number }[];
  dates: Record<string, string | null>;
  held: string | null;
  released: string[];
  unexpected: number;
};
const ledger = async (): Promise<Ledger> => (await control("state")).json();
const dialog = () => document.querySelector<HTMLElement>('[role=dialog][aria-label="Sammelbearbeitung"]');
const editor = () => dialog()?.querySelector<HTMLInputElement>("#bulk-due-days");
const confirmButton = () => button("Verschiebung bestätigen", dialog());
const previewRows = () => [...(dialog()?.querySelectorAll('[aria-label="Vorschau der Fälligkeiten"] li') ?? [])];
const resultRows = () => [...(dialog()?.querySelectorAll('[aria-label="Ergebnisse der Fälligkeitsverschiebung"] li') ?? [])];
const rowControl = (key: string) => document.querySelector<HTMLButtonElement>(`button[role=checkbox][aria-label="${key} auswählen"]`);

const press = (element: HTMLElement, key: string) => {
  element.focus();
  element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
};
const select = async (key: string, selected: boolean) => {
  const checkbox = await wait(() => rowControl(key), `${key} selection`);
  if ((checkbox.getAttribute("aria-checked") === "true") !== selected) await click(() => rowControl(key), `${key} selection changed`);
  await wait(() => rowControl(key)?.getAttribute("aria-checked") === String(selected), `${key} selection updated`);
};
const open = async () => {
  if (!dialog()) await click(() => button("Bearbeiten"), "selected issue bulk actions");
  if (editor()) return;
  const operation = await wait(() => dialog()?.querySelector<HTMLElement>("#bulk-operation"), "bulk operation selector");
  press(operation, "Enter");
  const option = await wait(() => [...document.querySelectorAll<HTMLElement>("[role=option]")].find(
    (item) => item.textContent.trim() === "Fälligkeiten verschieben",
  ), "relative due-date option");
  press(option, "Enter");
  await wait(editor, "day offset editor");
};
const preview = async (days: string, count: number) => {
  const field = await wait(editor, "day offset editor");
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(field, days);
  field.dispatchEvent(new Event("input", { bubbles: true }));
  await click(() => button("Vorschau frisch prüfen", dialog()), "fresh due-date preview");
  await wait(() => previewRows().length === count && confirmButton()?.disabled === false, "fresh, reviewable issue dates");
};
const confirm = async () => {
  const submit = await wait(confirmButton, "explicit confirmation");
  check(!submit.disabled, "confirmation is disabled");
  submit.click();
  submit.click();
};
const completed = async (count: number) => wait(() => {
  const runs = window.__N04_SHIFT_RUNS__();
  return runs.length === count && runs.every(({ status }) => status === "success") ? runs.at(-1)?.result : undefined;
}, `${count} settled N04 mutations`);

const put = (key: string, date: string, status: number) => ({
  path: `/ex/jira/mock-cloud/rest/api/3/issue/${key}`, payload: { fields: { duedate: date } }, status,
});
const mixedWrites = mixedShiftWrites.map(({ key, date, status }) => put(key, date, status));
const lateWrite = put("DEMO-1", "2026-03-28", 204);

async function run() {
  await preflight();
  history.replaceState(null, "", "/suche?projekt=DEMO");
  await import("../../../src/main");
  for (const key of Object.keys(shiftDates).slice(0, 7)) await select(key, true);
  await open();
  await preview("+1", 7);
  for (const [index, text] of [[0, "2026-03-28 → 2026-03-29"], [1, "2026-10-24 → 2026-10-25"],
    [2, "Keine vorhandene Fälligkeit"], [3, "Ungültiges Kalenderdatum"], [6, "2026-12-31 → 2027-01-01"]] as const)
    check(previewRows()[index]?.textContent?.includes(text), `Unexpected preview in row ${index + 1}`);
  same((await ledger()).writes, [], "Opening or previewing dates dispatched a PUT");
  await click(() => button("Bearbeiten"), "dismiss the unconfirmed preview");
  await wait(() => !dialog(), "unconfirmed preview closed");
  same((await ledger()).writes, [], "Dismissing an unconfirmed preview dispatched a PUT");

  await open();
  check(!confirmButton(), "Old preview remained confirmable after dismissal");
  await preview("1", 7);
  await control("stale", "POST");
  same((await ledger()).writes, [], "Editing the synthetic server date dispatched a client PUT");
  await confirm();
  const mixed = await completed(1);
  same(mixed.map(({ status }) => status), ["changed", "failed", "skipped", "skipped", "uncertain", "changed", "skipped"], "Mixed fixture status mismatch");
  await wait(() => resultRows().length === 7 && !confirmButton(), "mixed results displayed and consumed preview removed");
  for (const [index, label] of ["Geändert", "Abgelehnt", "Nicht gesendet", "Nicht gesendet", "Ergebnis unklar", "Geändert", "Nicht gesendet"].entries())
    check(resultRows()[index]?.textContent?.includes(`DEMO-${index + 1} · ${label}`), `Missing result label for DEMO-${index + 1}`);
  check(resultRows()[6]?.textContent?.includes("seit der Vorschau geändert"), "Stale date not shown as skipped");
  const afterMixed = await ledger();
  same(afterMixed.writes, mixedWrites, "Wrong or repeated PUT in mixed run");
  check(afterMixed.dates["DEMO-5"] === "2026-11-17" && afterMixed.dates["DEMO-7"] === staleDate, "Synthetic applied-but-unclear or skipped result missing");
  for (const key of ["DEMO-2", "DEMO-3", "DEMO-4", "DEMO-5", "DEMO-7"]) await select(key, false);

  await preview("-1", 2);
  check(previewRows()[0]?.textContent?.includes("2026-03-29 → 2026-03-28"), "Negative offset did not use the new absolute date");
  await control("hold?method=GET", "POST");
  await confirm();
  await wait(async () => (await ledger()).held === "GET DEMO-1", "fresh date GET parked before dispatch");
  await click(() => button("Weitere Änderungen stoppen", dialog()), "stop before dispatch");
  same((await ledger()).writes, mixedWrites, "Stopping the parked GET dispatched a PUT");
  await control("release", "POST");
  const stopped = await completed(2);
  same(stopped.map(({ row, status }) => [row.key, status]), [["DEMO-1", "skipped"], ["DEMO-6", "skipped"]], "Stopped run did not skip all remaining tickets");
  await wait(() => !confirmButton() && editor()?.disabled === false, "stopped run settled");
  same((await ledger()).writes, mixedWrites, "Late GET dispatched after stopping");

  await preview("-1", 2);
  await control("hold?method=PUT", "POST");
  await confirm();
  await wait(async () => (await ledger()).held === "PUT DEMO-1", "already-dispatched PUT response parked");
  same((await ledger()).writes, [...mixedWrites, lateWrite], "Only one PUT should dispatch before logout");
  await signOut();
  await wait(() => !dialog(), "old bulk editor removed after logout");
  await control("release", "POST");
  const late = await completed(3);
  same(late.map(({ row, status }) => [row.key, status]), [["DEMO-1", "changed"], ["DEMO-6", "skipped"]], "Late PUT did not stay with its original run");
  const final = await ledger();
  same(final.writes, [...mixedWrites, lateWrite], "An additional PUT was sent after logout");
  same(final.released, ["GET DEMO-1", "PUT DEMO-1"], "Both delayed requests must have been released");
  check(final.dates["DEMO-1"] === "2026-03-28" && final.dates["DEMO-6"] === "2026-11-18" && !final.held && final.unexpected === 0,
    "Logout left an unexpected request or date change");
}

void run().then(
  () => invoke("fixture_finish"),
  (error: unknown) => invoke("fixture_finish", { error: String(error) }),
);
