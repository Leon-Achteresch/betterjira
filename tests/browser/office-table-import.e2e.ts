import { expect, test, type Page } from "@playwright/test";
import { officeTableInitial, officeTableRemote, officeTableSaved, officeTableTsv } from "../jira/fixtures/description-office-table";

const ISSUE = "/tests/browser/fixture.html?route=/issue/DEMO-1";
type Write = { method: string; path: string; input: { fields?: { description?: unknown } } };
type Qa = { issues: Array<{ key: string; fields: { description: unknown } }>; writes: Write[] };

const open = async (page: Page) => {
  await page.addInitScript((description) => Reflect.set(window, "__qaInitialDescription", description), officeTableInitial);
  await page.goto(ISSUE);
  await page.getByRole("button", { name: "Beschreibung bearbeiten", exact: true }).press("Enter");
  await expect(editor(page)).toBeFocused();
};
const editor = (page: Page) => page.getByRole("textbox", { name: "Beschreibung", exact: true });
const table = (page: Page) => editor(page).locator("[data-adf-table-scroll]");
const writes = (page: Page) => page.evaluate(() => {
  const qa: Qa = Reflect.get(window, "__qa");
  return qa.writes;
});
const popup = (page: Page) => page.getByRole("dialog", { name: "Tabelle übernehmen" });
const importInput = (page: Page) => popup(page).getByLabel("Kopierte TSV-Zellen");
const insert = (page: Page) => popup(page).getByRole("button", { name: "In Entwurf einfügen" });
const showImport = async (page: Page) => {
  await page.getByRole("button", { name: "Tabelle aus Zwischenablage übernehmen" }).press("Enter");
  await expect(importInput(page)).toBeFocused();
};

test("TSV-Import ist ausdrücklich, lässt gewöhnliches Paste intakt und ist einzeln rückgängig", async ({ page }, info) => {
  if (info.project.name === "narrow-dark-reduced") await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await editor(page).evaluate((element) => {
    const clipboard = new DataTransfer();
    clipboard.setData("text/plain", " Normaler Paste-Text");
    element.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: clipboard }));
  });
  await expect(editor(page)).toContainText("Normaler Paste-Text");
  await expect(table(page)).toHaveCount(0);
  await showImport(page);
  await importInput(page).fill("A\tB\nC");
  await insert(page).click();
  await expect(popup(page).getByRole("alert")).toContainText("gleich viele Spalten");
  await expect(table(page)).toHaveCount(0);
  await importInput(page).fill("X".repeat(32_001));
  await expect(popup(page).getByRole("alert")).toContainText("32.000 Zeichen");
  await expect(insert(page)).toBeDisabled();
  await importInput(page).fill(officeTableTsv);
  const shots = process.env.OFFICE_TABLE_SHOTS;
  if (shots) await popup(page).screenshot({ path: `${shots}/${info.project.name}-import.png` });
  await insert(page).press("Enter");
  await expect(table(page).locator("tr")).toHaveCount(2);
  await expect(table(page).locator("td")).toHaveCount(8);
  await expect(table(page).locator("td").nth(3)).toHaveText("");
  await expect(table(page).locator("td").nth(5)).toHaveText("");
  await expect(editor(page)).toBeFocused();
  const selectedCell = () => page.evaluate(() => window.getSelection()?.anchorNode?.parentElement?.closest("td")?.textContent);
  expect(await selectedCell()).toBe("Name");
  await page.keyboard.press("Tab");
  expect(await selectedCell()).toBe("Preis");
  await page.keyboard.press("Shift+Tab");
  expect(await selectedCell()).toBe("Name");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  if (shots) await editor(page).screenshot({ path: `${shots}/${info.project.name}-editor.png` });
  await page.keyboard.press("ControlOrMeta+z");
  await expect(table(page)).toHaveCount(0);
  await expect(editor(page)).toContainText("Normaler Paste-Text");
  expect(await writes(page)).toEqual([]);
});

test("Zellen bleiben nach Wiederaufnahme editierbar und der explizite C1-Save sendet ADF verlustfrei", async ({ page }, info) => {
  if (info.project.name === "narrow-dark-reduced") await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await showImport(page);
  await importInput(page).fill(officeTableTsv);
  await insert(page).click();
  await expect(editor(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(editor(page)).toHaveCount(0);
  expect(await writes(page)).toEqual([]);
  await page.getByRole("button", { name: "Beschreibung: Entwurf fortsetzen" }).press("Enter");
  const emptyCell = table(page).locator("td").nth(5).locator("p");
  await emptyCell.click();
  await page.keyboard.type("42");
  await expect(emptyCell).toHaveText("42");
  await expect(editor(page)).toContainText("Bestehende Erweiterung");
  await page.evaluate((remote) => {
    const qa: Qa = Reflect.get(window, "__qa");
    qa.issues.find(({ key }) => key === "DEMO-1")!.fields.description = remote;
  }, officeTableRemote);
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  const conflict = page.getByRole("group", { name: "Beschreibung wurde in Jira geändert" });
  await expect(conflict).toContainText("Änderung auf Jira");
  expect(await writes(page)).toEqual([]);
  await conflict.getByRole("checkbox").check();
  await conflict.getByRole("button", { name: "Entwurf trotzdem speichern" }).click();
  await expect(editor(page)).toHaveCount(0);
  expect(await writes(page)).toEqual([expect.objectContaining({
    method: "PUT", path: "/issue/DEMO-1",
    input: { fields: { description: officeTableSaved } },
  })]);
});
