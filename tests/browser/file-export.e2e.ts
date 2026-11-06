import { readFile } from "node:fs/promises";
import { expect, test, type Download, type Page, type TestInfo } from "@playwright/test";

type SearchRule = { delayMs?: number; keys?: string[] };
type QaIssue = { key: string; fields: Record<string, unknown> };

declare global {
  interface Window {
    __qaSearchRule?: (jql: string, pageToken: string | null) => SearchRule;
    __qaBlobs: string[];
    __qa: { searches: string[]; writes: unknown[]; issues: QaIssue[]; emptySearch: boolean };
  }
}

const TABLE = "/tests/browser/fixture.html?route=/bereiche/DEMO";
const HEADER = "Schlüssel,Typ,Zusammenfassung,Status,Bearbeiter,Priorität,Aktualisiert";
const FORMULA = '=HYPERLINK("https://example.invalid","klick")';
const MULTILINE = 'Zeile 1\nZeile "2", mit; Trennern\tund Tab';
const DATE = /\d{4}-\d{2}-\d{2}/.source;

const row = (page: Page, key: string) => page.getByRole("cell", { name: key, exact: true });
const rowBox = (page: Page, key: string) => page.getByRole("checkbox", { name: `${key} auswählen` });
const selectionBar = (page: Page) => page.getByRole("region", { name: "Ausgewählte Vorgänge" });
const fileItem = (page: Page, format: "CSV" | "TSV") => page.getByRole("menuitem", { name: `${format}-Datei herunterladen` });

const openFileMenu = async (page: Page) => {
  await page.getByRole("button", { name: "Ansicht und Export" }).click();
  await page.getByRole("menuitem", { name: "Datei herunterladen" }).click();
};

const bytesOf = async (download: Download) => readFile(await download.path());

const textOf = async (download: Download) => {
  const bytes = await bytesOf(download);
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  return bytes.toString("utf8").slice(1);
};

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  const dir = process.env.FILE_EXPORT_SHOTS;
  if (!dir) return;
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/${testInfo.project.name}-${name}.png` });
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.addInitScript(() => {
    window.__qaBlobs = [];
    const create = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob: Blob) => {
      window.__qaBlobs.push(blob.type);
      return create(blob);
    };
    window.__qaSearchRule = (jql) => {
      const [first, second, third] = window.__qa.issues;
      first!.fields.summary = '=HYPERLINK("https://example.invalid","klick")';
      second!.fields.assignee = null;
      second!.fields.priority = null;
      third!.fields.summary = 'Zeile 1\nZeile "2", mit; Trennern\tund Tab';
      return jql.includes("alpha") ? { delayMs: 4000, keys: ["DEMO-2"] } : {};
    };
  });
  await page.goto(TABLE);
  await expect(row(page, "DEMO-3")).toBeVisible();
});

test.afterEach(async ({ page }) => {
  expect(await page.evaluate(() => window.__qa.writes)).toEqual([]);
});

test("Alle geladenen Tickets als CSV-Datei mit neutralisierten Formeln und leeren Feldern", async ({ page }, testInfo) => {
  await openFileMenu(page);
  await expect(page.getByText("Geladene Tickets: 3", { exact: true })).toBeVisible();
  await shot(page, testInfo, "menue");
  const [download] = await Promise.all([page.waitForEvent("download"), fileItem(page, "CSV").click()]);

  expect(download.suggestedFilename()).toMatch(new RegExp(`^jira-tickets-${DATE}\\.csv$`));
  expect(await textOf(download)).toBe(
    [
      HEADER,
      `DEMO-1,Aufgabe,"'${FORMULA.replace(/"/g, '""')}",In Arbeit,Alex Beispiel,Mittel,2026-11-04T10:00:00Z`,
      "DEMO-2,Aufgabe,Tastaturbedienung im Editor verbessern,In Arbeit,,,2026-11-04T10:00:00Z",
      `DEMO-3,Aufgabe,"${MULTILINE.replace(/"/g, '""')}",In Arbeit,Alex Beispiel,Mittel,2026-11-04T10:00:00Z`,
      "",
    ].join("\r\n"),
  );
  expect(await page.evaluate(() => window.__qaBlobs)).toEqual(["text/csv;charset=utf-8"]);
  await expect(page.getByText("CSV-Download gestartet")).toBeVisible();
});

