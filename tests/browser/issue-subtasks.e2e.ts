import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __qa: { issueReads: string[] };
  }
}

const ISSUE = (key: string) => `/tests/browser/fixture.html?scenario=subtasks&route=/issue/${key}`;

const section = (page: Page) => page.locator("section").filter({ has: page.getByRole("heading", { name: "Unteraufgaben" }) });
const rowKeys = (page: Page) => section(page).locator("a[data-row-link] > span:first-child");
const filter = (page: Page, name: RegExp) => section(page).getByRole("radio", { name });
const subtaskReads = (page: Page) =>
  page.evaluate(() => window.__qa.issueReads.filter((read) => /^\/issue\/DEMO-(?:[2-9]|1[01])\?/.test(read)));

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("zeigt erledigte gegenüber geladenen, unbekannte Kategorie und filtert lokal", async ({ page }) => {
  await page.goto(ISSUE("DEMO-1"));
  await expect(section(page)).toContainText("5/10 erledigt");
  await expect(section(page)).toContainText("1 Status unbekannt");
  await expect(filter(page, /Alle/)).toHaveAttribute("aria-checked", "true");
  await expect(rowKeys(page)).toHaveCount(7);

  const more = section(page).getByRole("button", { name: "3 weitere anzeigen" });
  await more.click();
  await expect(rowKeys(page)).toHaveCount(10);
  await expect(section(page).getByRole("link", { name: /DEMO-6/ })).toContainText("Statuskategorie unbekannt");

  await filter(page, /Offen/).click();
  await expect(rowKeys(page)).toHaveText(["DEMO-2", "DEMO-4", "DEMO-7", "DEMO-9"]);
  await expect(section(page)).toContainText("Eine Unteraufgabe mit unbekannter Statuskategorie ist hier nicht enthalten.");
  await expect(section(page).getByRole("button", { name: /weitere anzeigen|Weniger anzeigen/ })).toHaveCount(0);

  expect(await subtaskReads(page)).toEqual([]);
});

test("öffnet eine Unteraufgabe per Tastatur, setzt den Filter beim Ticketwechsel zurück", async ({ page }) => {
  await page.goto(ISSUE("DEMO-1"));
  await filter(page, /Offen/).click();
  const link = section(page).getByRole("link", { name: /DEMO-2/ });
  await expect(link).toHaveAttribute("href", "/issue/DEMO-2");
  await link.focus();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/issue\/DEMO-2$/);
  await expect(section(page)).toContainText("1/1 erledigt");
  await expect(filter(page, /Alle/)).toHaveAttribute("aria-checked", "true");
  await filter(page, /Offen/).click();
  await expect(section(page)).toContainText("Alle Unteraufgaben sind erledigt.");

  await page.goBack();
  await expect(page).toHaveURL(/\/issue\/DEMO-1$/);
  await expect(filter(page, /Alle/)).toHaveAttribute("aria-checked", "true");
  await expect(rowKeys(page)).toHaveCount(7);
});

test("Filter per Tastatur bedienbar und 390 px ohne Seitenüberlauf", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(ISSUE("DEMO-1"));
  await filter(page, /Alle/).focus();
  await page.keyboard.press("ArrowRight");
  await expect(filter(page, /Offen/)).toBeFocused();
  await page.keyboard.press("Space");
  await expect(rowKeys(page)).toHaveCount(4);

  const box = await filter(page, /Offen/).boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(32);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("Ticket ohne Unteraufgaben bietet die erste Unteraufgabe an", async ({ page }) => {
  await page.goto(ISSUE("DEMO-3"));
  await expect(page.getByRole("heading", { name: /^Kommentare/ })).toBeVisible();
  await expect(section(page).getByText("Noch keine Unteraufgaben.")).toBeVisible();
  await expect(section(page).getByRole("link", { name: "Unteraufgabe erstellen" })).toHaveAttribute("href", "/neu?parent=DEMO-3");
});
