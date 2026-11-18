import { invoke } from "@tauri-apps/api/core";
import timeline from "../../jira/fixtures/status-intervals.json";
import { button, check, click, fixtureDriver, same, signOut, wait } from "../c1-tauri/driver";

type Read = { method: string; path: string; params: Record<string, string>; status: number };
type Ledger = { reads: Read[]; writes: string[]; held: boolean; released: number[]; unexpectedRequests: string[] };
const { control, preflight } = fixtureDriver("n22");
const ledger = async (): Promise<Ledger> => (await control("state")).json();
const toggle = () => [...document.querySelectorAll<HTMLButtonElement>("main section h2 button")]
  .find((item) => item.textContent.trim().startsWith("Änderungsverlauf"));
const section = () => toggle()?.closest("section");
const panel = () => section()?.querySelector<HTMLElement>('section[aria-label="Statusaufenthalte"]');
const rows = () => [...(panel()?.querySelectorAll<HTMLElement>('[role="listitem"]') ?? [])];
const selection = () => panel()?.querySelector<HTMLElement>('[role="combobox"]');
const more = () => button("Ältere laden", section());
const summary = () => [...(panel()?.querySelectorAll("dl > div") ?? [])].map((item) => [item.querySelector("dt")?.textContent, item.querySelector("dd")?.textContent]);
const snapshot = () => [...(panel()?.querySelectorAll("p") ?? [])].find((item) => item.textContent.startsWith("Berechnungsstand:"))?.textContent;
const see = (text: string) => wait(() => panel()?.innerText.includes(text), text);
const closed = "Bestätigte abgeschlossene Aufenthalte";
const ongoing = "Laufend bis zum Berechnungsstand (separat)";
const read = (key: string, startAt: number, maxResults: number, status = 200): Read => ({
  method: "GET", path: `/ex/jira/mock-cloud/rest/api/3/issue/${key}/changelog`,
  params: { startAt: String(startAt), maxResults: String(maxResults) }, status,
});
const firstReads = [read("DEMO-1", 0, 20), read("DEMO-1", 26, 20)];
const retryReads = [...firstReads, read("DEMO-1", 6, 20, 403), read("DEMO-1", 6, 20)];
const delayedReads = [...retryReads, read("DEMO-1", 0, 6), read("DEMO-2", 0, 20)];
let now = Date.parse(timeline.asOf);

const press = (element: HTMLElement, key: string) => {
  element.focus();
  element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
};
const chooseStatus = async (id: string) => {
  press(await wait(selection, "status selector"), "Enter");
  const option = await wait(() => [...document.querySelectorAll<HTMLElement>('[role="option"]')]
    .find((element) => element.textContent.trim().endsWith(`ID ${id}`)), `status ID ${id}`);
  press(option, "Enter");
  await wait(() => selection()?.getAttribute("title")?.endsWith(`ID ${id}`) && summary().length, `explicit selection of status ID ${id}`);
};

