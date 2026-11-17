import { invoke } from "@tauri-apps/api/core";
import { button, check, click, fixtureDriver, same, signOut, wait } from "../c1-tauri/driver";
import type { SubtaskRowResult } from "../../../src/lib/jira/subtask-rows";

declare global {
  interface Window {
    __N03_ROW_RUNS__: () => { status: string; result?: SubtaskRowResult[] }[];
  }
}

const { control, preflight } = fixtureDriver("n03");
type Ledger = {
  writes: { path: string; payload: unknown; status: number }[];
  reads: string[];
  children: { key: string; summary: string; parent: string }[];
  held: string | null;
  released: string[];
  unexpected: number;
};
const ledger = async (): Promise<Ledger> => (await control("state")).json();
const draft = () => document.querySelector<HTMLElement>('section[aria-label="Mehrere Unteraufgaben"]');
const input = () => draft()?.querySelector<HTMLTextAreaElement>("textarea");
const singleTitle = () => document.querySelector<HTMLInputElement>("#create-summary");
const opener = () => button("Mehrere Unteraufgaben vorbereiten");
const apply = () => [...(draft()?.querySelectorAll("button") ?? [])].find((item) => item.textContent.includes("verbindlich erstellen"));
const previewRows = () => [...(draft()?.querySelectorAll('[aria-label="Vorschau je Unteraufgabenzeile"] li') ?? [])];
const resultRows = () => [...(draft()?.querySelectorAll('[aria-label="Ergebnisse je Unteraufgabenzeile"] li') ?? [])];

const enterCreate = async () => {
  await click(() => [...document.querySelectorAll<HTMLAnchorElement>('main a[href="/neu?parent=DEMO-1"]')].find(
    (link) => link.textContent.trim() === "Unteraufgabe erstellen",
  ), "regular subtask create link in issue detail");
  await wait(() => location.pathname === "/neu" && new URLSearchParams(location.search).get("parent") === "DEMO-1", "parent-scoped creation form");
  await wait(opener, "subtask rows availability from real metadata");
};
const openDraft = async () => {
  await click(opener, "open subtask draft");
  await wait(input, "subtask rows input");
};
const closeDraft = async () => {
  await click(() => button("Entwurf schließen", draft()), "close subtask draft");
  await wait(() => !draft() && document.activeElement === opener(), "draft closed and focus returned");
};
const fill = (field: HTMLInputElement | HTMLTextAreaElement, text: string) => {
  const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(field, text);
  field.dispatchEvent(new Event("input", { bubbles: true }));
};
const preview = async (text: string, count: number) => {
  fill(await wait(input, "subtask row input"), text);
  await click(() => button("Vorschau prüfen", draft()), "preview subtask rows");
  await wait(() => previewRows().length === count && previewRows().every((row) => row.getClientRects().length), "all subtask rows visible in preview");
};
const choose = async (line: number) => {
  const checkbox = () => previewRows()[line - 1]?.querySelector<HTMLButtonElement>("[role=checkbox]");
  await click(checkbox, `choose subtask row ${line}`);
  await wait(() => checkbox()?.getAttribute("aria-checked") === "true", `row ${line} selected`);
};
const confirm = async (count: number) => {
  const label = count === 1 ? "1 Unteraufgabe verbindlich erstellen" : `${count} Unteraufgaben verbindlich erstellen`;
  const submit = await wait(() => button(label, draft()), "explicit submit with the correct selection count");
  check(!submit.disabled, "selected rows did not enable confirmation");
  submit.click();
  submit.click();
};
const completed = async (count: number) => wait(() => {
  const runs = window.__N03_ROW_RUNS__();
  return runs.length === count && runs.every(({ status }) => status === "success") ? runs.at(-1)?.result : undefined;
}, `${count} settled subtask mutations`);
const post = (summary: string, status: number) => ({
  path: "/ex/jira/mock-cloud/rest/api/3/issue",
  payload: { fields: { summary, parent: { id: "10000" }, project: { id: "10100" }, issuetype: { id: "10004" } } },
  status,
});
const mixedWrites = [post("Login prüfen", 201), post("Antwort abgelehnt", 401), post("Unklare Antwort", 503)];
const lateWrite = post("Verspätet erstellt", 201);
const freshReads = ["account", "permission", "type", "fields", "parent"];

