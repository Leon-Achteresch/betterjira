import { expect, test, type Page, type TestInfo } from "@playwright/test";
import descriptionWithMedia from "../jira/fixtures/description-adf-media.json" with { type: "json" };

type Write = { path: string; method: string; input: { fields?: { description?: unknown } } };
type QaIssue = { key: string; fields: { description: unknown } };
type QaWindow = { __qa: { writes: Write[]; reads: string[]; issues: QaIssue[]; wiki: Record<string, string | null>; failNextWrite: boolean; failDescriptionRead: boolean } };

const ISSUE = "/tests/browser/fixture.html?route=/issue/DEMO-1";
const remote = (text: string) => ({ type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
const setRemoteDescription = (page: Page, doc: unknown) =>
  page.evaluate((value) => { (window as unknown as QaWindow).__qa.issues.find((issue) => issue.key === "DEMO-1")!.fields.description = value; }, doc);
const changeRemote = (page: Page, text: string) => setRemoteDescription(page, remote(text));
const descriptionWrites = (page: Page) =>
  page.evaluate(() => (window as unknown as QaWindow).__qa.writes.filter((write) => write.method === "PUT" && write.path === "/issue/DEMO-1" && write.input.fields?.description !== undefined));
const panel = (page: Page) => page.getByRole("group", { name: "Beschreibung wurde in Jira geändert" });
const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  const dir = process.env.DESCRIPTION_CONFLICT_SHOTS;
  if (dir) await page.locator("form").filter({ has: panel(page) }).screenshot({ path: `${dir}/${testInfo.project.name}-${name}.png` });
};
const confirm = (page: Page) => panel(page).getByRole("button", { name: "Entwurf trotzdem speichern" });
const openDescription = async (page: Page) => {
  await page.getByRole("button", { name: "Beschreibung bearbeiten" }).press("Enter");
  const editor = page.getByRole("textbox", { name: "Beschreibung" });
  await expect(editor).toBeFocused();
  return editor;
};

test("Konflikt zeigt Jira-Fassung, Cmd/Ctrl+Enter bestaetigt nie und R zu R2 verlangt erneute Pruefung", async ({ page }, testInfo) => {
  await page.goto(ISSUE);
  await page.getByRole("button", { name: "Beschreibung bearbeiten" }).click();
  const editor = page.getByRole("textbox", { name: "Beschreibung" });
  await expect(editor).toBeFocused();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(" Lokaler Zusatz");
  await changeRemote(page, "Fremde Änderung R");

  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(panel(page)).toBeVisible();
  await expect(panel(page).getByRole("heading", { name: "Beschreibung wurde in Jira geändert" })).toBeFocused();
  await expect(panel(page).getByLabel("Aktuell in Jira")).toContainText("Fremde Änderung R");
  await expect(panel(page).getByLabel("Stand bei Bearbeitungsbeginn")).toContainText("weniger Kontextwechseln");
  await expect(editor).toContainText("Lokaler Zusatz");
  await expect(confirm(page)).toBeDisabled();

  await editor.click();
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(panel(page)).toBeVisible();
  expect(await descriptionWrites(page)).toHaveLength(0);

  await panel(page).getByRole("checkbox").click();
  await expect(confirm(page)).toBeEnabled();
  await changeRemote(page, "Erneute Änderung R2");
  await confirm(page).click();
  await expect(panel(page).getByLabel("Aktuell in Jira")).toContainText("Erneute Änderung R2");
  await expect(panel(page).getByRole("checkbox")).not.toBeChecked();
  await expect(confirm(page)).toBeDisabled();
  expect(await descriptionWrites(page)).toHaveLength(0);
  await shot(page, testInfo, "r2");

  await panel(page).getByRole("checkbox").click();
  await confirm(page).click();
  await expect(editor).toHaveCount(0);
  const writes = await descriptionWrites(page);
  expect(writes).toHaveLength(1);
  expect(JSON.stringify(writes[0]?.input.fields?.description)).toContain("Lokaler Zusatz");
  expect(JSON.stringify(writes[0]?.input.fields?.description)).not.toContain("Erneute Änderung R2");
});

test("Altdraft ohne Basis bleibt bis zur bewussten Pruefung erhalten", async ({ page }) => {
  await page.addInitScript((local) => {
    const id = JSON.stringify(["qa-cloud", "qa-user", "DEMO-1", "description#adf"]);
    localStorage.setItem("betterjira-field-drafts", JSON.stringify({ state: { drafts: { [id]: { text: JSON.stringify(local), revision: "legacy" } } }, version: 0 }));
  }, remote("Alter lokaler Entwurf"));
  await page.goto(ISSUE);
  await page.getByRole("button", { name: "Beschreibung: Entwurf fortsetzen" }).click();
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  const unbased = page.getByRole("group", { name: "Ursprüngliche Fassung fehlt" });
  await expect(unbased).toBeVisible();
  await expect(unbased.getByText("Für diesen Entwurf nicht gespeichert.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Beschreibung" })).toContainText("Alter lokaler Entwurf");
  expect(await descriptionWrites(page)).toHaveLength(0);
  await unbased.getByRole("checkbox").click();
  await unbased.getByRole("button", { name: "Entwurf trotzdem speichern" }).click();
  await expect(page.getByRole("textbox", { name: "Beschreibung" })).toHaveCount(0);
  expect(await descriptionWrites(page)).toHaveLength(1);
});

