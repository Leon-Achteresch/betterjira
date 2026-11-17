import { getIdentifier } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { fetch as nativeFetch } from "@tauri-apps/plugin-http";

declare global {
  interface Window {
    __C1_JIRA_ORIGIN__: string;
    __C1_CANARY_ORIGIN__: string;
  }
}

const origin = window.__C1_JIRA_ORIGIN__;
const canary = window.__C1_CANARY_ORIGIN__;
const check = (condition: unknown, detail: string) => {
  if (!condition) throw new Error(detail);
};
const reject = async (request: Promise<unknown>, detail: string, expected?: RegExp) => {
  try {
    await request;
  } catch (error) {
    check(!expected || expected.test(String(error)), `${detail}: ${String(error)}`);
    return;
  }
  throw new Error(detail);
};
const wait = async <T>(read: () => T | Promise<T>, detail: string) => {
  const deadline = performance.now() + 12_000;
  while (performance.now() < deadline) {
    const value = await read();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`Timed out waiting for ${detail} at ${location.pathname}. ${document.body.innerText.slice(-450)}`);
};
const button = (label: string, root: ParentNode | null = document) => [...(root?.querySelectorAll("button") ?? [])].find(
  (item) => item.getClientRects().length && (item.getAttribute("aria-label") ?? item.textContent.trim()) === label,
);
const comparison = () => document.querySelector('[role=group][aria-labelledby="description-comparison-title"]');
const editor = () => document.querySelector<HTMLElement>('[role=textbox][aria-label="Beschreibung"]');
const click = async (find: () => HTMLElement | undefined | null, detail: string) => {
  const control = await wait(find, detail);
  check(!control.matches(":disabled,[aria-disabled=true]"), `${detail} is disabled`);
  control.click();
};
const openEditor = () => click(() => button("Beschreibung bearbeiten"), "description editor");
const append = async (text: string) => {
  const field = await wait(() => {
    const current = editor();
    return current === document.activeElement ? current : undefined;
  }, "editor focus");
  const lastBlock = field.lastElementChild!;
  getSelection()!.collapse(lastBlock, lastBlock.childNodes.length);
  check(document.execCommand("insertText", false, text), "WebKit text input failed");
  await wait(() => field.textContent.includes(text), text);
};
const save = () => click(() => button("Speichern"), "description save");
const requireConflict = async (text: string) => {
  await wait(() => comparison()?.querySelector('[role=region][aria-label="Aktuell in Jira"]')?.textContent.includes(text), text);
  check(button("Entwurf trotzdem speichern", comparison())?.disabled, "Overwrite enabled without acknowledgement");
};
const confirm = async () => {
  await click(() => comparison()?.querySelector<HTMLElement>("[role=checkbox]"), "acknowledge comparison");
  await click(() => button("Entwurf trotzdem speichern", comparison()), "confirm draft");
};
const control = async (path: string, method = "GET") => {
  const response = await nativeFetch(`${origin}/__c1/${path}`, { method, headers: { Authorization: "Bearer mock" } });
  check(response.ok, `Fixture endpoint ${path} returned ${response.status}`);
  return response;
};
type Ledger = {
  reads: { cloud: string; status: number | "pending"; description?: unknown }[];
  writes: { path: string; payload: unknown; status: number }[];
  unexpected: number;
  held: boolean;
};
const ledger = async (): Promise<Ledger> => (await control("state")).json();
const same = (actual: unknown, expected: unknown, detail: string) => {
  const sorted = (value: unknown) => JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
  check(sorted(actual) === sorted(expected), detail);
};
const paragraph = (text: string) => ({ type: "doc", version: 1, content: [
  { type: "paragraph", content: [{ type: "text", text }] },
] });

