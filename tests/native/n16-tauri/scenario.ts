import { invoke } from "@tauri-apps/api/core";
import {
  button,
  check,
  click,
  fixtureDriver,
  same,
  wait,
} from "../c1-tauri/driver";
import { ticketTitle } from "../n17-tauri/note";
import { otherTitle } from "./server";

declare global {
  interface Window {
    __N16_TICKET__: (id: number) => Promise<void>;
    __N16_REFRESH_ACCOUNT__: () => Promise<{
      revision?: string;
      userId?: number;
    }>;
  }
}

type Connection = { baseUrl: string; revision: string };
type Read = { path: string; credential: string };
type HeldRead = Read & { label: string };
type Ledger = {
  sourceReads: (Read & { status: number })[];
  requests: (Read & { method: string })[];
  writes: unknown[];
  released: HeldRead[];
  held: HeldRead | null;
  unexpectedRequests: string[];
};

const { preflight, control } = fixtureDriver("n16");
const ledger = async (): Promise<Ledger> => (await control("state")).json();
const sourcePath = (id: number) =>
  `/api/v1/ticket_articles/by_ticket/${id}?expand=true`;
const connect = (token: "fixture-a" | "fixture-b") =>
  invoke<Connection>("zammad_connect", {
    baseUrl: window.__N17_ZAMMAD_ORIGIN__,
    token,
  });
const manual = {
  cc: '"Team, Nord" <Team@example.test>,  manual@example.test',
  to: "manual-to@example.test",
  subject: "Manueller Betreff",
  body: "Manueller Antworttext vor Kontoauflösung",
};
const dialog = () =>
  document.querySelector<HTMLElement>('[role="dialog"][data-state="open"]');
const trigger = () => button("CC aus Quellmail prüfen");
const insert = () => button("Auswahl übernehmen", dialog());
const choices = () => [
  ...(dialog()?.querySelectorAll<HTMLButtonElement>(
    'button[role="checkbox"]',
  ) ?? []),
];
const address = (item: HTMLElement) => item.parentElement?.textContent?.trim();
const field = (name: keyof typeof manual) =>
  document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `[name="${name}"]`,
  );

async function fill(name: keyof typeof manual, value: string) {
  const target = await wait(() => field(name), `composer field ${name}`);
  target.focus();
  const prototype =
    target instanceof HTMLInputElement
      ? HTMLInputElement.prototype
      : HTMLTextAreaElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(target, value);
  target.dispatchEvent(new Event("input", { bubbles: true }));
  await wait(() => target.value === value, `preserved input ${name}`);
}

const selectReply = async (author = "Sam Kunde") => {
  await click(
    () => button(`Auf Nachricht von ${author} antworten`),
    `choose source from ${author}`,
  );
  await wait(
    () => document.activeElement === field("body"),
    "reply editor focused",
  );
};

const assertDraft = (expected: typeof manual) =>
  wait(
    () =>
      Object.entries(expected).every(
        ([name, value]) => field(name as keyof typeof manual)?.value === value,
      ),
    "exact local CC, To, subject and body",
  );

async function showSource() {
  const entry = await wait(trigger, "CC source action for confirmed account");
  entry.focus();
  entry.click();
  await wait(
    () => dialog()?.querySelector("h2")?.textContent === "CC aus der Quellmail",
    "N16 source picker opened",
  );
}

async function expectChoices(expected: string[]) {
  await wait(
    () =>
      choices().length === expected.length &&
      choices().every((item) => !item.closest("[inert]")),
    "loaded source candidates",
  );
  same(choices().map(address), expected, "Exact delivered CCs");
  check(
    choices().every((item) => item.getAttribute("aria-checked") === "false"),
    "A CC was selected automatically",
  );
}

async function choose(email: string) {
  const choice = await wait(
    () => choices().find((item) => address(item) === email),
    `candidate ${email}`,
  );
  choice.focus();
  choice.click();
  await wait(
    () => choice.getAttribute("aria-checked") === "true",
    `chosen ${email}`,
  );
}

async function cancel() {
  await click(() => button("Abbrechen", dialog()), "cancel CC picker");
  await wait(() => !dialog(), "cancelled picker closed");
}

async function hold(label: string) {
  await control(`hold/${label}`, "POST");
  await showSource();
  await wait(
    async () => (await ledger()).held?.label === label,
    `${label} source GET held on TLS server`,
  );
}

async function release(label: string) {
  await control("release", "POST");
  await wait(
    async () => (await ledger()).released.some((read) => read.label === label),
    `${label} GET released`,
  );
}

async function go(id: number, title: string) {
  await window.__N16_TICKET__(id);
  await wait(
    () =>
      document.querySelector("main h1")?.getAttribute("aria-label") === title,
    `regular Zammad ticket ${id}`,
  );
}

const noWrites = async (phase: string) =>
  same((await ledger()).writes, [], `${phase} sent a Zammad write`);

async function initialAccount() {
  await control("hold/identity", "POST");
  history.replaceState(null, "", "/helpdesk/41");
  await import("../../../src/main");
  await wait(
    async () => (await ledger()).held?.label === "identity",
    "first renderer /users/me held after native connect",
  );
  await selectReply();
  for (const name of ["cc", "to", "subject", "body"] as const)
    await fill(name, manual[name]);
  await assertDraft(manual);
  check(!trigger(), "Source action accessible before identity was known");
  await release("identity");
  await wait(trigger, "source action after identity became known");
  await assertDraft(manual);
  await noWrites("Initial account resolution");
}

