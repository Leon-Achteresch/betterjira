import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __qaCreateFieldsRule?: (projectId: string, typeId: string, fields: readonly { fieldId: string }[]) => unknown;
  }
}

const open = (page: Page, account = "qa-user") => page.goto(`/tests/browser/fixture.html?scenario=create&route=/neu&account=${account}`);
const main = (page: Page) => page.getByRole("main");
const title = (page: Page) => main(page).getByRole("textbox", { name: "Titel", exact: true });
const submit = (page: Page) => main(page).getByRole("button", { name: "Erstellen", exact: true });
const templates = (page: Page) => page.getByRole("dialog", { name: "Ticketvorlagen" });
const templateGroup = (page: Page, name: string) => templates(page).locator("section").filter({
  has: page.getByRole("heading", { name, exact: true }),
});
const currentTemplates = (page: Page) => templateGroup(page, "Für dieses Projekt und diesen Typ");
const otherTemplates = (page: Page) => templateGroup(page, "Weitere Vorlagen dieses Kontos");
const QUARTERLY_REPORT = "Quartalsbericht Produktentwicklung · Aufgabe";
const openTemplates = (page: Page) => main(page).getByRole("button", { name: "Vorlagen", exact: true }).click();
const saveReportTemplate = async (page: Page) => {
  await openTemplates(page);
  const name = templates(page).getByRole("textbox", { name: "Neue Vorlage", exact: true });
  await name.fill("Quartalsbericht");
  await name.press("Enter");
  await expect(currentTemplates(page).getByRole("button", { name: QUARTERLY_REPORT, exact: true })).toBeVisible();
};
const choose = async (page: Page, label: string, option: RegExp) => {
  await main(page).getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option }).click();
};
const fillTask = async (page: Page) => {
  await choose(page, "Projekt", /Produktentwicklung/);
  await title(page).fill("Wiederkehrender Bericht");
  await main(page).getByRole("textbox", { name: "Beschreibung", exact: true }).fill("Beschreibung des Berichts");
  await choose(page, "Priorität", /^Hoch$/);
  await main(page).getByRole("textbox", { name: "Kunde", exact: true }).fill("ACME");
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => { throw error; });
});

test("Entwurf überlebt Neustart und bleibt an das Konto gebunden", async ({ page }) => {
  await open(page);
  await fillTask(page);
  await open(page);
  await expect(title(page)).toHaveValue("Wiederkehrender Bericht");
  await expect(main(page).getByRole("textbox", { name: "Beschreibung", exact: true })).toHaveText("Beschreibung des Berichts");
  await expect(main(page).getByRole("textbox", { name: "Kunde", exact: true })).toHaveValue("ACME");
  await expect(main(page).getByRole("combobox", { name: "Priorität", exact: true })).toContainText("Hoch");
  await open(page, "colleague");
  await expect(title(page)).toHaveValue("");
  await title(page).fill("Anderes Konto");
  await open(page);
  await expect(title(page)).toHaveValue("Wiederkehrender Bericht");
});

