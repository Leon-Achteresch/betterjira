import { invoke } from "@tauri-apps/api/core";
import { button, check, click, fixtureDriver, same, signOut, wait } from "../c1-tauri/driver";

declare global {
  interface Window {
    __N05_REFRESH_ACCOUNT__: () => Promise<string | undefined>;
  }
}

type Ledger = {
  reads: { key: string; account: string; status: number }[];
  writes: string[];
  held: string | null;
  released: [string, string][];
  unexpectedRequests: string[];
};

const { control, preflight } = fixtureDriver("n05");
const ledger = async (): Promise<Ledger> => (await control("state")).json();
const popup = () => document.querySelector<HTMLElement>('[role="dialog"][aria-label="Abhängigkeiten ansehen"]');
const trigger = () => button("Abhängigkeiten ansehen");
const load = () => button("Abhängigkeiten laden", popup());
const rows = () => [...(popup()?.querySelectorAll<HTMLElement>("[data-ticket-key]") ?? [])];
const row = (key: string) => rows().find((node) => node.dataset.ticketKey === key);
const press = (element: HTMLElement, key: string) => {
  element.focus();
  element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
};
const open = async (source: string) => {
  await click(trigger, "issue link neighborhood entry");
  await wait(() => popup()?.textContent.includes(`Ausgangsticket ${source}`) && load()?.disabled, `unselected scope for ${source}`);
  check(!rows().length, "Opening the neighborhood reused the prior result");
};
const close = async () => {
  press(await wait(load, "load button in neighborhood popup"), "Escape");
  await wait(() => !popup() && document.activeElement === trigger(), "Escape restored focus to the neighborhood entry");
};
const choose = async (direction: "ausgehend" | "eingehend") => {
  const select = await wait(() => popup()?.querySelector<HTMLElement>("[role=combobox]"), "relationship and direction select");
  press(select, "Enter");
  const label = direction === "ausgehend" ? "blocks" : "is blocked by";
  const option = await wait(() => [...document.querySelectorAll<HTMLElement>("[role=option]")].find(
    (element) => element.textContent.trim() === `Blocks · ${label} (${direction})`,
  ), `explicit Blocks selection (${direction})`);
  press(option, "Enter");
  await wait(() => select.textContent.includes(label) && load()?.disabled === false, "chosen type and direction enabled the load action");
};
const navigate = async (key: string) => {
  await click(() => document.querySelector<HTMLAnchorElement>(`a[href="/issue/${key}"]`), `regular link to ${key}`);
  await wait(() => location.pathname === `/issue/${key}`, `ticket route for ${key}`);
};
const result = (text: string) => wait(() => popup()?.querySelector('[role="status"]')?.textContent.includes(text), text);
const readKeysSince = async (offset: number) => (await ledger()).reads.slice(offset).map(({ key }) => key);

async function directions() {
  await wait(async () => (await ledger()).reads.some(({ key }) => key === "DEMO-1"), "direct links for DEMO-1");
  const baseline = await ledger();
  await open("DEMO-1");
  await choose("ausgehend");
  same(await readKeysSince(baseline.reads.length), [], "Choosing a direction started traversal before loading");
  await click(load, "load outgoing Blocks");
  await result("4 verbundene Tickets · 6 Beziehungen · 4 von 8 Abrufen");
  check(popup()?.textContent.includes("blocks (ausgehend)") && popup()?.textContent.includes("Teilabdeckung"),
    "Result did not name the direction or disclose partial coverage");
  same(rows().map((item) => item.dataset.ticketKey), ["DEMO-1", "DEMO-2", "DEMO-3", "DEMO-6", "OPS-7"], "Cycle or duplicate link produced the wrong rows");
  check(row("DEMO-1")?.textContent.includes("DEMO-2 → DEMO-1"), "Cycle did not point back to the source");
  check(row("OPS-7")?.textContent.includes("DEMO-2 → OPS-7 · DEMO-3 → OPS-7") &&
    row("OPS-7")?.textContent.includes("Tiefengrenze erreicht"), "Shared cross-project node lost paths or its depth marker");
  check(row("DEMO-6")?.textContent.includes("Kein Lesezugriff"), "403 did not leave a visible partial result");
  same((await ledger()).reads.slice(baseline.reads.length).map(({ key, status }) => [key, status]),
    [["DEMO-1", 200], ["DEMO-2", 200], ["DEMO-3", 200], ["DEMO-6", 403]],
    "Outgoing traversal fetched a wrong type, wrong direction or a second-level ticket");

  const outgoing = (await ledger()).reads.length;
  await choose("eingehend");
  await wait(() => !row("OPS-7"), "prior outgoing result cleared");
  same(await readKeysSince(outgoing), [], "Changing direction fetched before explicit loading");
  await click(load, "load incoming Blocks");
  await result("2 verbundene Tickets · 2 Beziehungen · 2 von 8 Abrufen");
  check(popup()?.textContent.includes("is blocked by (eingehend)") &&
    row("DEMO-4")?.textContent.includes("DEMO-4 → DEMO-1") && row("DEMO-5")?.textContent.includes("DEMO-5 → DEMO-4"),
    "Incoming result misrepresented the link direction");
  same(await readKeysSince(outgoing), ["DEMO-1", "DEMO-4"], "Incoming traversal did not stop at the depth limit");
  await close();
}

