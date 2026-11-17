import { invoke } from "@tauri-apps/api/core";
import { button, check, click, fixtureDriver, same, signOut, wait } from "./driver";

const { control, preflight } = fixtureDriver("c1");
const comparison = () => document.querySelector('[role=group][aria-labelledby="description-comparison-title"]');
const editor = () => document.querySelector<HTMLElement>('[role=textbox][aria-label="Beschreibung"]');
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
type Ledger = {
  reads: { cloud: string; status: number | "pending"; description?: unknown }[];
  writes: { path: string; payload: unknown; status: number }[];
  unexpected: number;
  held: boolean;
};
const ledger = async (): Promise<Ledger> => (await control("state")).json();
const paragraph = (text: string) => ({ type: "doc", version: 1, content: [
  { type: "paragraph", content: [{ type: "text", text }] },
] });

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
  await signOut();
  await wait(() => !editor(), "description editor to close after logout");
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