test("Vorlagen speichern, anwenden und löschen mit Rückgängig", async ({ page }) => {
  await open(page);
  await fillTask(page);
  await saveReportTemplate(page);
  await page.keyboard.press("Escape");
  await title(page).fill("Anderer Titel");
  await openTemplates(page);
  const report = { name: QUARTERLY_REPORT, exact: true };
  await currentTemplates(page).getByRole("button", report).click();
  await expect(title(page)).toHaveValue("Wiederkehrender Bericht");
  await page.getByRole("button", { name: "Rückgängig", exact: true }).last().click();
  await expect(title(page)).toHaveValue("Anderer Titel");
  await open(page);
  await openTemplates(page);
  await templates(page).getByRole("button", { name: "Vorlage Quartalsbericht löschen", exact: true }).click();
  await expect(templates(page).getByRole("button", report)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Rückgängig", exact: true }).last().click();
  await choose(page, "Vorgangstyp", /Fehler/);
  await openTemplates(page);
  await expect(currentTemplates(page).getByRole("button", report)).toHaveCount(0);
  await expect(otherTemplates(page).getByRole("button", report)).toBeVisible();
  await expect(title(page)).toHaveValue("Anderer Titel");
  await page.keyboard.press("Escape");
  await choose(page, "Vorgangstyp", /Aufgabe/);
  await openTemplates(page);
  await expect(currentTemplates(page).getByRole("button", report)).toBeVisible();
  expect(await page.evaluate(() => window.__qa.writes)).toEqual([]);
  await open(page, "colleague");
  await choose(page, "Projekt", /Produktentwicklung/);
  await openTemplates(page);
  await expect(templates(page).getByRole("button", report)).toHaveCount(0);
  expect(await page.evaluate(() => window.__qa.writes)).toEqual([]);
});

test("Projektfremde Vorlage wird bewusst im gewählten Ziel angewendet und erstellt nur passende Felder", async ({ page }) => {
  await page.addInitScript(() => {
    window.__qaCreateFieldsRule = (projectId, typeId, fields) => {
      if (projectId !== "2" || typeId !== "20001") return;
      return [
        ...fields.filter(({ fieldId }) => fieldId !== "customfield_team"),
        { fieldId: "description", name: "Beschreibung", required: false, schema: { type: "string", system: "description" }, operations: ["set"] },
        { fieldId: "priority", name: "Priorität", required: true, schema: { type: "priority" }, operations: ["set"], allowedValues: [{ id: "2", name: "Hoch" }, { id: "4", name: "Niedrig" }] },
      ];
    };
  });
  await open(page);
  await fillTask(page);
  await saveReportTemplate(page);
  await page.keyboard.press("Escape");
  await choose(page, "Projekt", /Betrieb/);
  await title(page).fill("Manueller Zielentwurf");
  await choose(page, "Priorität", /^Niedrig$/);

  await openTemplates(page);
  const source = otherTemplates(page).getByRole("button", { name: QUARTERLY_REPORT, exact: true });
  await expect(source).toBeVisible();
  await expect(title(page)).toHaveValue("Manueller Zielentwurf");
  await expect(main(page).getByRole("combobox", { name: "Priorität", exact: true })).toContainText("Niedrig");
  expect(await page.evaluate(() => window.__qa.writes)).toEqual([]);
  await source.press("Enter");
  await expect(title(page)).toHaveValue("Wiederkehrender Bericht");
  await expect(main(page).getByRole("combobox", { name: "Projekt", exact: true })).toContainText("Betrieb");
  await expect(main(page).getByRole("combobox", { name: "Vorgangstyp", exact: true })).toContainText("Störung");
  await expect(main(page).getByRole("combobox", { name: "Priorität", exact: true })).toContainText("Hoch");
  await expect(main(page).getByRole("textbox", { name: "Kunde", exact: true })).toHaveCount(0);
  const skipped = main(page).getByRole("button", { name: "Nicht angewendet: 1", exact: true });
  await skipped.click();
  const reasons = page.getByRole("dialog", { name: "Nicht angewendete Vorlagenwerte" });
  await expect(reasons).toContainText("Kunde");
  await expect(reasons).toContainText("ACME");
  await expect(reasons).toContainText("Dieses Feld wird im gewählten Ziel nicht zur Eingabe angeboten.");
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => window.__qa.writes)).toEqual([]);

  await submit(page).click();
  await expect(page).toHaveURL(/\/issue\/OPS-4$/);
  const writes = await page.evaluate(() => window.__qa.writes.filter((write) => write.method === "POST" && write.path === "/issue"));
  expect(writes.map((write) => write.input.fields)).toEqual([{
    project: { id: "2" },
    issuetype: { id: "20001" },
    summary: "Wiederkehrender Bericht",
    description: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: "Beschreibung des Berichts" }] }] },
    priority: { id: "2" },
  }]);
});

test("Weitererfassung behält Kontext und verhindert doppelte Tickets", async ({ page }) => {
  await open(page);
  await fillTask(page);
  await main(page).getByRole("checkbox", { name: "Weiteres Ticket erstellen" }).check();
  await page.evaluate(() => { window.__qa.delayMs = 600; });
  await submit(page).dblclick();
  await page.keyboard.press("Control+Enter");
  await expect(page.getByText("DEMO-4 erstellt", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/neu$/);
  await expect(title(page)).toHaveValue("");
  await expect(title(page)).toBeFocused();
  await expect(main(page).getByRole("textbox", { name: "Beschreibung", exact: true })).toHaveText("");
  await expect(main(page).getByRole("textbox", { name: "Kunde", exact: true })).toHaveValue("ACME");
  await expect(main(page).getByRole("combobox", { name: "Priorität", exact: true })).toContainText("Hoch");
  await title(page).fill("Zweiter Bericht");
  await main(page).getByRole("checkbox", { name: "Weiteres Ticket erstellen" }).uncheck();
  await submit(page).click();
  await expect(page).toHaveURL(/\/issue\/DEMO-5$/);
  expect(await page.evaluate(() => window.__qa.writes.filter((write) => write.path === "/issue" && write.method === "POST"))).toHaveLength(2);
  await open(page);
  await expect(title(page)).toHaveValue("");
});

test("Entwurf verwerfen ist rückgängig und überschreibt keine neue Eingabe", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await fillTask(page);
  await main(page).getByRole("button", { name: "Entwurf verwerfen" }).click();
  await expect(title(page)).toHaveValue("");
  await page.getByRole("button", { name: "Rückgängig", exact: true }).last().click();
  await expect(title(page)).toHaveValue("Wiederkehrender Bericht");
  await main(page).getByRole("button", { name: "Entwurf verwerfen" }).click();
  await title(page).fill("Neuer Entwurf");
  await page.getByRole("button", { name: "Rückgängig", exact: true }).last().click();
  await expect(title(page)).toHaveValue("Neuer Entwurf");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