async function limits() {
  await navigate("DEMO-9");
  await wait(() => document.querySelector('a[href="/issue/OPS-101"]'), "direct links for DEMO-9");
  const baseline = (await ledger()).reads.length;
  await open("DEMO-9");
  await choose("ausgehend");
  await click(load, "load capped neighborhood");
  await result("19 verbundene Tickets · 19 Beziehungen · 8 von 8 Abrufen");
  check(popup()?.textContent.includes("Teilabdeckung") && popup()?.textContent.includes("Ticketlimit erreicht") &&
    popup()?.textContent.includes("Abruflimit erreicht"), "Capped result did not disclose its limits");
  await click(() => button("Alle Tickets anzeigen", popup()), "expand the capped ticket list");
  await wait(() => rows().length === 19, "all capped ticket rows");
  same(rows().filter((item) => item.textContent.includes("Nicht weiter gelesen")).length, 12, "Wrong number of branches left unread");
  same(await readKeysSince(baseline), ["DEMO-9", ...Array.from({ length: 7 }, (_, i) => `OPS-${i + 101}`)], "Traversal exceeded the eight-request cap");
  await close();
  history.back();
  await wait(() => location.pathname === "/issue/DEMO-1", "original ticket route after limit check");
}

async function parkBranch(phase: "ticket" | "account") {
  await wait(() => document.querySelector('a[href="/issue/DEMO-11"]'), "direct links for DEMO-10");
  const baseline = (await ledger()).reads.length;
  await open("DEMO-10");
  await choose("ausgehend");
  await control(`hold?phase=${phase}`, "POST");
  await click(load, "load neighborhood with a delayed branch");
  await wait(async () => (await ledger()).held === phase, `${phase} branch parked in native HTTP`);
  same(await readKeysSince(baseline), ["DEMO-10", "DEMO-11"], "A sibling dispatched before the held response");
  check(popup()?.querySelector('[aria-busy="true"]') && !rows().length, "Parked traversal was not shown as pending");
}

async function lateResponses() {
  await navigate("DEMO-10");
  await parkBranch("ticket");
  history.back();
  await wait(() => location.pathname === "/issue/DEMO-1" && !popup(), "prior ticket popup removed on navigation");
  await open("DEMO-1");
  await control("release", "POST");
  await wait(async () => (await ledger()).released.length === 1, "late ticket response released");
  await choose("eingehend");
  await click(load, "fresh traversal after ticket switch");
  await result("2 verbundene Tickets · 2 Beziehungen · 2 von 8 Abrufen");
  check(!row("OPS-99") && !row("DEMO-12"), "Old ticket response populated the new neighborhood");
  same((await ledger()).reads.filter(({ key }) => key === "DEMO-12"), [], "Late ticket response advanced to an old sibling");
  await close();

  await navigate("DEMO-10");
  await parkBranch("account");
  await control("switch-account", "POST");
  same(await window.__N05_REFRESH_ACCOUNT__(), "mock-user-001", "Renderer did not read the second synthetic identity through IPC");
  await wait(() => !popup() && document.body.innerText.includes("Ticket oder Jira-Kontext gewechselt"), "old account popup and result cleared");
  await wait(async () => (await ledger()).reads.some(({ key, account }) => key === "DEMO-10" && account === "mock-user-001"),
    "new account loaded the regular ticket links");
  await open("DEMO-10");
  await control("release", "POST");
  await wait(async () => (await ledger()).released.length === 2, "late old-account response released");
  await choose("ausgehend");
  await click(load, "fresh traversal under the second account");
  await result("3 verbundene Tickets · 3 Beziehungen · 3 von 8 Abrufen");
  check(row("OPS-98")?.textContent.includes("DEMO-11 → OPS-98") && !row("OPS-99"), "Old account data survived a fresh request under the second account");
  const final = await ledger();
  same(final.reads.filter(({ key }) => key === "DEMO-12"), [{ key: "DEMO-12", account: "mock-user-001", status: 200 }],
    "Only the explicitly loaded new account was allowed to continue to the sibling");
  same(final.released, [["ticket", "DEMO-11"], ["account", "DEMO-11"]], "Missing delayed native responses");
  await close();
}

async function run() {
  await preflight();
  history.replaceState(null, "", "/issue/DEMO-1");
  await import("../../../src/main");
  await directions();
  await limits();
  await lateResponses();
  await signOut();
  const final = await ledger();
  same(final.writes, [], "Read-only neighborhood dispatched a write");
  same(final.unexpectedRequests, [], "Unexpected requests in the native ledger");
}

void run().then(
  () => invoke("fixture_finish"),
  (error: unknown) => invoke("fixture_finish", { error: String(error) }),
);