async function confirmOnlySelected() {
  const before = (await ledger()).sourceReads.length;
  await showSource();
  await expectChoices([
    "team@example.test",
    "keep@example.test",
    "skip@example.test",
    "manual-to@example.test",
  ]);
  same(
    (await ledger()).sourceReads.slice(before),
    [{ path: sourcePath(41), credential: "A", status: 200 }],
    "Fresh native article read for selected source",
  );
  check(insert()?.disabled, "An empty selection could be confirmed");
  await choose("keep@example.test");
  await cancel();
  await assertDraft(manual);
  await showSource();
  await expectChoices([
    "team@example.test",
    "keep@example.test",
    "skip@example.test",
    "manual-to@example.test",
  ]);
  for (const email of [
    "team@example.test",
    "keep@example.test",
    "manual-to@example.test",
  ])
    await choose(email);
  await assertDraft(manual);
  await noWrites("Preview and selection");
  const action = await wait(insert, "explicit CC insert");
  action.focus();
  await wait(
    () => action === document.activeElement && !action.closest("[inert]"),
    "insert focused in open picker",
  );
  action.click();
  await wait(() => !dialog(), "confirmed picker closed");
  await assertDraft({ ...manual, cc: `${manual.cc}, keep@example.test` });
  await noWrites("Confirmed local CC insert");
}

async function invalidAndDenied() {
  check(
    !button("Auf Nachricht von Interne Quelle antworten"),
    "An internal note can be selected for CC",
  );
  for (const author of ["Ohne CC", "Unklare CC", "Ungültige CC"]) {
    await selectReply(author);
    await showSource();
    await wait(
      () => dialog()?.innerText.includes("Keine sicher lesbaren CC-Adressen"),
      `safe empty state for ${author}`,
    );
    check(
      !choices().length && !insert(),
      `Unexpected recipient inferred from ${author}`,
    );
    await cancel();
  }
  await selectReply();
  await control("deny-source", "POST");
  await showSource();
  await wait(
    () =>
      dialog()
        ?.querySelector('[role="alert"]')
        ?.textContent?.includes("Keine Berechtigung"),
    "403 source error shown",
  );
  check(!choices().length && !insert(), "403 still shows stale CC choices");
  await cancel();
  await noWrites("Invalid or inaccessible source metadata");
}

async function ticketSwitch() {
  await hold("ticket");
  await go(42, otherTitle);
  await selectReply();
  await assertDraft({
    cc: "",
    to: "sam@example.test",
    subject: `Re: ${otherTitle}`,
    body: "",
  });
  await release("ticket");
  check(!dialog(), "Late ticket source reopened picker");
  await showSource();
  await expectChoices(["other@example.test"]);
  await cancel();
  await go(41, ticketTitle);
  await wait(
    () => field("cc")?.value === `${manual.cc}, keep@example.test`,
    "ticket 41 local CC retained after navigation",
  );
  await noWrites("Ticket switch and late source response");
}

async function accountSwitch(first: Connection) {
  await hold("account");
  const second = await connect("fixture-b");
  check(
    first.baseUrl === second.baseUrl && first.revision !== second.revision,
    "Native connection revision did not change",
  );
  same(
    await window.__N16_REFRESH_ACCOUNT__(),
    { revision: second.revision, userId: 8 },
    "Renderer did not observe the second native account",
  );
  await wait(
    () =>
      !dialog() && !trigger() && !field("cc") && field("body")?.value === "",
    "previous account picker and draft removed",
  );
  await release("account");
  check(!dialog(), "Late account source reopened picker");
  await selectReply();
  await assertDraft({
    cc: "",
    to: "sam@example.test",
    subject: "Re: Anmeldung schlägt fehl",
    body: "",
  });
  const before = (await ledger()).sourceReads.length;
  await showSource();
  await expectChoices([
    "team@example.test",
    "keep@example.test",
    "skip@example.test",
    "manual-to@example.test",
  ]);
  same(
    (await ledger()).sourceReads.slice(before),
    [{ path: sourcePath(41), credential: "B", status: 200 }],
    "New account's native source reread",
  );
  await cancel();
  await noWrites("Account switch and late source response");
}

async function run() {
  await preflight();
  same(
    await invoke("zammad_connection_get"),
    null,
    "Expected empty Zammad credentials",
  );
  const first = await connect("fixture-a");
  same(
    await invoke("zammad_connection_get"),
    first,
    "Native connection round trip",
  );
  await initialAccount();
  await confirmOnlySelected();
  await invalidAndDenied();
  await ticketSwitch();
  await accountSwitch(first);
  const final = await ledger();
  same(final.unexpectedRequests, [], "Unexpected fixture request");
  check(
    final.requests.every(
      ({ method, credential }) => method === "GET" && credential,
    ),
    "Unexpected native Zammad request method or credential",
  );
  await invoke("zammad_disconnect");
  same(
    await invoke("zammad_connection_get"),
    null,
    "Private Zammad credentials survived disconnect",
  );
  await invoke("session_delete");
  same(
    await invoke("session_get"),
    null,
    "Private Jira session survived fixture shutdown",
  );
}

void run().then(
  () => invoke("fixture_finish"),
  (error: unknown) => invoke("fixture_finish", { error: String(error) }),
);
