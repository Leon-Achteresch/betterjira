import { expect, test, type Page } from "@playwright/test";

const open = (page: Page, account = "qa-user") => page.goto(`/tests/browser/fixture.html?scenario=create&route=/neu&account=${account}`);
const main = (page: Page) => page.getByRole("main");
const title = (page: Page) => main(page).getByRole("textbox", { name: "Titel", exact: true });
const submit = (page: Page) => main(page).getByRole("button", { name: "Erstellen", exact: true });
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
  await main(page).getByRole("button", { name: "Vorlagen", exact: true }).click();
  await page.getByRole("textbox", { name: "Neue Vorlage", exact: true }).fill("Quartalsbericht");
  await page.getByRole("textbox", { name: "Neue Vorlage", exact: true }).press("Enter");
  await expect(page.getByRole("button", { name: "Quartalsbericht", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await title(page).fill("Anderer Titel");
  await main(page).getByRole("button", { name: "Vorlagen", exact: true }).click();
  await page.getByRole("button", { name: "Quartalsbericht", exact: true }).click();
  await expect(title(page)).toHaveValue("Wiederkehrender Bericht");
  await page.getByRole("button", { name: "Rückgängig", exact: true }).last().click();
  await expect(title(page)).toHaveValue("Anderer Titel");
  await open(page);
  await main(page).getByRole("button", { name: "Vorlagen", exact: true }).click();
  await page.getByRole("button", { name: "Vorlage Quartalsbericht löschen", exact: true }).click();
  await expect(page.getByRole("button", { name: "Quartalsbericht", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Rückgängig", exact: true }).last().click();
  await choose(page, "Vorgangstyp", /Fehler/);
  await main(page).getByRole("button", { name: "Vorlagen", exact: true }).click();
  await expect(page.getByRole("button", { name: "Quartalsbericht", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await choose(page, "Vorgangstyp", /Aufgabe/);
  await main(page).getByRole("button", { name: "Vorlagen", exact: true }).click();
  await expect(page.getByRole("button", { name: "Quartalsbericht", exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.__qa.writes)).toEqual([]);
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
