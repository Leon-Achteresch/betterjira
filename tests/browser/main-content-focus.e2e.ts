import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __qa: { searches: string[] };
    __qaRenderFault?: boolean;
  }
}

const open = (page: Page, route: string, scenario?: string) =>
  page.goto(`/tests/browser/fixture.html?${new URLSearchParams({ route, ...(scenario && { scenario }) })}`);

const skipLink = (page: Page) => page.getByRole("link", { name: "Zum Inhalt", exact: true });
const main = (page: Page) => page.getByRole("main", { name: "Hauptinhalt" });
const focusInsideMain = (page: Page) =>
  page.evaluate(() => document.activeElement?.tagName !== "MAIN" && !!document.activeElement?.closest("main"));
const opacity = (page: Page) => skipLink(page).evaluate((element) => Number(getComputedStyle(element).opacity));
const wide = (page: Page) => (page.viewportSize()?.width ?? 0) >= 768;

const setFault = (page: Page, active: boolean) =>
  page.evaluate((value) => {
    window.__qaRenderFault = value;
  }, active);

const injectRenderFault = async (page: Page, file: string, name: string) => {
  await page.route(`**/src/${file}*`, async (route) => {
    const response = await route.fetch();
    const original = await response.text();
    const body = original.replace(
      `export function ${name}(`,
      `export function ${name}(...args) { if (window.__qaRenderFault) throw new Error("Testfehler"); return __qa${name}(...args); }\nfunction __qa${name}(`,
    );
    if (body === original) throw new Error(`${name} nicht in ${file} gefunden`);
    await route.fulfill({ response, body });
  });
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("Erster Tab zeigt Zum Inhalt, Enter fokussiert den Hauptinhalt ohne Verlaufsschritt", async ({ page }) => {
  await open(page, "/tickets");
  await expect(page.getByRole("cell", { name: "DEMO-1", exact: true })).toBeVisible();
  await expect(page.locator("main")).toHaveCount(1);
  await expect(main(page)).not.toHaveAttribute("tabindex");
  await expect.poll(() => opacity(page)).toBe(0);

  const url = page.url();
  const entries = await page.evaluate(() => history.length);
  await page.keyboard.press("Tab");
  await expect(skipLink(page)).toBeFocused();
  await expect.poll(() => opacity(page)).toBe(1);
  const box = await skipLink(page).boundingBox();
  const width = page.viewportSize()?.width ?? 0;
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width);
  expect(box!.height).toBeGreaterThanOrEqual(32);

  await page.keyboard.press("Enter");
  await expect(main(page)).toBeFocused();
  expect(page.url()).toBe(url);
  expect(await page.evaluate(() => history.length)).toBe(entries);
  await expect.poll(() => opacity(page)).toBe(0);

  await page.keyboard.press("Tab");
  await expect(main(page)).not.toHaveAttribute("tabindex");
  expect(await focusInsideMain(page)).toBe(true);

  await main(page).click({ position: { x: 8, y: 8 } });
  await expect(main(page)).not.toBeFocused();
});

test("Zum Inhalt behält die Leseposition", async ({ page }) => {
  await open(page, "/issue/DEMO-1", "busy");
  await expect(page.locator("article")).toBeVisible();
  const scroller = page.locator("#app-scroll");
  await scroller.evaluate((element) => {
    element.scrollTop = 600;
  });
  const before = await scroller.evaluate((element) => element.scrollTop);
  expect(before).toBeGreaterThan(0);
  await skipLink(page).focus();
  await page.keyboard.press("Enter");
  await expect(main(page)).toBeFocused();
  expect(await scroller.evaluate((element) => element.scrollTop)).toBe(before);
  expect(page.url()).not.toContain("#");
});

test("Seitenwechsel aus dem Inhalt fokussiert den Hauptinhalt, Zurück und Vorwärts ebenso", async ({ page }) => {
  await open(page, "/tickets");
  await main(page).locator('a[href="/issue/DEMO-1"]').first().focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/issue\/DEMO-1$/);
  await expect(main(page)).toBeFocused();

  await page.keyboard.press("Tab");
  expect(await focusInsideMain(page)).toBe(true);
  await page.goBack();
  await expect(page).toHaveURL(/\/tickets$/);
  await expect(main(page)).toBeFocused();

  await page.keyboard.press("Tab");
  expect(await focusInsideMain(page)).toBe(true);
  await page.goForward();
  await expect(page).toHaveURL(/\/issue\/DEMO-1$/);
  await expect(main(page)).toBeFocused();
});

test("Ansichtswechsel, Aktualisieren und Seitenleiste lassen den Fokus stehen", async ({ page }) => {
  await open(page, "/tickets");
  await expect(page.getByRole("cell", { name: "DEMO-1", exact: true })).toBeVisible();
  const watched = page.getByRole("navigation", { name: "Ticket-Ansicht" }).getByRole("link", { name: "Beobachtet" });
  await watched.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/ansicht=beobachtet$/);
  await expect(watched).toBeFocused();

  const refresh = page.getByRole("button", { name: "Aktualisieren" });
  await expect(refresh).toBeEnabled();
  const searches = await page.evaluate(() => window.__qa.searches.length);
  await refresh.evaluate((button) => button.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  await expect.poll(() => page.evaluate(() => window.__qa.searches.length)).toBeGreaterThan(searches);
  await expect(refresh).toBeEnabled();
  await expect(watched).toBeFocused();

  test.skip(!wide(page), "Die Seitenleiste ist schmal ein Sheet");
  const calendar = page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("link", { name: "Kalender", exact: true });
  await calendar.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/kalender$/);
  await expect(page.getByRole("heading", { name: "Kalender", exact: true })).toBeVisible();
  await expect(calendar).toBeFocused();
});

test("Offene Command-Palette hält den Fokus, Zum Inhalt ist dort nicht erreichbar", async ({ page }) => {
  await open(page, "/");
  await page.locator("header").first().getByRole("button", { name: "Suchen" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  for (let step = 0; step < 4; step += 1) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(main(page)).not.toBeFocused();
});

test("Renderfehler nach Seitenwechsel behält den Fokus auf Erneut versuchen", async ({ page }) => {
  await injectRenderFault(page, "components/settings/theme-picker.tsx", "ThemePicker");
  await open(page, "/settings/code-hosting");
  await expect(page.getByRole("heading", { name: "Einstellungen", exact: true })).toBeVisible();
  await setFault(page, true);
  await page.getByRole("link", { name: "Darstellung", exact: true }).click();
  const retry = page.getByRole("button", { name: "Erneut versuchen", exact: true });
  await expect(retry).toBeFocused();

  await setFault(page, false);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Erscheinungsbild", exact: true })).toBeVisible();
  await expect(main(page)).not.toBeFocused();
});

test.describe("390 px dunkel", () => {
  test.use({ viewport: { width: 390, height: 844 }, colorScheme: "dark" });

  test("Zum Inhalt bleibt im Fenster und fokussiert den Hauptinhalt", async ({ page }) => {
    await open(page, "/tickets");
    await expect(page.getByRole("heading", { name: "Jira-Tickets", exact: true })).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(skipLink(page)).toBeFocused();
    await expect.poll(() => opacity(page)).toBe(1);
    const box = await skipLink(page).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    await page.keyboard.press("Enter");
    await expect(main(page)).toBeFocused();
  });
});
