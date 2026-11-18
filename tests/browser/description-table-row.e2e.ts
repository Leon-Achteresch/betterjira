import { expect, test, type Page } from "@playwright/test";
import descriptionWithMedia from "../jira/fixtures/description-adf-media.json" with { type: "json" };
import { officeTableInitial, officeTableTsv } from "../jira/fixtures/description-office-table";

const ISSUE = "/tests/browser/fixture.html?route=/issue/DEMO-1";
const initial = { ...officeTableInitial, content: [...descriptionWithMedia.content, ...officeTableInitial.content] };
const originalRows = [["Name", "Preis", "Notiz", ""], ["Büro", "", " =1+2 ", "Ende"]];
const paragraph = (text: string) => ({ type: "paragraph", ...(text && { content: [{ type: "text", text }] }) });
const adfTable = (rows: string[][]) => ({
  type: "table",
  attrs: { isNumberColumnEnabled: false, layout: "default" },
  content: rows.map((cells) => ({
    type: "tableRow",
    content: cells.map((text) => ({ type: "tableCell", attrs: {}, content: [paragraph(text)] })),
  })),
});

type Qa = { writes: unknown[]; issues: { key: string; fields: { description: unknown } }[] };
const writes = (page: Page) => page.evaluate(() => {
  const qa: Qa = Reflect.get(window, "__qa");
  return qa.writes;
});
const rowAction = (page: Page) => page.getByRole("button", { name: "Leere Zeile darunter einfügen" });
const openEditor = async (page: Page, description: unknown) => {
  await page.addInitScript((doc) => Reflect.set(window, "__qaInitialDescription", doc), description);
  await page.goto(ISSUE);
  await page.getByRole("button", { name: "Beschreibung bearbeiten", exact: true }).press("Enter");
  const editor = page.getByRole("textbox", { name: "Beschreibung", exact: true });
  await expect(editor).toBeFocused();
  return editor;
};

test("Eine gewählte Tabellenzeile lokal ergänzen, rückgängig machen und erst nach Konfliktbestätigung speichern", async ({ page }, info) => {
  const externalRequests: string[] = [];
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (["http:", "https:"].includes(url.protocol) && url.hostname !== "127.0.0.1") {
      externalRequests.push(url.href);
      return route.abort();
    }
    return route.continue();
  });
  if (info.project.name === "narrow-dark-reduced") await page.setViewportSize({ width: 390, height: 844 });
  const editor = await openEditor(page, initial);
  const table = editor.locator("[data-adf-table-scroll]");
  const rows = table.locator("tr");
  const readRows = () => rows.evaluateAll((elements) => elements.map((row) => Array.from(row.querySelectorAll("td"), (cell) => cell.textContent)));
  const action = rowAction(page);
  await expect(action).toHaveCount(0);

  await page.getByRole("button", { name: "Tabelle aus Zwischenablage übernehmen" }).press("Enter");
  const dialog = page.getByRole("dialog", { name: "Tabelle übernehmen" });
  await dialog.getByLabel("Kopierte TSV-Zellen").fill(officeTableTsv);
  await dialog.getByRole("button", { name: "In Entwurf einfügen" }).press("Enter");
  await expect(rows).toHaveCount(2);
  await expect(editor).toBeFocused();
  expect(await readRows()).toEqual(originalRows);

  await expect(action).toBeVisible();
  for (let step = 0; step < 5 && !await action.evaluate((node) => node === document.activeElement); step++) {
    await page.keyboard.press("Shift+Tab");
  }
  await expect(action).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(editor).toBeFocused();
  await expect(rows).toHaveCount(3);
  expect(await readRows()).toEqual([originalRows[0], ["", "", "", ""], originalRows[1]]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  const shots = process.env.DESCRIPTION_TABLE_ROW_SHOTS;
  if (shots) await page.locator("form").filter({ has: editor }).screenshot({ path: `${shots}/${info.project.name}-row.png` });

  const newCell = rows.nth(1).locator("td").first();
  await page.keyboard.insertText("Neue Zeile");
  await expect(newCell).toHaveText("Neue Zeile");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(newCell).toHaveText("");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(rows).toHaveCount(2);
  expect(await readRows()).toEqual(originalRows);
  const afterUndo = await writes(page);
  expect(afterUndo).toEqual([]);

  await rows.first().locator("td").nth(1).click();
  await action.click();
  await page.keyboard.insertText("Neue Zeile");
  await expect(newCell).toHaveText("Neue Zeile");
  await page.keyboard.press("Escape");
  await expect(editor).toHaveCount(0);
  const afterEscape = await writes(page);
  expect(afterEscape).toEqual([]);
  await page.getByRole("button", { name: "Beschreibung: Entwurf fortsetzen" }).press("Enter");
  const finalRows = [originalRows[0], ["Neue Zeile", "", "", ""], originalRows[1]];
  await expect(newCell).toHaveText("Neue Zeile");
  expect(await readRows()).toEqual(finalRows);

  const remote = { ...initial, content: [...initial.content, paragraph("Änderung auf Jira")] };
  await page.evaluate((doc) => {
    const qa: Qa = Reflect.get(window, "__qa");
    qa.issues.find(({ key }) => key === "DEMO-1")!.fields.description = doc;
  }, remote);
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  const conflict = page.getByRole("group", { name: "Beschreibung wurde in Jira geändert" });
  await expect(conflict).toContainText("Änderung auf Jira");
  await expect(newCell).toHaveText("Neue Zeile");
  await conflict.getByRole("tab", { name: "Quelle" }).click();
  expect(JSON.parse(await conflict.getByLabel("Aktuell in Jira").innerText())).toEqual(remote);
  expect(JSON.parse(await conflict.getByLabel("Stand bei Bearbeitungsbeginn").innerText())).toEqual(initial);
  const beforeConfirmation = await writes(page);
  expect(beforeConfirmation).toEqual([]);
  await conflict.getByRole("checkbox").check();
  await conflict.getByRole("button", { name: "Entwurf trotzdem speichern" }).click();
  await expect(editor).toHaveCount(0);
  const ledger = await writes(page);
  expect(ledger).toEqual([expect.objectContaining({
    method: "PUT", path: "/issue/1",
    input: { fields: { description: { ...initial, content: [...initial.content, adfTable(finalRows)] } } },
  })]);
  expect(externalRequests).toEqual([]);
  await info.attach("description-table-row-ledger", {
    body: JSON.stringify({ afterUndo, afterEscape, beforeConfirmation, writes: ledger, externalRequests }),
    contentType: "application/json",
  });
});

test("Komplexe und bereits volle Tabellen bieten keine strukturelle Aktion an", async ({ page }) => {
  const complexTable = {
    type: "table",
    content: [{ type: "tableRow", content: [{
      type: "tableCell", attrs: { colspan: 2 }, content: [paragraph("Verbundene Zelle")],
    }] }],
  };
  const full = adfTable(Array.from({ length: 50 }, (_, index) => [`Zeile ${index + 1}`, ""]));
  const editor = await openEditor(page, { ...officeTableInitial, content: [complexTable, full] });
  const complex = editor.getByText("Verbundene Zelle", { exact: true });
  await expect(complex).toBeVisible();
  await complex.click();
  await expect(rowAction(page)).toHaveCount(0);
  const fullTable = editor.locator("[data-adf-table-scroll]");
  await fullTable.getByText("Zeile 1", { exact: true }).click();
  await expect(fullTable.locator("tr")).toHaveCount(50);
  await expect(rowAction(page)).toHaveCount(0);
  expect(await writes(page)).toEqual([]);
});