test("Wiki-Rohtext bleibt exakt und null zu leer verlangt erneute Pruefung", async ({ page }) => {
  await page.goto(ISSUE);
  await page.getByRole("button", { name: "Beschreibung bearbeiten" }).click();
  await page.getByRole("button", { name: "Wiki-Markup", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Text bearbeiten" });
  const local = "h1. Lokal\n\n  eingerückt  \n|| a || b ||";
  await editor.fill(local);
  await page.evaluate(() => { (window as unknown as QaWindow).__qa.wiki["DEMO-1"] = null; });
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(panel(page)).toBeVisible();
  await panel(page).getByRole("checkbox").click();
  await page.evaluate(() => { (window as unknown as QaWindow).__qa.wiki["DEMO-1"] = ""; });
  await confirm(page).click();
  await expect(panel(page).getByRole("checkbox")).not.toBeChecked();
  await expect(confirm(page)).toBeDisabled();
  expect(await descriptionWrites(page)).toHaveLength(0);
  await expect(editor).toHaveValue(local);
  await panel(page).getByRole("checkbox").click();
  await confirm(page).click();
  await expect(editor).toHaveCount(0);
  expect((await descriptionWrites(page))[0]?.input.fields?.description).toBe(local);
});

test("GET- und Writefehler bei Vergleich behalten den editierbaren Entwurf", async ({ page }) => {
  await page.goto(ISSUE);
  await page.getByRole("button", { name: "Beschreibung bearbeiten" }).click();
  const editor = page.getByRole("textbox", { name: "Beschreibung" });
  await editor.press("ControlOrMeta+End"); await page.keyboard.type(" Lokaler Fehlerentwurf");
  await changeRemote(page, "Remote vor Fehler");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await panel(page).getByRole("checkbox").click();
  await page.evaluate(() => { (window as unknown as QaWindow).__qa.failDescriptionRead = true; });
  await confirm(page).click();
  await expect(page.getByRole("alert").filter({ hasText: "Beschreibung nicht lesbar" })).toBeVisible();
  await expect(editor).toContainText("Lokaler Fehlerentwurf");
  expect(await descriptionWrites(page)).toHaveLength(0);
  await page.evaluate(() => { (window as unknown as QaWindow).__qa.failDescriptionRead = false; });
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(panel(page)).toBeVisible();
  await panel(page).getByRole("checkbox").click();
  await page.evaluate(() => { (window as unknown as QaWindow).__qa.failNextWrite = true; });
  await confirm(page).click();
  await expect(page.getByRole("alert").filter({ hasText: "vorübergehend nicht erreichbar" })).toBeVisible();
  await expect(editor).toContainText("Lokaler Fehlerentwurf");
  expect(await descriptionWrites(page)).toHaveLength(0);
});

const startConflict = async (page: Page, url = ISSUE) => {
  await page.goto(url);
  const editor = await openDescription(page);
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(" Lokaler Zusatz");
  await changeRemote(page, "Fremde Änderung R");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(panel(page)).toBeVisible();
  return editor;
};
const toast = (page: Page, text: string) => page.locator("[data-sonner-toast]").filter({ hasText: text });

test("ADF-Vorschau ist lesbar und die unveraenderte Quelle bleibt per Tab erreichbar", async ({ page }, testInfo) => {
  await startConflict(page);
  const current = panel(page).getByRole("region", { name: "Aktuell in Jira" });
  await expect(current).toContainText("Fremde Änderung R");
  await expect(current).not.toContainText("\"type\"");
  await expect(panel(page).getByRole("region", { name: "Stand bei Bearbeitungsbeginn" })).toContainText("weniger Kontextwechseln");
  await shot(page, testInfo, "preview");
  await panel(page).getByRole("tab", { name: "Quelle" }).click();
  const source = panel(page).getByLabel("Aktuell in Jira");
  expect(JSON.parse(await source.innerText())).toEqual(remote("Fremde Änderung R"));
  await shot(page, testInfo, "source");
  expect(await descriptionWrites(page)).toHaveLength(0);
});

test("Uebernahme der Jira-Fassung ist lokal, rueckgaengig und speichert basisgetreu", async ({ page }) => {
  const editor = await startConflict(page);
  await panel(page).getByRole("button", { name: "In Entwurf übernehmen" }).click();
  await expect(panel(page)).toHaveCount(0);
  await expect(editor).toBeFocused();
  await expect(editor).toContainText("Fremde Änderung R");
  await expect(editor).not.toContainText("Lokaler Zusatz");
  expect(await descriptionWrites(page)).toHaveLength(0);

  await toast(page, "Jira-Fassung in den Entwurf übernommen").getByRole("button", { name: "Rückgängig" }).click();
  await expect(editor).toContainText("Lokaler Zusatz");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(panel(page)).toBeVisible();
  expect(await descriptionWrites(page)).toHaveLength(0);

  await panel(page).getByRole("button", { name: "In Entwurf übernehmen" }).click();
  await expect(editor).toBeFocused();
  await expect(editor).toContainText("Fremde Änderung R");
  await page.keyboard.type(" Ergänzt");
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(editor).toHaveCount(0);
  const writes = await descriptionWrites(page);
  expect(writes).toHaveLength(1);
  const written = JSON.stringify(writes[0]?.input.fields?.description);
  expect(written).toContain("Fremde Änderung R Ergänzt");
  expect(written).not.toContain("Lokaler Zusatz");
});

test("Nach Uebernahme verlangt R zu R2 wieder einen Vergleich", async ({ page }) => {
  const editor = await startConflict(page);
  await panel(page).getByRole("button", { name: "In Entwurf übernehmen" }).click();
  await expect(panel(page)).toHaveCount(0);
  await changeRemote(page, "Erneute Änderung R2");
  await editor.press("ControlOrMeta+Enter");
  await expect(panel(page).getByRole("region", { name: "Aktuell in Jira" })).toContainText("Erneute Änderung R2");
  await expect(panel(page).getByRole("region", { name: "Stand bei Bearbeitungsbeginn" })).toContainText("Fremde Änderung R");
  await expect(panel(page).getByRole("checkbox")).not.toBeChecked();
  expect(await descriptionWrites(page)).toHaveLength(0);
});

test("Vorschau zeigt Medien, Mentions und Tabellen der Remotefassung ueber bekannte Anhaenge", async ({ page }) => {
  await page.goto("/tests/browser/fixture.html?scenario=adf-images&route=/issue/DEMO-1");
  await page.getByRole("button", { name: "Beschreibung bearbeiten" }).click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(" Lokal");
  await page.evaluate(() => {
    const issue = (window as unknown as QaWindow).__qa.issues.find((entry) => entry.key === "DEMO-1")!;
    issue.fields.description = { type: "doc", version: 1, content: [
      { type: "paragraph", content: [{ type: "text", text: "Remote mit " }, { type: "mention", attrs: { id: "u1", text: "@Ada Remote" } }] },
      { type: "mediaSingle", attrs: { layout: "center", width: 480, widthType: "pixel" }, content: [{ type: "media", attrs: { id: "uuid-a", type: "file", collection: "", width: 1200, height: 600 } }] },
      { type: "mediaSingle", attrs: { layout: "center" }, content: [{ type: "media", attrs: { id: "uuid-neu", type: "file", collection: "", alt: "Neu hochgeladen.png" } }] },
      { type: "mediaSingle", attrs: { layout: "center" }, content: [{ type: "media", attrs: { id: "uuid-andere-datei", type: "file", collection: "", alt: "Ablauf Übergabe.png" } }] },
      { type: "table", content: [{ type: "tableRow", content: [{ type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Spalte" }] }] }] }, { type: "tableRow", content: [{ type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Remote-Zelle" }] }] }] }] },
    ] };
  });
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  const current = panel(page).getByRole("region", { name: "Aktuell in Jira" });
  await expect(current).toContainText("@Ada Remote");
  await expect(current.getByRole("cell", { name: "Remote-Zelle" })).toBeVisible();
  await expect(current.locator("[data-attachment-id=\"46883\"]")).toHaveCount(1);
  await expect(current.locator("[data-attachment-id=\"46883\"]")).toBeVisible();
  await expect(current.locator("[data-adf-media=\"missing\"]").filter({ hasText: "Neu hochgeladen.png" })).toBeVisible();
  await expect(current.locator("[data-adf-media=\"missing\"]").filter({ hasText: "Ablauf Übergabe.png" })).toBeVisible();
  await panel(page).getByRole("tab", { name: "Quelle" }).click();
  await expect(panel(page).getByLabel("Aktuell in Jira")).toContainText("\"uuid-neu\"");
  expect(await descriptionWrites(page)).toHaveLength(0);
});

