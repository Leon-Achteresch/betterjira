import { invoke } from "@tauri-apps/api/core";
import { button, check, click, fixtureDriver, same, signOut, wait } from "../c1-tauri/driver";

declare global {
  interface Window {
    __N25_REFRESH_ACCOUNT__: () => Promise<string | undefined>;
  }
}

type Read = {
  phase: string;
  method: string;
  path: string;
  query: string;
  account: string;
  origin: string | null;
  status: number | "held";
  links?: unknown[];
};
type Ledger = {
  transport: string;
  reads: Read[];
  writes: string[];
  held: boolean;
  released: string[];
  unexpected: number;
};

const { control, preflight } = fixtureDriver("n25");
const ledger = async (): Promise<Ledger> => (await control("state")).json();
const phase = (name: string) => control(`phase?name=${name}`, "POST");
const popup = () => [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].find(
  (dialog) => dialog.getAttribute("aria-labelledby") &&
    dialog.querySelector("h2")?.textContent === "Linkrichtung prüfen",
);
const trigger = (target = "DEMO-2") => button(`Richtung der Verknüpfung zu ${target} prüfen`);
const phaseReads = async (name: string) => (await ledger()).reads.filter((read) => read.phase === name);
const sequence = (reads: readonly Read[]) => reads.map(({ method, path, query, status }) => [method, path + query, status]);
const account = ["GET", "/myself", 200];
const issue = (key: string, status: number | "held" = 200) => ["GET", `/issue/${key}?fields=issuelinks`, status];
const edge = (key: string, side: "inwardIssue" | "outwardIssue", id = "n25-link-42", typeId = "10000") => ({
  id, type: { id: typeId, name: "Blocks", outward: "blocks", inward: "is blocked by" }, [side]: { key },
});
const candidates = (title: string) => [...(popup()?.querySelectorAll(`section[aria-label="${title}"] li`) ?? [])].map(
  (row) => row.textContent?.trim(),
);
const suggestions = () => candidates("Umgekehrte Richtung");

async function open(target: string) {
  const control = await wait(() => trigger(target), `link preview entry for ${target}`);
  control.focus();
  check(document.activeElement === control, "Could not focus link preview entry");
  control.click();
  await wait(() => {
    const heading = popup()?.querySelector("h2");
    return heading && heading === document.activeElement;
  }, "preview heading receives focus");
}

async function escape(target: string) {
  const focused = document.activeElement;
  check(!!focused && !!popup()?.contains(focused), "Escape did not originate in the preview");
  focused?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  await wait(() => !popup() && document.activeElement === trigger(target), "Escape closes the preview and returns focus to the link");
}

async function navigate(target: string) {
  await click(() => document.querySelector<HTMLAnchorElement>(`a[data-row-link][href="/issue/${target}"]`), `regular ticket link to ${target}`);
  await wait(() => location.pathname === `/issue/${target}`, `ticket route for ${target}`);
}

async function valid(name: "outward" | "inward" | "new-account", source: string, target: string) {
  await wait(() => trigger(target), `current link list for ${source}`);
  await phase(name);
  same(await phaseReads(name), [], "Preview queried before selection");
  await open(target);
  await wait(() => suggestions().length === 2, `fresh ${name} preview`);
  check(popup()?.textContent.includes("Linktyp Blocks (10000)"), "Preview did not show the confirmed link type");
  const outward = "DEMO-1 blocks DEMO-2";
  const inward = "DEMO-2 is blocked by DEMO-1";
  const reversedOutward = "DEMO-1 is blocked by DEMO-2";
  const reversedInward = "DEMO-2 blocks DEMO-1";
  same(candidates("Aktuell"), name === "inward" ? [inward, outward] : [outward, inward], "Wrong current relationship");
  same(suggestions(), name === "inward" ? [reversedInward, reversedOutward] : [reversedOutward, reversedInward], "Wrong reversed relationship");
  const reads = await phaseReads(name);
  same(sequence(reads), [account, issue(source), issue(target), account], "Unexpected selected-link read sequence");
  const side = name === "inward" ? "inwardIssue" : "outwardIssue";
  const reciprocal = side === "inwardIssue" ? "outwardIssue" : "inwardIssue";
  same([reads[1]?.links?.[0], reads[2]?.links?.[0]], [edge(target, side), edge(source, reciprocal)],
    "HTTPS ledger did not prove the exact selected link ID, type and reciprocal endpoints");
  check(reads.every((read) => read.account === (name === "new-account" ? "mock-user-001" : "mock-user-000")), "Preview used the wrong account");
  await escape(target);
  same(sequence(await phaseReads(name)), sequence(reads), "Escape dispatched another request");
  await phase("idle");
}