async function preflight() {
  check(await getIdentifier() === "com.leon.betterjira.c1-ipc-fixture", "Wrong Tauri application identifier");
  check(!localStorage.length && !sessionStorage.length && !document.cookie, "WebView data is not fresh");
  await reject(window.fetch(`${canary}/webkit`), "WKWebView made a direct network request");
  await reject(window.fetch(`${origin}/__c1/browser-probe`), "WKWebView bypassed the native HTTP plugin");
  await reject(nativeFetch(`${canary}/http-plugin`), "HTTP plugin reached the blocked canary", /not allowed/i);
  await reject(invoke("oauth_login"), "OAuth command is registered", /not found/i);
  await reject(invoke("plugin:updater|check"), "Updater command is available", /not found|not allowed/i);
  const raw = await invoke<string>("session_get");
  check(JSON.parse(raw).accessToken === "mock", "Native session_get returned the wrong session");
  await invoke("session_set", { value: raw });
  check(await invoke("session_get") === raw, "Native session IPC round trip failed");
  check((await control("probe")).ok, "Stock HTTP plugin could not reach the local Jira fixture");
}

async function run() {
  await preflight();
  history.replaceState(null, "", "/issue/DEMO-1");
  await import("../../../src/main");
  const { useFieldDraftStore } = await import("../../../src/hooks/use-field-drafts");

  await openEditor();
  await append(" Lokal");
  await control("remote?revision=remote", "POST");
  await save();
  await requireConflict("C1 Jira-Fassung");
  check((await ledger()).writes.length === 0, "Conflict sent a PUT");
  await click(() => button("In Entwurf übernehmen", comparison()), "adopt remote");
  await wait(() => !comparison() && editor()?.textContent === "C1 Jira-Fassung", "adopted remote description");
  check((await ledger()).writes.length === 0, "Adoption sent a PUT");
  await append(" ergänzt");
  await control("remote?revision=revised", "POST");
  await save();
  await requireConflict("C1 Jira-Zwischenstand");
  await confirm();
  await wait(() => !editor(), "confirmed save");
  const written = {
    path: "/ex/jira/mock-cloud/rest/api/3/issue/DEMO-1",
    payload: { fields: { description: paragraph("C1 Jira-Fassung ergänzt") } },
    status: 204,
  };
  same((await ledger()).writes, [written], "Expected exactly one confirmed PUT with the editor ADF");
  await wait(() => document.querySelector("main")?.textContent?.includes("C1 Jira-Fassung ergänzt"), "refreshed description");

  await openEditor();
  await append(" bleibt lokal");
  await control("remote?revision=beforeLogout", "POST");
  await save();
  await requireConflict("C1 Jira-Fassung vor Abmeldung");
  await control("hold", "POST");
  await confirm();
  await wait(async () => (await ledger()).held && useFieldDraftStore.getState().saving.length === 1, "confirmed fresh GET at server");
  await click(() => button("Suchen"), "command palette");
  const search = await wait(() => document.querySelector<HTMLInputElement>('[role=combobox]'), "palette search");
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(search, "Abmelden");
  search.dispatchEvent(new Event("input", { bubbles: true }));
  await click(() => [...document.querySelectorAll<HTMLElement>("[role=option]")].find(
    (item) => item.textContent.includes("Abmelden"),
  ), "Jira logout");
  await wait(() => !editor() && !!button("Mit Atlassian verbinden"), "scope loss after logout");
  check(await invoke("session_get") === null, "Logout did not delete the private session");
  await control("release", "POST");
  await wait(() => useFieldDraftStore.getState().saving.length === 0, "in-flight save to settle after scope loss");
  const final = await ledger();
  same(final.writes, [written], "Scope loss allowed a second PUT");
  check(final.reads.length === 5 && final.reads.every(({ cloud, status }) => cloud === "mock-cloud" && status === 200),
    "Expected five completed fresh Jira description GETs");
  same(final.reads.at(-1)?.description, paragraph("C1 Jira-Fassung vor Abmeldung"),
    "Held GET did not return the acknowledged value");
  check(final.unexpected === 0 && !final.held, "Unexpected Jira call or outstanding hold");
}

void run().then(
  () => invoke("fixture_finish"),
  (error: unknown) => invoke("fixture_finish", { error: String(error) }),
);
