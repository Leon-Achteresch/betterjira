import { expect, test, type Page, type TestInfo } from "@playwright/test";

const SECRET = "qa-geheimnis-123";
const UNKNOWN = `/gibt-es-nicht/tief?token=${SECRET}#${SECRET}`;
const TITLE = "Diese Seite gibt es nicht";

const view = (page: Page) => page.locator('[data-slot="empty"]');

const open = (page: Page, route: string) => page.goto(`/tests/browser/fixture.html?${new URLSearchParams({ route })}`);

const mainNav = (page: Page) => page.getByRole("navigation", { name: "Hauptnavigation" });

const showMainNav = async (page: Page) => {
  if ((page.viewportSize()?.width ?? 0) >= 768) return mainNav(page);
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await expect(mainNav(page)).toBeVisible();
  return mainNav(page);
};

const pushInApp = (page: Page, path: string) =>
  page.evaluate((target) => {
    const state = history.state as { __TSR_index: number };
    const key = `qa${state.__TSR_index + 1}`;
    history.pushState({ __TSR_index: state.__TSR_index + 1, key, __TSR_key: key }, "", target);
    dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
  }, path);

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  const dir = process.env.NOT_FOUND_SHOTS;
  if (!dir) return;
  const geist = await page.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('14px "Geist Variable"') && getComputedStyle(document.body).fontFamily.startsWith('"Geist Variable"');
  });
  expect(geist).toBe(true);
  await page.screenshot({ path: `${dir}/${testInfo.project.name}-${name}.png` });
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("unbekannter Direktlink zeigt Hinweis in der Shell ohne Umleitung und ohne URL-Inhalt", async ({ page }, testInfo) => {
  await open(page, UNKNOWN);
  await expect(page.getByRole("heading", { name: TITLE, level: 1 })).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/gibt-es-nicht/tief\\?token=${SECRET}`));
  const text = await page.locator("body").innerText();
  expect(text).not.toContain(SECRET);
  expect(text).not.toContain("gibt-es-nicht");
  expect(text).not.toContain("Not Found");
  await expect(view(page).getByRole("button", { name: "Zurück", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Zu Heute" })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await shot(page, testInfo, "direktlink");

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: TITLE })).toHaveCount(0);

  const nav = await showMainNav(page);
  await nav.getByRole("link", { name: "Kalender", exact: true }).click();
  await expect(page).toHaveURL(/\/kalender$/);
  await expect(page.getByRole("heading", { name: "Kalender", exact: true })).toBeVisible();
});

test("Hauptnavigation bleibt auf der Nicht-gefunden-Ansicht bedienbar", async ({ page }) => {
  await open(page, UNKNOWN);
  await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
  const nav = await showMainNav(page);
  await nav.getByRole("link", { name: "Zeiterfassung", exact: true }).click();
  await expect(page).toHaveURL(/\/zeiterfassung$/);
  await expect(page.getByRole("heading", { name: "Meine Zeiterfassung", exact: true })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { name: "Meine Zeiterfassung", exact: true })).toBeVisible();
});

test("Zurück erscheint nur nach appinterner Navigation und führt zur vorigen Seite", async ({ page }) => {
  await open(page, "/kalender");
  await expect(page.getByRole("heading", { name: "Kalender", exact: true })).toBeVisible();
  await pushInApp(page, UNKNOWN);
  await expect(page.getByRole("heading", { name: TITLE })).toBeVisible();
  await view(page).getByRole("button", { name: "Zurück", exact: true }).click();
  await expect(page).toHaveURL(/\/kalender$/);
  await expect(page.getByRole("heading", { name: "Kalender", exact: true })).toBeVisible();
});

test("390 px dunkel mit reduzierter Bewegung ohne Überlauf", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await open(page, UNKNOWN);
  const heading = page.getByRole("heading", { name: TITLE });
  await expect(heading).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const transform = await heading.evaluate((element) => getComputedStyle(element.closest("[style]") ?? element).transform);
  expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(transform);
  const box = await page.getByRole("button", { name: "Zu Heute" }).boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(32);
  await shot(page, testInfo, "390-dunkel");
});
