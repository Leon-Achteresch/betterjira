import { invoke } from "@tauri-apps/api/core";
import { button, check, click, fixtureDriver, same, signOut, wait } from "../c1-tauri/driver";

declare global {
  interface Window { __N01_LINK_RUNS__: () => string[] }
}

const { control, preflight } = fixtureDriver("n01");
type Ledger = {
  writes: { target: string; path: string; payload: unknown; status: number }[];
  reads: { kind: "ticket" | "permission"; key: string; id?: string }[];
  unexpected: number;
  held: string | null;
  released: string[];
};
const ledger = async (): Promise<Ledger> => (await control("state")).json();
const dialog = () => document.querySelector<HTMLElement>('[role=dialog][aria-label="Mehrere Tickets verknüpfen"]');
const rows = () => [...(dialog()?.querySelectorAll('[aria-label="Geprüfte Zielmenge"] li') ?? [])];
const row = (key: string) => rows().find((entry) => [...entry.querySelectorAll("span")].some((span) => span.textContent === key));
const confirmButton = () => button("Geprüfte Verknüpfungen bestätigen", dialog());
const previewButton = () => button("Vorschau prüfen", dialog());
const writable = () => confirmButton()?.getAttribute("aria-disabled") === "false";
const press = (element: HTMLElement, key: string) => {
  element.focus();
  element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
};
const fill = async (text: string) => {
  const input = await wait(() => dialog()?.querySelector<HTMLTextAreaElement>("#multi-link-targets"), "explicit target keys");
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set?.call(input, text);
  input.dispatchEvent(new Event("input", { bubbles: true }));
};
const open = async (label: string) => {
  await click(() => button("Mehrere Tickets verknüpfen"), "issue detail multi-link entry");
  const select = await wait(() => dialog()?.querySelector<HTMLElement>('#multi-link-type[role="combobox"]'), "relationship type");
  press(select, "Enter");
  const option = await wait(() => [...document.querySelectorAll<HTMLElement>("[role=option]")].find(
    (element) => element.textContent.trim() === label,
  ), label);
  press(option, "Enter");
  await wait(() => select.textContent.includes(label), "chosen relationship");
};
const preview = async (keys: string, direction: string) => {
  await fill(keys);
  await click(previewButton, "read preview");
  await wait(() => {
    const view = dialog()?.querySelector('[aria-label="Vorschau"]');
    return writable() && view?.getClientRects().length && view.textContent.includes("Nur gelesen")
      && view.textContent.includes(direction);
  }, `visible read-only preview for ${direction} and explicit confirmation`);
  check(dialog()?.textContent.includes("mock-jira.atlassian.net"), "Preview did not show the scoped Jira account");
};
const waitSettled = async (count: number) => {
  await wait(() => window.__N01_LINK_RUNS__().length === count && window.__N01_LINK_RUNS__().every((state) => state === "success"), `${count} completed application mutations`);
};
const hold = async (key: string) => {
  await control(`hold?key=${key}`, "POST");
  await click(confirmButton, `confirm ${key}`);
  await wait(async () => (await ledger()).held === key && window.__N01_LINK_RUNS__().at(-1) === "pending", `confirmed permission read for ${key}`);
};

const expectedWrites = ([
  ["DEMO-2", 201], ["DEMO-3", 403], ["DEMO-5", 503],
] as const).map(([target, status]) => ({
  target, status, path: "/ex/jira/mock-cloud/rest/api/3/issueLink",
  payload: { type: { id: "10000" }, inwardIssue: { key: target }, outwardIssue: { key: "DEMO-4" } },
}));
const checkWrites = async (detail: string) => same((await ledger()).writes.sort((a, b) => a.target.localeCompare(b.target)), expectedWrites, detail);

