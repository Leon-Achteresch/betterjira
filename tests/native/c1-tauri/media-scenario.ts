import { invoke } from "@tauri-apps/api/core";
import { button, check, click, fixtureDriver, same, signOut, wait } from "./driver";
import { append, comparison, confirm, confirmButton, currentPreview, editor, openEditor, requireConflict, save } from "./description-driver";
import { expectedMediaWrite, mediaDocuments } from "./media-documents";

const { control, preflight } = fixtureDriver("c1");
type Ledger = {
  reads: { cloud: string; status: number | "pending"; description?: unknown }[];
  writes: { path: string; payload: unknown; status: number }[];
  renderedReads: number;
  mediaRequests: string[];
  unexpected: number;
  held: boolean;
};
const ledger = async (): Promise<Ledger> => (await control("state")).json();
const remote = (revision: Exclude<keyof typeof mediaDocuments, "initial">) => control(`remote?revision=${revision}`, "POST");
const noPut = async (detail: string) => same((await ledger()).writes, [], detail);
const comparisonHeading = () => comparison()?.querySelector("#description-comparison-title");
const readSource = async (label: string) => {
  const source = await wait(() => comparison()?.querySelector(`pre[aria-label="${label}"]`), `${label} ADF source`);
  check(source.getClientRects().length && source.getAttribute("tabindex") === "0", `${label} source is not readable and focusable`);
  return JSON.parse(source.textContent ?? "");
};
const compareSources = async (jira: unknown, basis: unknown) => {
  const source = await wait(() => button("Quelle", comparison()), "source tab");
  if (source.getAttribute("aria-selected") !== "true") {
    const preview = await wait(() => button("Vorschau", comparison()), "preview tab");
    preview.focus();
    preview.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    await wait(() => source.getAttribute("aria-selected") === "true" && document.activeElement === source, "source tab selected and focused");
  }
  same(await readSource("Aktuell in Jira"), jira, "Jira source lost or changed ADF data");
  same(await readSource("Stand bei Bearbeitungsbeginn"), basis, "Basis source lost or changed ADF data");
};
const checkUnresolvedMedia = async () => {
  const view = await wait(() => {
    const preview = currentPreview();
    return preview?.querySelectorAll('[data-adf-media="missing"]').length === 6 ? preview : undefined;
  }, "six unresolved media items in preview");
  for (const text of [
    "Jira-Einleitung", "Lesbarer Text innerhalb der Erweiterung", "Text im verschachtelten Hinweis",
    "Vor der Inline-Erweiterung", "danach lesbar.", "Jira-Schluss",
  ]) check(view.textContent?.includes(text), `Preview dropped readable text: ${text}`);
  same([...view.querySelectorAll("span[title]")]
    .filter((element) => element.textContent === "Nur in der Quelle darstellbar")
    .map((element) => element.getAttribute("title")), ["bodiedExtension", "extension", "inlineExtension"], "Unsupported nodes were not identified");
  check(view.querySelectorAll("[data-adf-media-single]").length === 2 && view.querySelectorAll("[data-adf-media-group]").length === 1,
    "Single and group media did not remain distinct in the preview");
  const placeholders = [...view.querySelectorAll('[data-adf-media="missing"]')];
  for (const label of ["Einzelmedium.bin", "Ablauf Übergabe.png", "Externes Gruppenbild", "Externes Einzelbild"])
    check(placeholders.some((item) => item.textContent?.includes(label) && item.getClientRects().length), `Missing media label: ${label}`);
  check(!view.querySelector("img, [data-attachment-id]"), "An unresolved media item was rendered as a fetched attachment");
};