test("390 px: Vergleich ohne Seitenueberlauf und per Tastatur pruef- und bestaetigbar", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const editor = await startConflict(page);
  await expect(panel(page).getByRole("heading", { name: "Beschreibung wurde in Jira geändert" })).toBeFocused();
  const box = await panel(page).boundingBox();
  expect((box?.x ?? -1) >= 0 && (box?.x ?? 0) + (box?.width ?? 999) <= 390).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await shot(page, testInfo, "390");

  await page.keyboard.press("Tab");
  await expect(panel(page).getByRole("tab", { name: "Vorschau" })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(panel(page).getByRole("tab", { name: "Quelle" })).toBeFocused();
  await expect(panel(page).getByRole("tab", { name: "Quelle" })).toHaveAttribute("aria-selected", "true");
  const checkbox = panel(page).getByRole("checkbox");
  for (let step = 0; step < 8 && !(await checkbox.evaluate((node) => node === document.activeElement)); step++) await page.keyboard.press("Tab");
  await expect(checkbox).toBeFocused();
  await page.keyboard.press("Space");
  await expect(checkbox).toBeChecked();
  await page.keyboard.press("Tab");
  await expect(confirm(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(editor).toHaveCount(0);
  expect(await descriptionWrites(page)).toHaveLength(1);
});

const MEDIA_ISSUE = "/tests/browser/fixture.html?scenario=adf-images&route=/issue/DEMO-1";
const alteredExtension = {
  ...descriptionWithMedia,
  content: descriptionWithMedia.content.map((node) => node.type === "extension"
    ? { ...node, attrs: { ...node.attrs, revision: "R2" } }
    : node),
};
const draftKey = JSON.stringify(["qa-cloud", "qa-user", "DEMO-1", "description#adf"]);
const persistedDraft = (page: Page) => page.evaluate((key) => {
  const raw = localStorage.getItem("betterjira-field-drafts");
  return raw && JSON.parse(raw).state.drafts[key];
}, draftKey);

test("ADF-Vorschau kennzeichnet unbekannte Knoten und Medien und erhält die Rohquelle bei erneuter Prüfung", async ({ page }, info) => {
  if (info.project.name === "narrow-dark-reduced") await page.setViewportSize({ width: 390, height: 844 });
  const externalRequests: string[] = [];
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (["http:", "https:"].includes(url.protocol) && url.hostname !== "127.0.0.1") {
      externalRequests.push(url.href);
      return route.abort();
    }
    return route.continue();
  });
  await page.goto(MEDIA_ISSUE);
  const original = await page.evaluate(() =>
    (window as unknown as QaWindow).__qa.issues.find((issue) => issue.key === "DEMO-1")!.fields.description,
  );
  const editor = await openDescription(page);
  await page.keyboard.type(" Lokal");
  await setRemoteDescription(page, descriptionWithMedia);
  await editor.press("ControlOrMeta+Enter");
  const comparison = panel(page);
  const heading = comparison.getByRole("heading", { name: "Beschreibung wurde in Jira geändert" });
  const current = comparison.getByRole("region", { name: "Aktuell in Jira" });
  await expect(heading).toBeFocused();
  await expect(current).toContainText("Lesbarer Text innerhalb der Erweiterung");
  await expect(current).toContainText("Text im verschachtelten Hinweis");
  await expect(current).toContainText("danach lesbar.");
  await expect(current.getByText("Nur in der Quelle darstellbar", { exact: true })).toHaveCount(3);
  await expect(current.locator("[data-attachment-id='46883']")).toHaveCount(1);
  await expect(current.locator("[data-attachment-id='46886']")).toBeVisible();
  for (const name of ["Einzelmedium.bin", "Ablauf Übergabe.png", "Externes Gruppenbild", "Externes Einzelbild"]) {
    await expect(current.locator("[data-adf-media='missing']").filter({ hasText: name })).toBeVisible();
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(info.project.name === "narrow-dark-reduced" ? 390 : 1440);
  await shot(page, info, "adf-media-preview");

  await page.keyboard.press("Tab");
  await expect(comparison.getByRole("tab", { name: "Vorschau" })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(comparison.getByRole("tab", { name: "Quelle" })).toBeFocused();
  const source = comparison.getByLabel("Aktuell in Jira");
  const checkbox = comparison.getByRole("checkbox");
  const tabTo = async (target: typeof source) => {
    for (let step = 0; step < 8 && !(await target.evaluate((node) => node === document.activeElement)); step++) {
      await page.keyboard.press("Tab");
    }
    await expect(target).toBeFocused();
  };
  await tabTo(source);
  expect(JSON.parse(await source.innerText())).toEqual(descriptionWithMedia);
  expect(JSON.parse(await comparison.getByLabel("Stand bei Bearbeitungsbeginn").innerText())).toEqual(original);
  await tabTo(checkbox);
  await page.keyboard.press("Space");
  await page.keyboard.press("Tab");
  await expect(confirm(page)).toBeFocused();
  await setRemoteDescription(page, alteredExtension);
  await page.keyboard.press("Enter");
  await expect(heading).toBeFocused();
  await expect(checkbox).not.toBeChecked();
  await expect(confirm(page)).toBeDisabled();
  await comparison.getByRole("tab", { name: "Quelle" }).click();
  expect(JSON.parse(await source.innerText())).toEqual(alteredExtension);
  expect(await descriptionWrites(page)).toHaveLength(0);
  expect(externalRequests).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as QaWindow).__qa.reads.filter(
    (path) => path === "/group.png" || path === "/single.png",
  ))).toEqual([]);
});

