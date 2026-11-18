import { invoke } from "@tauri-apps/api/core";
import { button, check, click, fixtureDriver, same, signOut, wait } from "../c1-tauri/driver";

type Search = { method: string; path: string; params: Record<string, string> };
type Ledger = {
  searches: Search[];
  details: { key: string; status: number }[];
  held: boolean;
  released: number[];
  writes: string[];
  unexpectedRequests: string[];
};

const { control, preflight } = fixtureDriver("n09");
const ledger = async (): Promise<Ledger> => (await control("state")).json();
const summary = "Gateway Fehler";
const draftText = "Nur im lokalen Entwurf.";
const customer = "Fixture-Kunde";
const popup = () => document.querySelector<HTMLElement>('[role="dialog"][aria-label="Hinweise auf ähnliche Anliegen"]');
const trigger = () => button("Ähnliche Anliegen suchen");
const field = (id: string) => document.querySelector<HTMLInputElement>(id);
const description = () => document.querySelector<HTMLElement>('#create-field-description[role="textbox"]');
const project = () => document.querySelector<HTMLElement>("#create-project");
const rows = () => [...(popup()?.querySelectorAll<HTMLElement>('[role="listitem"]') ?? [])];
const expectedSearch = (projectId: string): Search => ({
  method: "GET",
  path: "/ex/jira/mock-cloud/rest/api/3/search/jql",
  params: {
    jql: `project = "${projectId}" AND (summary ~ "Gateway*" OR summary ~ "Fehler*") ORDER BY updated DESC`,
    fields: "summary,project,status,issuetype",
    maxResults: "10",
  },
});
const demo = expectedSearch("10100");
const ops = expectedSearch("10101");
const noWrites = async (phase: string) => same((await ledger()).writes, [], phase);

const press = (element: HTMLElement, key: string) => {
  element.focus();
  element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
};
const chooseProject = async (key: "DEMO" | "OPS") => {
  press(await wait(project, "project selector"), "Enter");
  const option = await wait(() => [...document.querySelectorAll<HTMLElement>('[role="option"]')]
    .find((element) => element.textContent.trim().endsWith(key)), `${key} project option`);
  press(option, "Enter");
  await wait(() => project()?.textContent.trim().endsWith(key), `${key} project selected`);
};
const fill = async (id: string, text: string) => {
  const input = await wait(() => field(id), id);
  input.focus();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, text);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};
const waitForDraft = () => wait(() =>
  project()?.textContent.trim().endsWith("DEMO") &&
  document.querySelector("#create-type")?.textContent.includes("Task") &&
  field("#create-summary")?.value === summary &&
  description()?.textContent === draftText &&
  field("#create-field-customfield_kunde")?.value === customer, "original DEMO draft");
const start = async () => {
  await wait(() => trigger()?.disabled === false, "search enabled with confirmed project metadata");
  await click(trigger, "explicit search");
};
const see = (text: string) => wait(() => popup()?.innerText.includes(text), text);

async function searchAndVisit() {
  await click(() => document.querySelector<HTMLAnchorElement>('a[aria-label="Ticket erstellen"][href="/neu"]'), "create link in app header");
  await wait(() => location.pathname === "/neu", "regular create route");
  await chooseProject("DEMO");
  await fill("#create-summary", "ab");
  check(trigger()?.disabled, "An unusable title enabled search");
  await fill("#create-summary", summary);
  const body = await wait(description, "editable description");
  body.focus();
  check(document.execCommand("insertText", false, draftText), "WebKit description input failed");
  await fill("#create-field-customfield_kunde", customer);
  await waitForDraft();
  same((await ledger()).searches, [], "Draft input triggered an unsolicited search");
  same((await ledger()).details, [], "The synthetic search target was already read");
  await noWrites("Opening the create form or editing its draft sent a write");

  await start();
  await see("3 prüfbare Hinweise aus 6 gelieferten Treffern");
  for (const label of [
    "Quelle:", "betterjira N09 IPC Fixture", "Zielprojekt DEMO", "Gateway* · Fehler*",
    "Weitere Suchtreffer möglich; sie werden hier nicht nachgeladen.",
    "2 Treffer ohne bestätigtes Zielprojekt oder lesbaren Titel ausgelassen",
    "1 doppelt gelieferte Treffer nur einmal gezeigt",
  ]) check(popup()?.innerText.includes(label), `Missing partial coverage or source: ${label}`);
  same(rows().map((row) => row.querySelector(".font-mono")?.textContent), ["DEMO-1", "DEMO-2", "DEMO-5"], "Wrong visible hits after filtering");
  same((await ledger()).searches, [demo], "Search was unscoped, unbounded or automatically paginated");
  await noWrites("N09 search sent a write");

  await click(() => rows()[0]?.querySelector("button"), "open the first search hit");
  await wait(() => location.pathname === "/issue/DEMO-1" &&
    document.querySelector("main h1")?.textContent.includes("Gateway meldet Fehler"), "actual issue detail");
  same((await ledger()).details, [{ key: "DEMO-1", status: 200 }], "Navigation did not perform the expected detail GET");
  await noWrites("Opening the issue detail sent a write");
  history.back();
  await wait(() => location.pathname === "/neu" && !popup(), "return to create");
  await waitForDraft();
  same((await ledger()).searches, [demo], "Returning to the draft repeated the search");
  await noWrites("Returning to the draft sent a write");
}

async function switchProject() {
  await start();
  await see("Suche läuft");
  await wait(async () => (await ledger()).held, "second DEMO response held in HTTP fixture");
  same((await ledger()).searches, [demo, demo], "Wrong held search");
  await chooseProject("OPS");
  await wait(() => !popup() && trigger()?.disabled === false, "old search cleared after project change");
  check((await ledger()).held, "The delayed HTTP response did not stay held through the switch");
  same(field("#create-summary")?.value, summary, "Project switch changed the title");
  await control("release", "POST");
  await wait(async () => (await ledger()).released.length === 1, "DEMO response returned after scope change");
  check(!popup(), "Late response reopened the previous search");
  same((await ledger()).searches, [demo, demo], "Scope change launched a search");

  await start();
  await see("1 prüfbare Hinweise aus 2 gelieferten Treffern");
  for (const label of ["Zielprojekt OPS", "Betrieb prüft Gateway", "Jira bestätigt das Ende dieser Suchabfrage."])
    check(popup()?.innerText.includes(label), `Missing new project result: ${label}`);
  check(!popup()?.innerText.includes("Verspäteter DEMO-Treffer") && rows().length === 1, "Stale or foreign project result reached OPS");
  same((await ledger()).searches, [demo, demo, ops], "Explicit restart was not bound to OPS");
  press(await wait(() => button("Erneut bewusst suchen", popup()), "search action in OPS"), "Escape");
  await wait(() => !popup(), "OPS search dismissed");
  await chooseProject("DEMO");
  await waitForDraft();
  check(!popup(), "Switching back exposed the abandoned DEMO search");
  same((await ledger()).searches, [demo, demo, ops], "Switching back started a search");
}

async function run() {
  await preflight();
  history.replaceState(null, "", "/issue/DEMO-2");
  await import("../../../src/main");
  await searchAndVisit();
  await switchProject();
  await signOut();
  await noWrites("Project switching, late response or logout sent a write");
  same((await ledger()).unexpectedRequests, [], "Unexpected fixture requests");
}

void run().then(
  () => invoke("fixture_finish"),
  (error: unknown) => invoke("fixture_finish", { error: String(error) }),
);