async function partialAndRetry() {
  await wait(() => toggle()?.getAttribute("aria-expanded") === "false", "collapsed issue history");
  same((await ledger()).reads, [], "Collapsed history sent a changelog GET");
  await click(toggle, "open the regular issue history");
  await see("20 / 46");
  await see("Teilansicht – keine vollständige Gesamtzeit.");
  await see("Erst nach deiner Auswahl");
  same(summary(), [], "A duration was rendered before explicit selection");
  same((await ledger()).reads, firstReads, "Wrong initial changelog requests");

  await chooseStatus("7");
  await see("Weitere beobachtete Namen derselben ID: Warten");
  same(summary(), [[closed, "2 T"], [ongoing, "1 T"]], "Closed and ongoing durations were not separated");
  const originalRows = rows().map((row) => row.innerText);
  same(originalRows.length, 3, "Unexpected number of stays");
  check(originalRows.at(-1)?.includes("laufend · separat"), "Current stay did not have its own label");
  const originalSnapshot = snapshot();
  check(originalSnapshot, "Snapshot timestamp is missing");
  same((await ledger()).reads, firstReads, "Selecting a status sent an additional GET");

  now += 5000;
  await click(more, "load older changes");
  await wait(() => section()?.querySelector('[role="alert"]')?.textContent.includes("Ältere Änderungen konnten nicht geladen"), "paginated read error");
  await see("Historienabruf fehlgeschlagen – zuletzt geladener Stand.");
  await see("20 / 46");
  same(summary(), [[closed, "2 T"], [ongoing, "1 T"]], "Read error changed the confirmed or ongoing duration");
  same(snapshot(), originalSnapshot, "Read error replaced the timestamp of the retained snapshot");
  same(rows().map((row) => row.innerText), originalRows, "Read error changed the selected stays");
  check(selection()?.getAttribute("title")?.endsWith("ID 7"), "Read error changed the selected status");
  same((await ledger()).reads, retryReads.slice(0, 3), "Read error was automatically retried or requested a different window");

  await click(() => button("Erneut versuchen", section()), "retry the failed history read");
  await see("40 / 46");
  await wait(() => !section()?.querySelector('[role="alert"]') && snapshot() !== originalSnapshot, "fresh snapshot after explicit retry");
  same(summary(), [[closed, "2 T"], [ongoing, "1 T 5 s"]], "Successful retry did not advance only the running time");
  await see("Teilansicht – keine vollständige Gesamtzeit.");
  same((await ledger()).reads, retryReads, "Retry requested a different older window");
}

async function switchDuringRead() {
  await click(more, "start the oldest changelog window");
  await wait(async () => (await ledger()).held, "oldest DEMO-1 page parked");
  await click(() => document.querySelector<HTMLAnchorElement>('a[href="/issue/DEMO-2"]'), "open linked issue");
  await wait(() => location.pathname === "/issue/DEMO-2" && toggle()?.getAttribute("aria-expanded") === "false" && !panel(),
    "new ticket does not inherit open history or selection");
  same((await ledger()).reads, delayedReads.slice(0, 5), "Context switch opened the new ticket history automatically");
  await click(toggle, "open new issue history");
  await see("0 / 0");
  same(summary(), [], "Previous duration appeared in the other ticket");
  await chooseStatus("3");
  const otherSummary = summary();
  const otherSnapshot = snapshot();
  check(otherSnapshot && otherSummary.length, "The new ticket has no snapshot or explicitly chosen status");
  await control("release", "POST");
  await wait(async () => (await ledger()).released.length === 1, "old DEMO-1 page returned after ticket switch");
  await see("0 / 0");
  same(summary(), otherSummary, "Late history changed the new ticket duration");
  same(snapshot(), otherSnapshot, "Late history replaced the new ticket snapshot");
  check(selection()?.getAttribute("title")?.endsWith("ID 3"), "Late history changed the new ticket selection");

  history.back();
  await wait(() => location.pathname === "/issue/DEMO-1" && toggle()?.getAttribute("aria-expanded") === "false" && !panel(),
    "old history remains closed after going back");
  await click(toggle, "reopen original issue history explicitly");
  await see("40 / 46");
  same(summary(), [], "Returning to DEMO-1 revived the previous status choice");
  same((await ledger()).reads, delayedReads, "Late response was applied or caused an unsolicited read");
}

async function run() {
  await preflight();
  Date.now = () => now;
  history.replaceState(null, "", "/issue/DEMO-1");
  await import("../../../src/main");
  await partialAndRetry();
  await switchDuringRead();
  await signOut();
  const final = await ledger();
  same(final.writes, [], "Viewing or selecting status history sent a Jira write");
  same(final.unexpectedRequests, [], "Unexpected fixture requests");
}

void run().then(
  () => invoke("fixture_finish"),
  (error: unknown) => invoke("fixture_finish", { error: String(error) }),
);