test("Übernahme und Abbruch behalten ADF und Medien exakt; der bestätigte Write enthält nur die explizite Textänderung", async ({ page }, info) => {
  if (info.project.name === "narrow-dark-reduced") await page.setViewportSize({ width: 390, height: 844 });
  const editor = await startConflict(page, MEDIA_ISSUE);
  await setRemoteDescription(page, descriptionWithMedia);
  await editor.press("ControlOrMeta+Enter");
  await expect(panel(page).getByRole("region", { name: "Aktuell in Jira" })).toContainText("Jira-Schluss");
  const adopt = panel(page).getByRole("button", { name: "In Entwurf übernehmen" });
  await adopt.focus();
  await page.keyboard.press("Enter");
  await expect(panel(page)).toHaveCount(0);
  await expect(editor).toBeFocused();
  const adopted = await persistedDraft(page);
  expect(JSON.parse(adopted.text)).toEqual(descriptionWithMedia);
  expect(adopted.basis.value).toEqual(descriptionWithMedia);
  expect(await descriptionWrites(page)).toHaveLength(0);

  await page.keyboard.press("Escape");
  await expect(editor).toHaveCount(0);
  expect(await persistedDraft(page)).toEqual(adopted);
  expect(await descriptionWrites(page)).toHaveLength(0);
  const reopen = page.getByRole("button", { name: "Beschreibung: Entwurf fortsetzen" });
  await reopen.focus();
  await page.keyboard.press("Enter");
  await expect(editor).toBeFocused();
  await expect(editor).toContainText("Jira-Schluss");
  await page.keyboard.type(" ergänzt");
  const expected = { ...descriptionWithMedia, content: [...descriptionWithMedia.content.slice(0, -1), ...remote("Jira-Schluss ergänzt").content] };

  await setRemoteDescription(page, alteredExtension);
  await editor.press("ControlOrMeta+Enter");
  await expect(panel(page).getByRole("heading", { name: "Beschreibung wurde in Jira geändert" })).toBeFocused();
  await panel(page).getByRole("tab", { name: "Quelle" }).click();
  expect(JSON.parse(await panel(page).getByLabel("Stand bei Bearbeitungsbeginn").innerText())).toEqual(descriptionWithMedia);
  expect(JSON.parse(await panel(page).getByLabel("Aktuell in Jira").innerText())).toEqual(alteredExtension);
  expect(await descriptionWrites(page)).toHaveLength(0);
  await panel(page).getByRole("checkbox").focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("Tab");
  await expect(confirm(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(editor).toHaveCount(0);
  expect((await descriptionWrites(page)).map((write) => write.input)).toEqual([{ fields: { description: expected } }]);
});