test("Auswahl exportiert nur gewählte Zeilen in Tabellenreihenfolge und aktuellen Spalten", async ({ page }, testInfo) => {
  await page.getByRole("button", { name: "Spalten" }).click();
  await page.getByRole("button", { name: "Priorität ausblenden" }).click();
  await page.keyboard.press("Escape");
  await rowBox(page, "DEMO-3").click();
  await rowBox(page, "DEMO-1").click();
  await selectionBar(page).getByRole("button", { name: "Datei" }).click();
  await expect(page.getByText("Ausgewählte Tickets: 2", { exact: true })).toBeVisible();
  await shot(page, testInfo, "auswahl");
  const [download] = await Promise.all([page.waitForEvent("download"), fileItem(page, "TSV").click()]);

  expect(download.suggestedFilename()).toMatch(new RegExp(`^jira-tickets-auswahl-${DATE}\\.tsv$`));
  const lines = (await textOf(download)).split("\r\n");
  expect(lines[0]).toBe("Schlüssel\tTyp\tZusammenfassung\tStatus\tBearbeiter\tAktualisiert");
  expect(lines[1]).toBe(`DEMO-1\tAufgabe\t"'${FORMULA.replace(/"/g, '""')}"\tIn Arbeit\tAlex Beispiel\t2026-11-04T10:00:00Z`);
  expect(lines.slice(2).join("\r\n")).toBe(`DEMO-3\tAufgabe\t"${MULTILINE.replace(/"/g, '""')}"\tIn Arbeit\tAlex Beispiel\t2026-11-04T10:00:00Z\r\n`);
  expect(await page.evaluate(() => window.__qaBlobs)).toEqual(["text/tab-separated-values;charset=utf-8"]);
});

test("Platzhalter und leere Ergebnisse sperren den Dateiexport", async ({ page }) => {
  let downloads = 0;
  page.on("download", () => void downloads++);

  await page.getByRole("searchbox", { name: "Volltextsuche" }).fill("alpha");
  await expect(page.getByRole("status").filter({ hasText: "geänderte Abfrage" })).toBeVisible();
  await openFileMenu(page);
  await expect(fileItem(page, "CSV")).toHaveAttribute("aria-disabled", "true");
  await expect(fileItem(page, "TSV")).toHaveAttribute("aria-disabled", "true");
  await fileItem(page, "CSV").dispatchEvent("click");
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  await page.getByRole("searchbox", { name: "Volltextsuche" }).fill("");
  await page.evaluate(() => {
    window.__qa.emptySearch = true;
  });
  await page.getByRole("button", { name: "Aktualisieren" }).click();
  await expect(row(page, "DEMO-1")).toHaveCount(0);
  await openFileMenu(page);
  await expect(page.getByText(/^Geladene Tickets: 0( von \d+)?$/)).toBeVisible();
  await expect(fileItem(page, "CSV")).toHaveAttribute("aria-disabled", "true");
  await fileItem(page, "TSV").dispatchEvent("click");
  await page.waitForTimeout(500);
  expect(downloads).toBe(0);
  expect(await page.evaluate(() => window.__qaBlobs)).toEqual([]);
});

test("390 px, dunkel, reduzierte Bewegung: Export per Tastatur ohne Seitenüberlauf", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await rowBox(page, "DEMO-2").click();
  await rowBox(page, "DEMO-2").press("Space");
  await expect(rowBox(page, "DEMO-2")).not.toBeChecked();
  await rowBox(page, "DEMO-2").press("Space");
  const trigger = selectionBar(page).getByRole("button", { name: "Datei" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(fileItem(page, "CSV")).toBeVisible();
  await shot(page, testInfo, "schmal-auswahl");
  await expect(fileItem(page, "CSV")).toBeFocused();
  const [download] = await Promise.all([page.waitForEvent("download"), page.keyboard.press("Enter")]);
  expect(download.suggestedFilename()).toMatch(/^jira-tickets-auswahl-.*\.csv$/);
  expect((await textOf(download)).split("\r\n")).toEqual([
    HEADER,
    "DEMO-2,Aufgabe,Tastaturbedienung im Editor verbessern,In Arbeit,,,2026-11-04T10:00:00Z",
    "",
  ]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole("button", { name: "Ansicht und Export" }).focus();
  await page.keyboard.press("Enter");
  const submenu = page.getByRole("menuitem", { name: "Datei herunterladen" });
  while (!(await submenu.evaluate((element) => element === document.activeElement))) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowRight");
  await expect(page.getByText("Geladene Tickets: 3", { exact: true })).toBeVisible();
  await shot(page, testInfo, "schmal-menue");
});
