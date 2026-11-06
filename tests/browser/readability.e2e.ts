import { expect, test, type Page, type TestInfo } from "@playwright/test";

const SETTINGS = "/tests/browser/fixture.html?route=/settings/darstellung";
const TICKET = "/tests/browser/fixture.html?scenario=busy&route=/issue/DEMO-1";
const TABLE = "/tests/browser/fixture.html?route=/bereiche/DEMO";
const STORAGE_KEY = "betterjira-readability";

const sizes = (page: Page) => page.getByRole("radiogroup", { name: "Textgröße" });
const option = (page: Page, name: string) => sizes(page).getByRole("radio", { name, exact: true });
const preview = (page: Page) => page.getByRole("group", { name: "Vorschau der Textgröße" });
const section = (page: Page, heading: RegExp) =>
  page.locator("section", { has: page.getByRole("heading", { name: heading }) });

const fontSize = (page: Page, selector: Parameters<Page["locator"]>[0] | ReturnType<Page["locator"]>) =>
  (typeof selector === "string" ? page.locator(selector) : selector)
    .first()
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));

const open = async (page: Page, url: string) => {
  await page.goto(url);
  await expect(page.locator("header").first().getByRole("button", { name: "Suchen" })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
};

const headerLayout = (page: Page) =>
  page.evaluate(() => {
    const header = document.querySelector("header")!;
    const controls = [...header.querySelectorAll("button, a, [role=tab]")]
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 0 && rect.height > 0)
      .map(({ element, rect }) => [element.getAttribute("aria-label"), rect.left, rect.top, rect.width, rect.height, getComputedStyle(element).fontSize]);
    return { height: header.getBoundingClientRect().height, controls };
  });