async function blocked(name: "denied" | "changed-link" | "changed-type", message: string) {
  await phase(name);
  await open("DEMO-2");
  await wait(() => popup()?.querySelector('[role="alert"]')?.textContent === message, `explicit ${name} error`);
  same(suggestions(), [], "Unconfirmed link produced a reverse proposal");
  const reads = await phaseReads(name);
  same(sequence(reads), [account, issue("DEMO-1"), issue("DEMO-2", name === "denied" ? 403 : 200)],
    "Rejected link continued to another request");
  if (name !== "denied") {
    const changed = name === "changed-link" ? edge("DEMO-1", "inwardIssue", "n25-link-46")
      : edge("DEMO-1", "inwardIssue", "n25-link-42", "10004");
    same(reads[2]?.links, [changed], "Fixture error did not isolate the link or type ID change");
  }
  await escape("DEMO-2");
  await phase("idle");
}

async function lateAccount() {
  await phase("account");
  await open("DEMO-2");
  await wait(async () => (await ledger()).held, "old endpoint response held on the HTTPS server");
  await wait(() => popup()?.querySelector('[role="status"][aria-label="Beide Tickets werden geprüft"]'), "pending link preview");
  same(sequence(await phaseReads("account")), [account, issue("DEMO-1"), issue("DEMO-2", "held")], "Wrong delayed journey");
  await control("switch-account", "POST");
  check(await window.__N25_REFRESH_ACCOUNT__() === "mock-user-001", "Renderer did not verify account B");
  await wait(() => !popup(), "old dialog closed after account switch");
  await wait(async () => (await phaseReads("account")).some(({ path, account }) =>
    path === "/issue/DEMO-1" && account === "mock-user-001"), "fresh link list for account B");
  await control("release", "POST");
  await wait(async () => (await ledger()).released.length === 1, "late HTTPS response released");
  check(!popup(), "Late account A response reopened the preview");
  same(sequence((await phaseReads("account")).filter(({ account }) => account === "mock-user-000")),
    [account, issue("DEMO-1"), issue("DEMO-2")], "Late account A response dispatched a further account check");
  await valid("new-account", "DEMO-1", "DEMO-2");
  check(!popup(), "Old result became visible again");
}

async function run() {
  check(new URL(window.__C1_JIRA_ORIGIN__).protocol === "https:", "N25 did not start with a local HTTPS origin");
  await preflight();
  history.replaceState(null, "", "/issue/DEMO-1");
  await import("../../../src/main");

  await valid("outward", "DEMO-1", "DEMO-2");
  check(!!trigger("DEMO-3") && !trigger("DEMO-4"), "Fixture did not expose the directed decoy and suppress the symmetric link");
  await navigate("DEMO-2");
  await valid("inward", "DEMO-2", "DEMO-1");
  await navigate("DEMO-1");
  await wait(() => trigger("DEMO-2"), "source link list on return");
  await blocked("denied", "Mindestens ein Ticket ist für dieses Konto nicht lesbar.");
  const unconfirmed = "Die gerichtete Beziehung konnte auf beiden Tickets nicht eindeutig bestätigt werden.";
  await blocked("changed-link", unconfirmed);
  await blocked("changed-type", unconfirmed);
  await lateAccount();

  await signOut();
  const final = await ledger();
  check(final.transport === "https" && final.unexpected === 0 && !final.held, "Unexpected request or incomplete HTTPS fixture");
  same(final.writes, [], "N25 sent a Jira write");
  check(final.reads.every(({ origin }) => origin === "tauri://localhost"), "Jira reads did not use the Tauri HTTP origin");
  console.log("N25 passed: both perspectives, exact link and type, denied and changed endpoints, late account response, Escape and focus return; zero Jira writes");
}

void run().then(
  () => invoke("fixture_finish"),
  (error: unknown) => invoke("fixture_finish", { error: String(error) }),
);