async function run() {
  await preflight();
  check(window.__N03_NATIVE_FIXTURE__ === true, "Native host did not install the N03 marker");
  history.replaceState(null, "", "/issue/DEMO-1");
  await import("../../../src/main");
  await enterCreate();
  fill(await wait(singleTitle, "single subtask title"), "Unabhängiger Einzelentwurf");
  await openDraft();
  check(draft()?.textContent.includes("DEMO-1 · N03 Fixture DEMO-1") && draft()?.textContent.includes("Unteraufgabe"), "Preview target is not the parent selected in the regular entry");

  if (import.meta.env.MODE !== "n03-submit") {
    const start = (await ledger()).reads.length;
    await preview("Nur prüfen\nVorbereiten", 2);
    check(draft()?.textContent.includes("Diese Ansicht erstellt keine Tickets.") && !apply() && !draft()?.querySelector("[role=checkbox]"),
      "Regular capability did not keep the native marked control read-only");
    same(previewRows().map((row) => row.textContent?.trim()), ["1. Nur prüfen", "2. Vorbereiten"], "Read-only preview changed the input rows");
    same((await ledger()).reads.slice(start, start + freshReads.length), freshReads, "Control did not read the target through IPC");
    await closeDraft();
    check(singleTitle()?.value === "Unabhängiger Einzelentwurf" && button("Erstellen")?.disabled === false, "Separate single draft was lost or disabled");
    await signOut();
    same((await ledger()).writes, [], "Read-only control dispatched a POST");
    return;
  }

  const rows = "  Login prüfen\nAntwort abgelehnt\nAusgelassen\n\nDoppelt\ndoppelt\nUnklare Antwort\nDanach nicht senden";
  await preview(rows, 8);
  check(apply()?.disabled && !previewRows()[3]?.querySelector("[role=checkbox]") && !previewRows()[4]?.querySelector("[role=checkbox]"),
    "Unselected or invalid rows could be submitted before confirmation");
  await choose(1);
  fill(await wait(input, "editable preview input"), `${rows}!`);
  await wait(() => !apply() && !previewRows().length, "editing text invalidated the previous selection");
  await preview(rows, 8);
  check(apply()?.disabled, "A refreshed preview reused the old selection");
  for (const line of [8, 7, 2, 1]) await choose(line);
  const before = await ledger();
  same(before.writes, [], "Preview or selected rows sent a POST before confirmation");
  await confirm(4);
  await completed(1);
  await wait(() => resultRows().length === 8, "all mixed outcomes displayed");
  for (const [index, text] of ["Erstellt", "Abgelehnt", "Übersprungen", "Gesperrt", "Gesperrt", "Gesperrt", "Unklar", "Nach unklarer Rückmeldung angehalten"].entries())
    check(resultRows()[index]?.textContent?.includes(text), `Row ${index + 1} did not show ${text}`);
  const created = resultRows()[0]?.querySelector<HTMLAnchorElement>("a");
  check(created?.textContent === "DEMO-4" && new URL(created.href).pathname === "/issue/DEMO-4", `Wrong created issue link: ${created?.outerHTML}`);
  await wait(() => !apply() && input()?.readOnly, "consumed confirmation and read-only batch after results");
  const mixed = await ledger();
  same(mixed.writes, mixedWrites, "Mixed run sent wrong or repeated POSTs or changed row order");
  same(mixed.reads.slice(before.reads.length, before.reads.length + 15), [...freshReads, ...freshReads, ...freshReads], "Each dispatched row must freshly revalidate its target");
  same(mixed.children.map(({ key, summary }) => [key, summary]), [["DEMO-4", "Login prüfen"], ["DEMO-5", "Unklare Antwort"]], "Unclear server-side creation was not simulated");
  await closeDraft();
  check(singleTitle()?.value === "Unabhängiger Einzelentwurf", "The batch modified the separate single draft");

  await openDraft();
  await preview("Vor Scopeverlust\nDanach gesperrt", 2);
  await choose(1);
  await choose(2);
  await control("hold?phase=GET%20parent", "POST");
  await confirm(2);
  await wait(async () => (await ledger()).held === "GET parent", "last parent GET parked before dispatch");
  await click(() => document.querySelector<HTMLAnchorElement>('main form a[href="/issue/DEMO-1"]'), "leave creation form via parent link");
  await wait(() => location.pathname === "/issue/DEMO-1" && !draft(), "old editor removed after route scope change");
  await control("release", "POST");
  const stopped = await completed(2);
  same(stopped.map(({ status }) => status), ["blocked", "blocked"], "Late parent GET did not block the old rows");
  same((await ledger()).writes, mixedWrites, "Late parent GET sent a POST after scope loss");

  await enterCreate();
  await openDraft();
  check(input()?.value === "", "Reopening carried over the old batch approval");
  await preview("Verspätet erstellt\nNach Abmeldung gesperrt", 2);
  await choose(1);
  await choose(2);
  await control("hold?phase=POST%20issue", "POST");
  await confirm(2);
  await wait(async () => (await ledger()).held === "POST issue", "dispatched POST response parked before logout");
  same((await ledger()).writes, [...mixedWrites, lateWrite], "Only the first row should dispatch before account loss");
  await signOut();
  await wait(() => !draft(), "old draft removed on account loss");
  await control("release", "POST");
  const late = await completed(3);
  same(late.map(({ status }) => status), ["created", "blocked"], "Late response did not stay with its original run");
  const final = await ledger();
  same(final.writes, [...mixedWrites, lateWrite], "Late response sent another POST after logout");
  same(final.released, ["GET parent", "POST issue"], "Both delayed responses must be released");
  same(final.children.at(-1), { key: "DEMO-6", summary: "Verspätet erstellt", parent: "10000" }, "Late write was not applied exactly once");
  check(!final.held && final.unexpected === 0, "Unexpected Jira call or outstanding hold");
}

void run().then(
  () => invoke("fixture_finish"),
  (error: unknown) => invoke("fixture_finish", { error: String(error) }),
);