const pageOverflow = (page: Page) =>
  page.evaluate(() => {
    const scroller = document.getElementById("app-scroll")!;
    return { document: document.documentElement.scrollWidth - innerWidth, main: scroller.scrollWidth - scroller.clientWidth };
  });

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  const dir = process.env.READABILITY_SHOTS;
  if (!dir) return;
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${dir}/${testInfo.project.name}-${name}.png` });
};

const choose = async (page: Page, size: string) => {
  await open(page, SETTINGS);
  await option(page, size).click();
  await expect(option(page, size)).toBeChecked();
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("Textgröße wirkt sofort, bleibt nach Neuladen und lässt sich zurücksetzen", async ({ page }, testInfo) => {
  await open(page, SETTINGS);
  await expect(option(page, "Standard")).toBeChecked();
  await expect(page.locator("html")).not.toHaveAttribute("data-text-size");
  const body = preview(page).locator("p").nth(2);
  expect(await fontSize(page, body)).toBe(14);
  await expect(page.getByRole("button", { name: "Zurücksetzen" })).toHaveCount(0);
  await shot(page, testInfo, "settings-standard");

  await option(page, "Groß").click();
  await expect(page.locator("html")).toHaveAttribute("data-text-size", "large");
  expect(await fontSize(page, body)).toBeCloseTo(15.75, 1);
  expect(await fontSize(page, page.getByRole("heading", { name: "Einstellungen" }))).toBeCloseTo(27, 1);
  await shot(page, testInfo, "settings-large");

  await option(page, "Sehr groß").click();
  expect(await fontSize(page, body)).toBeCloseTo(17.5, 1);

  await open(page, SETTINGS);
  await expect(option(page, "Sehr groß")).toBeChecked();
  expect(await fontSize(page, preview(page).locator("p").nth(2))).toBeCloseTo(17.5, 1);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null"), STORAGE_KEY)).toEqual({
    state: { textSize: "x-large" },
    version: 1,
  });

  await page.getByRole("button", { name: "Zurücksetzen" }).click();
  await expect(option(page, "Standard")).toBeChecked();
  await expect(page.locator("html")).not.toHaveAttribute("data-text-size");
  expect(await fontSize(page, preview(page).locator("p").nth(2))).toBe(14);
  await expect(page.getByRole("button", { name: "Zurücksetzen" })).toHaveCount(0);
});

test("Unbekannte gespeicherte Werte fallen auf Standard zurück", async ({ page }) => {
  for (const stored of ['{"state":{"textSize":"huge"},"version":1}', '{"state":{"textSize":"large"},"version":7}', "kein json"]) {
    await page.goto("/tests/browser/fixture.html?route=/settings/darstellung");
    await page.evaluate(([key, value]) => localStorage.setItem(key, value), [STORAGE_KEY, stored]);
    await open(page, SETTINGS);
    const migrated = stored.includes('"large"');
    await expect(option(page, migrated ? "Groß" : "Standard")).toBeChecked();
    expect(await fontSize(page, preview(page).locator("p").nth(2))).toBeCloseTo(migrated ? 15.75 : 14, 1);
  }
});

test("Ticketbeschreibung, Kommentare und Tabelle wachsen, Kopfleiste bleibt unverändert", async ({ page }, testInfo) => {
  const description = () => section(page, /^Beschreibung$/).locator("p").first();
  const comment = () => section(page, /^Kommentare/).locator("p").first();
  const tableCell = () => page.getByRole("cell", { name: "DEMO-1", exact: true });

  await open(page, TICKET);
  await expect(description()).toBeVisible();
  const before = { description: await fontSize(page, description()), comment: await fontSize(page, comment()), header: await headerLayout(page) };
  await shot(page, testInfo, "ticket-standard");
  await open(page, TABLE);
  await expect(tableCell()).toBeVisible();
  const tableBefore = await fontSize(page, tableCell());
  await shot(page, testInfo, "table-standard");

  await choose(page, "Groß");
  await open(page, TICKET);
  await expect(description()).toBeVisible();
  expect(await fontSize(page, description())).toBeCloseTo(before.description * 1.125, 1);
  expect(await fontSize(page, comment())).toBeCloseTo(before.comment * 1.125, 1);
  expect(await headerLayout(page)).toEqual(before.header);
  await shot(page, testInfo, "ticket-large");
  await open(page, TABLE);
  await expect(tableCell()).toBeVisible();
  expect(await fontSize(page, tableCell())).toBeCloseTo(tableBefore * 1.125, 1);
  await shot(page, testInfo, "table-large");
});

test("Sehr große Schrift bei 390 px ohne Seitenüberlauf, Tabelle scrollt horizontal", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, TICKET);
  const header = await headerLayout(page);
  await shot(page, testInfo, "ticket-390-standard");
  await choose(page, "Sehr groß");
  await shot(page, testInfo, "settings-390-x-large");

  await open(page, TICKET);
  await expect(section(page, /^Beschreibung$/)).toBeVisible();
  expect(await headerLayout(page)).toEqual(header);
  const ticket = await pageOverflow(page);
  expect(ticket.document).toBeLessThanOrEqual(0);
  expect(ticket.main).toBeLessThanOrEqual(0);
  await shot(page, testInfo, "ticket-390-x-large");

  await open(page, TABLE);
  await expect(page.getByRole("cell", { name: "DEMO-1", exact: true })).toBeVisible();
  expect((await pageOverflow(page)).document).toBeLessThanOrEqual(0);
  const table = await page
    .locator("[data-slot=table-container]")
    .first()
    .evaluate((element) => ({ overflow: getComputedStyle(element).overflowX, scrolls: element.scrollWidth > element.clientWidth }));
  expect(table).toEqual({ overflow: "auto", scrolls: true });
  await shot(page, testInfo, "table-390-x-large");
});

test("Textgröße ist per Tastatur mit sichtbarem Fokus wählbar", async ({ page }) => {
  await open(page, SETTINGS);
  const shadow = () => option(page, "Standard").evaluate((element) => getComputedStyle(element).boxShadow);
  const resting = await shadow();
  await option(page, "Standard").focus();
  expect(await shadow()).not.toBe(resting);
  await page.keyboard.press("ArrowRight", { delay: 50 });
  await expect(option(page, "Groß")).toBeFocused();
  await expect(option(page, "Groß")).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-text-size", "large");
  const box = await option(page, "Groß").boundingBox();
  expect(box!.height).toBeGreaterThanOrEqual(32);
  await page.keyboard.press("ArrowRight", { delay: 50 });
  await expect(option(page, "Sehr groß")).toBeChecked();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Zurücksetzen" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(option(page, "Standard")).toBeChecked();
  await expect(option(page, "Standard")).toBeFocused();
  await expect(page.locator("html")).not.toHaveAttribute("data-text-size");
});