async function run() {
  await preflight();
  history.replaceState(null, "", "/issue/DEMO-4");
  await import("../../../src/main");

  await open("is blocked by · inward");
  await fill(Array.from({ length: 21 }, (_, index) => `QA-${index + 1}`).join(" "));
  await wait(() => dialog()?.querySelector('[role=alert]')?.textContent.includes("Maximal 20"), "existing 20-target limit");
  check(previewButton()?.disabled, "Oversized target list enabled the preview");
  const before = await ledger();
  const keys = ["DEMO-2", "DEMO-3", "DEMO-5", "DEMO-6"];
  const draft = "DEMO-6, demo-2; DEMO-5\nDEMO-3";
  await preview(draft, "DEMO-4 is blocked by … (inward)");
  same(rows().map((entry) => keys.find((key) => entry.textContent.includes(`N01 Fixture ${key}`))), keys, "Preview did not show the four explicit targets");
  check(keys.every((key) => row(key)?.textContent.includes("Bereit")), "Preview contained an ineligible row");
  const inspected = await ledger();
  same(inspected.writes, [], "Opening the editor or preview sent a Jira POST");
  same(inspected.reads.slice(before.reads.length).filter(({ kind }) => kind === "ticket").map(({ key }) => key).sort(),
    ["DEMO-2", "DEMO-3", "DEMO-4", "DEMO-5", "DEMO-6"], "Preview read unexpected ticket keys");

  await fill("DEMO-7");
  await wait(() => !confirmButton(), "old confirmation invalidated by editing target keys");
  same((await ledger()).writes, [], "Editing targets sent a Jira POST");
  await preview(draft, "DEMO-4 is blocked by … (inward)");
  await control("change-target?changed=true", "POST");
  const confirmation = await wait(confirmButton, "mixed-run confirmation");
  confirmation.click();
  confirmation.click();
  await waitSettled(1);
  await wait(() => dialog()?.querySelector('[role=status]')?.textContent.includes("1 Bestätigt · 1 Abgelehnt · 1 Unklar · 1 Nicht begonnen"), "per-target partial outcomes");
  for (const [key, result] of [
    ["DEMO-2", "Bestätigt"], ["DEMO-3", "Von Jira abgelehnt (HTTP 403)"],
    ["DEMO-5", "Ausgang unklar"], ["DEMO-6", "Ziel, Berechtigung oder Kontext geändert"],
  ] as const) check(row(key)?.textContent.includes(result), `${key} lacked ${result}`);
  await checkWrites("Expected one exact native POST per unchanged, confirmed target and no retries");
  await click(previewButton, "fresh read after mixed response");
  await wait(() => row("DEMO-5")?.textContent.includes("Früherer Ausgang unklar")
    && row("DEMO-2")?.textContent.includes("bereits bestätigt"), "safe local ledger in fresh preview");
  await checkWrites("Refreshing the preview retried a Jira POST");
  await control("change-target?changed=false", "POST");

  await preview("DEMO-6", "DEMO-4 is blocked by … (inward)");
  await hold("DEMO-6");
  await checkWrites("An unchecked final permission dispatched a POST");
  const target = await wait(() => [...document.querySelectorAll<HTMLAnchorElement>('main a[href="/issue/DEMO-2"]')].find(
    (link) => link.getClientRects().length,
  ), "the newly linked ticket in issue details");
  target.click();
  await wait(() => location.pathname === "/issue/DEMO-2" && !dialog(), "issue context changed");
  await control("release", "POST");
  await waitSettled(2);
  await checkWrites("Switching issue context let an additional Jira POST through");

  await open("blocks · outward");
  await preview("DEMO-7", "DEMO-2 blocks … (outward)");
  await hold("DEMO-7");
  await signOut();
  await wait(() => !dialog(), "multi-link editor closed on account loss");
  await control("release", "POST");
  await waitSettled(3);
  await checkWrites("Signing out let an additional Jira POST through");
  const final = await ledger();
  same(final.released, ["DEMO-6", "DEMO-7"], "Both blocked permission reads must be released");
  check(!final.held && final.unexpected === 0, "Unexpected stub call or pending fixture request");
  same(final.reads.filter(({ key, kind }) => key === "DEMO-6" && kind === "ticket").map(({ id }) => id),
    ["10005", "10005", "99106", "99106", "10005", "10005"], "Fresh reads did not detect the changed target identity");
}

void run().then(
  () => invoke("fixture_finish"),
  (error: unknown) => invoke("fixture_finish", { error: String(error) }),
);