async function run() {
  await preflight();
  const externalMediaRequests: string[] = [];
  const externalHost = "external-media.invalid";
  document.addEventListener("securitypolicyviolation", (event) => {
    if (event.blockedURI.includes(externalHost)) externalMediaRequests.push(event.blockedURI);
  });
  history.replaceState(null, "", "/issue/DEMO-1");
  await import("../../../src/main");
  const { useFieldDraftStore } = await import("../../../src/hooks/use-field-drafts");
  const drafts = () => useFieldDraftStore.getState().drafts;

  await openEditor();
  await append(" Lokal");
  await remote("remote");
  await save();
  await requireConflict("Jira-Einleitung");
  check(document.activeElement === comparisonHeading(), "Conflict heading did not receive focus");
  check(editor()?.textContent === "C1 Medien-Ausgangsfassung Lokal", "Jira preview overwrote the local draft");
  await checkUnresolvedMedia();
  await compareSources(mediaDocuments.remote, mediaDocuments.initial);
  await noPut("The ADF comparison sent a PUT before confirmation");

  await remote("revised");
  await confirm();
  await wait(() => confirmButton()?.disabled && document.activeElement === comparisonHeading(), "renewed conflict for the changed extension attribute");
  await compareSources(mediaDocuments.revised, mediaDocuments.initial);
  check(editor()?.textContent === "C1 Medien-Ausgangsfassung Lokal", "Recheck changed the local draft");
  await noPut("Confirmation against stale opaque ADF data sent a PUT");

  await click(() => button("In Entwurf übernehmen", comparison()), "adopt revised ADF");
  await wait(() => !comparison() && editor()?.textContent.includes("Jira-Schluss"), "adopted ADF in editor");
  const adopted = drafts();
  const entry = Object.entries(adopted)[0];
  if (Object.keys(adopted).length !== 1 || !entry) throw new Error("Expected one scoped ADF draft");
  const [draftId, draft] = entry;
  same(JSON.parse(draft.text), mediaDocuments.revised, "Adoption changed the ADF source");
  same(draft.basis?.value, mediaDocuments.revised, "Adoption stored the wrong comparison basis");
  const persisted = () => JSON.parse(localStorage.getItem("betterjira-field-drafts") ?? "null")?.state?.drafts?.[draftId];
  same(persisted(), draft, "Adopted draft was not persisted");
  await noPut("Adoption sent a PUT");

  editor()?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  await wait(() => !editor(), "description editor to close after Escape");
  same(drafts(), adopted, "Cancel changed the ADF draft");
  same(persisted(), draft, "Cancel changed the persisted draft");
  await noPut("Cancel sent a PUT");
  await openEditor("Beschreibung: Entwurf fortsetzen");
  await append(" ergänzt");
  same(JSON.parse(drafts()[draftId]!.text), expectedMediaWrite, "Editor changed ADF outside the explicit text edit");

  await remote("newerText");
  await save();
  await requireConflict("Jira-Frischer Servertext");
  check(editor()?.textContent.includes("Jira-Schluss ergänzt") && !editor()?.textContent.includes("Jira-Frischer Servertext"),
    "New Jira text was not kept separate from the local edited draft");
  await compareSources(mediaDocuments.newerText, mediaDocuments.revised);
  await noPut("The fresh conflict sent a PUT before acknowledgement");
  await confirm();
  await wait(() => !editor(), "confirmed ADF save to close");
  const written = {
    path: "/ex/jira/mock-cloud/rest/api/3/issue/DEMO-1",
    payload: { fields: { description: expectedMediaWrite } },
    status: 204,
  };
  same((await ledger()).writes, [written], "Confirmed PUT did not preserve the complete ADF document");
  await wait(async () => !!button("Beschreibung bearbeiten")?.textContent.includes("Jira-Schluss ergänzt")
    && (await ledger()).renderedReads > 0, "updated description and rendered metadata after PUT");

  await openEditor();
  await append(" bleibt lokal");
  const pendingDraft = drafts()[draftId]!;
  await remote("beforeLogout");
  await save();
  await requireConflict("Jira-Fassung vor Abmeldung");
  await compareSources(mediaDocuments.beforeLogout, expectedMediaWrite);
  await control("hold", "POST");
  await confirm();
  await wait(async () => (await ledger()).held && useFieldDraftStore.getState().saving.length === 1, "confirmed final GET held by server");
  same((await ledger()).writes, [written], "Held final GET let a second PUT through");
  await signOut();
  await wait(() => !editor(), "editor to close after logout");
  await control("release", "POST");
  await wait(() => useFieldDraftStore.getState().saving.length === 0, "in-flight save to settle after scope loss");

  const final = await ledger();
  same(final.writes, [written], "Scope loss allowed a second PUT");
  same(drafts()[draftId], pendingDraft, "Scope loss removed or changed the local ADF draft");
  same(persisted(), pendingDraft, "Scope loss changed the persisted draft");
  check(final.reads.every(({ cloud, status }) => cloud === "mock-cloud" && status === 200), "Description GET failed or went to another scope");
  same(final.reads.map(({ description }) => description), [mediaDocuments.remote, mediaDocuments.revised,
    mediaDocuments.newerText, mediaDocuments.newerText, mediaDocuments.beforeLogout, mediaDocuments.beforeLogout], "Wrong Jira revisions in the fresh GET/PUT flow");
  same(final.mediaRequests, [], "The local HTTP stub saw a media payload request");
  same(externalMediaRequests, [], "The WebView attempted to load a fixture media URL");
  check(!performance.getEntriesByType("resource").some(({ name }) => name.includes(externalHost)), "A fixture media URL reached the WebView resource loader");
  check(final.unexpected === 0 && !final.held, "Unexpected Jira call or outstanding hold");
}

void run().then(
  () => invoke("fixture_finish"),
  (error: unknown) => invoke("fixture_finish", { error: String(error) }),
);
