import { invoke } from "@tauri-apps/api/core";
import { button, check, click, fixtureDriver, same, wait } from "../c1-tauri/driver";
import { articleFrom, articleText, articleTime, expectedNote, quote, ticketTitle } from "./note";

declare global {
  interface Window {
    __N17_ZAMMAD_ORIGIN__: string;
    __N17_REFRESH_CONNECTION__: () => Promise<string | undefined>;
  }
}
type Connection = { baseUrl: string; revision: string };
type Ledger = {
  sourceReads: { path: string; credential: string }[];
  identities: string[];
  writes: unknown[];
  released: string[];
  held: boolean;
  armed: boolean;
  unexpectedRequests: string[];
};
const { control, preflight } = fixtureDriver("n17");
const ledger = async (): Promise<Ledger> => (await control("state")).json();
const connect = (token: "fixture-a" | "fixture-b") =>
  invoke<Connection>("zammad_connect", { baseUrl: window.__N17_ZAMMAD_ORIGIN__, token });
const oldDraft = "Meine ungesendete Kundenantwort";
const originalCc = "team@example.test";
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"][aria-label="Interne Notiz mit Quellzitat vorbereiten"]');
const composer = () => document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Nachricht"]');
const cc = () => document.querySelector<HTMLInputElement>('input[name="cc"]');
const to = () => document.querySelector<HTMLInputElement>('input[name="to"]');
const quoteButton = () => button("Als interne Notiz zitieren", document.querySelector('article[aria-label="Nachricht"]'));
const insert = () => button("In internen Entwurf übernehmen", dialog());
const sourcePath = "/ticket_articles/by_ticket/41?expand=true";

const fill = (field: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  field.focus();
  const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(field, value);
  field.dispatchEvent(new Event("input", { bubbles: true }));
};
const message = async (text: string) => {
  try {
    await wait(() => composer()?.value === text, "expected composer draft");
  } catch (error) {
    throw new Error(`Expected ${JSON.stringify(text)}, found ${JSON.stringify(composer()?.value)}. ${String(error)}`);
  }
};
const noWrites = async (phase: string) => same((await ledger()).writes, [], phase);
const selectEmail = async () => {
  const control = await wait(() => button("Kommunikationsart wählen"), "composer type selector");
  control.focus();
  control.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  await click(() => [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    .find((item) => item.textContent.trim().startsWith("E-Mail")), "select email draft");
  await wait(() => !document.querySelector('[role="menu"]') && document.activeElement === control,
    "communication menu finished closing and restored focus");
  await wait(cc, "email recipient fields");
};
const showSource = async () => {
  const source = await wait(() => {
    const action = quoteButton();
    return action && !action.disabled ? action : undefined;
  }, "quote action with confirmed connection");
  source.focus();
  source.click();
  await wait(() => dialog()?.getAttribute("data-state") === "open", "source popover opened");
};
const canInsert = () => wait(() => {
  const action = insert();
  return action && !action.disabled && !action.closest("[inert]") ? action : undefined;
}, "source reread and explicit insert available");
const assertOriginal = async () => {
  await message(oldDraft);
  await wait(() => cc()?.value === originalCc && to()?.value === "sam@example.test", "original recipients in email draft");
};
const rejectIpc = async (request: Promise<unknown>, expected: string) => {
  try {
    await request;
  } catch (error) {
    check(String(error).includes(expected), `Wrong native rejection: ${String(error)}`);
    return;
  }
  throw new Error(`Native IPC did not reject: ${expected}`);
};

async function sendExplicitNote() {
  await selectEmail();
  fill(await wait(composer, "email draft"), oldDraft);
  fill(await wait(cc, "email CC"), originalCc);
  await assertOriginal();
  const before = (await ledger()).sourceReads.length;
  await showSource();
  await canInsert();
  const preview = dialog()?.innerText ?? "";
  for (const text of [articleFrom, articleTime, articleText, "Quellbeitrag 11"])
    check(preview.includes(text), `Missing source preview: ${text}`);
  same((await ledger()).sourceReads.slice(before), [{ path: `/api/v1${sourcePath}`, credential: "A" }], "Source was not freshly read over native HTTPS");
  await assertOriginal();
  await noWrites("Opening the quote preview sent a write");
  const action = await canInsert();
  action.focus();
  await wait(() => action === document.activeElement && !action.closest("[inert]"), "explicit insert focused in the open source popover");
  action.click();
  await message(`${quote}\n\n`);
  check(button("Kommunikationsart wählen")?.disabled, "Quote editor allowed switching to email");
  await wait(() => !cc() && !to(), "recipient fields removed in internal editor");
  fill(await wait(composer, "internal quote"), expectedNote.body);
  await click(() => button("Zum bisherigen Entwurf"), "reopen the original email draft");
  await assertOriginal();
  await click(() => button("Internen Zitatentwurf öffnen"), "resume the internal quote");
  await message(expectedNote.body);
  await noWrites("Editing and switching drafts sent a write");

  await click(() => button("Intern kommentieren"), "explicitly submit one internal note");
  await message("");
  await wait(() => document.querySelector("main")?.innerText.includes("Meine interne Antwort."), "saved internal article shown in conversation");
  same((await ledger()).writes, [{ method: "POST", path: "/api/v1/ticket_articles", credential: "A", body: expectedNote }],
    "Native ledger did not record only the exact internal plaintext note");
  await click(() => button("Zum bisherigen Entwurf"), "return to the preserved email after the write");
  await assertOriginal();
}

async function staleRevision(original: Connection) {
  await control("hold", "POST");
  await showSource();
  await wait(async () => (await ledger()).held && dialog()?.querySelector('[aria-label="Quelle wird geprüft"]'), "old source read parked on the TLS fixture");
  await assertOriginal();
  const second = await connect("fixture-b");
  check(second.baseUrl === original.baseUrl && second.revision !== original.revision, "Native credential rotation did not advance the revision");
  same(await window.__N17_REFRESH_CONNECTION__(), second.revision, "Renderer did not observe the native revision B");
  await wait(() => !dialog(), "previous quote closed after connection rotation");
  const restored = await connect("fixture-a");
  check(new Set([original.revision, second.revision, restored.revision]).size === 3, "Native A→B→A revived an earlier revision");
  same(await window.__N17_REFRESH_CONNECTION__(), restored.revision, "Renderer did not observe the restored credentials' new revision");
  const before = await ledger();
  const error = "Zammad-Verbindung wurde gewechselt. Es wurde keine Anfrage gesendet.";
  await rejectIpc(invoke("zammad_request", { method: "GET", path: sourcePath, connectionScope: original }), error);
  await rejectIpc(invoke("zammad_request", {
    method: "POST", path: "/ticket_articles", body: JSON.stringify(expectedNote), connectionScope: original,
  }), error);
  const guarded = await ledger();
  same(guarded.sourceReads, before.sourceReads, "Stale scoped GET reached HTTPS");
  same(guarded.writes, before.writes, "Stale scoped POST reached HTTPS");

  await control("release", "POST");
  await wait(async () => (await ledger()).released.length === 1, "old source response released after A→B→A");
  same((await ledger()).released, ["A"], "Delayed request lost its original credential");
  check(!dialog(), "Late source response reopened an outdated preview");
  await message("");
  await wait(() => !cc() && !to(), "old email draft not revived by A→B→A");
  await showSource();
  await canInsert();
  check(dialog()?.innerText.includes(articleText) && !dialog()?.innerText.includes("Verspäteter Quelltext"), "Fresh preview contained the old response");
  const selected = await wait(insert, "close the new preview without inserting");
  selected.focus();
  selected.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  await wait(() => !dialog(), "preview closed without inserting");
  await message("");
  same((await ledger()).writes, before.writes, "Late response or fresh preview sent a write");
}

async function run() {
  await preflight();
  same(await invoke("zammad_connection_get"), null, "Fixture did not start with an empty Zammad credential store");
  await rejectIpc(invoke("zammad_connect", {
    baseUrl: window.__N17_ZAMMAD_ORIGIN__.replace("https:", "http:"), token: "fixture-a",
  }), "HTTPS-Adresse");
  await rejectIpc(invoke("zammad_connect", {
    baseUrl: window.__C1_CANARY_ORIGIN__.replace("http:", "https:"), token: "fixture-a",
  }), "private HTTPS origin");
  const original = await connect("fixture-a");
  same(await invoke("zammad_connection_get"), original, "Native connection IPC round trip failed");
  history.replaceState(null, "", "/helpdesk/41");
  await import("../../../src/main");
  await wait(() => document.querySelector("main h1")?.getAttribute("aria-label") === ticketTitle, "regular helpdesk detail");
  await sendExplicitNote();
  await staleRevision(original);
  const final = await ledger();
  check(final.identities.includes("B") && final.identities.at(-1) === "A" && !final.held && !final.armed, "Credential rotation or delayed read was not exercised");
  same(final.unexpectedRequests, [], "Unexpected fixture request");
  await invoke("zammad_disconnect");
  same(await invoke("zammad_connection_get"), null, "Native disconnect did not remove private credentials");
  await invoke("session_delete");
  same(await invoke("session_get"), null, "Private Jira fixture session was not removed");
}

void run().then(
  () => invoke("fixture_finish"),
  (error: unknown) => invoke("fixture_finish", { error: String(error) }),
);
