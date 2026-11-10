import { expect, test, type Page, type TestInfo } from "@playwright/test";

declare global {
  interface Window {
    __qaRenderFault?: boolean;
  }
}

const SECRET = "qa-geheimnis-123";
const PAGE_TITLE = "Diese Ansicht konnte nicht angezeigt werden";
const APP_TITLE = "betterjira konnte nicht angezeigt werden";

const injectRenderFault = async (page: Page, file: string, name: string) => {
  await page.addInitScript((target) => { Object.defineProperty(window, "__qaRenderFaultTarget", { value: target, configurable: true }); }, file);
  await page.addInitScript(() => {
    window.__qaRenderFault = true;
  });
  await page.route(`**/src/${file}*`, async (route) => {
    const response = await route.fetch();
    const original = await response.text();
    const body = original.replace(
      `export function ${name}(`,
      `export function ${name}(...args) { if (window.__qaRenderFault) throw new Error("Testfehler token=${SECRET}"); return __qa${name}(...args); }\nfunction __qa${name}(`,
    );
    if (body === original) throw new Error(`${name} nicht in ${file} gefunden`);
    await route.fulfill({ response, body });
  });
};

const setFault = (page: Page, active: boolean) =>
  page.evaluate((value) => {
    window.__qaRenderFault = value;
  }, active);

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  const dir = process.env.RENDER_RECOVERY_SHOTS;
  if (dir) await page.screenshot({ path: `${dir}/${testInfo.project.name}-${name}.png` });
};

const alert = (page: Page, title: string) => page.getByRole("alert").filter({ hasText: title });
const retry = (page: Page) => page.getByRole("button", { name: "Erneut versuchen", exact: true });
const reload = (page: Page) => page.getByRole("button", { name: "Neu laden", exact: true });
const mainNav = (page: Page) => page.getByRole("navigation", { name: "Hauptnavigation" });

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.clock.setFixedTime(new Date("2026-11-06T12:00:00.000Z"));
});

test("Seitenfehler lässt die Shell nutzbar und Retry stellt die Ansicht wieder her", async ({ page }, testInfo) => {
  await injectRenderFault(page, "components/calendar/upcoming-rollouts.tsx", "UpcomingRollouts");
  await page.goto("/tests/browser/fixture.html?route=/kalender");

  await expect(alert(page, PAGE_TITLE)).toBeVisible();
  await expect(page.getByText(SECRET)).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Werkzeuge" }).getByRole("link", { name: "Einstellungen", exact: true })).toBeVisible();
  await expect(retry(page)).toBeFocused();
  if (testInfo.project.use.reducedMotion === "reduce") {
    const item = page.getByRole("alert").locator("xpath=..");
    expect(await item.evaluate((element) => element.style.transform)).not.toContain("translate");
  }
  await page.waitForTimeout(400);
  await shot(page, testInfo, "page-error");

  await setFault(page, false);
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { name: "Kalender", exact: true })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: PAGE_TITLE })).toHaveCount(0);
  await page.waitForTimeout(400);
  await shot(page, testInfo, "page-recovered");
});

test("Dauerhafter Seitenfehler bleibt nach Retry verständlich und Neu laden ist per Tastatur erreichbar", async ({ page }) => {
  await injectRenderFault(page, "components/calendar/upcoming-rollouts.tsx", "UpcomingRollouts");
  await page.goto("/tests/browser/fixture.html?route=/kalender");
  await expect(retry(page)).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(alert(page, PAGE_TITLE)).toContainText("Der Fehler tritt weiterhin auf");
  await expect(retry(page)).toBeFocused();
  await expect(page.getByText(SECRET)).toHaveCount(0);

  await page.keyboard.press("Tab");
  await expect(reload(page)).toBeFocused();
  page.removeAllListeners("pageerror");
  const reloaded = page.waitForEvent("load");
  await page.keyboard.press("Enter");
  await reloaded;
});

test("Routenwechsel setzt die Fehleransicht zurück", async ({ page }) => {
  await injectRenderFault(page, "components/settings/theme-picker.tsx", "ThemePicker");
  await page.goto("/tests/browser/fixture.html?route=/settings/code-hosting");
  await expect(page.getByRole("heading", { name: "Einstellungen", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Darstellung", exact: true }).click();
  await expect(alert(page, PAGE_TITLE)).toBeVisible();

  await page.getByRole("button", { name: "Zurück", exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/code-hosting$/);
  await expect(page.getByRole("heading", { name: "Einstellungen", exact: true })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: PAGE_TITLE })).toHaveCount(0);

  await setFault(page, false);
  await page.getByRole("link", { name: "Darstellung", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Erscheinungsbild", exact: true })).toBeVisible();
});

test("Root-Fallback fängt Shell-Fehler und Retry stellt die App wieder her", async ({ page }, testInfo) => {
  await injectRenderFault(page, "components/shell/app-header.tsx", "AppHeader");
  await page.goto("/tests/browser/fixture.html?route=/kalender");

  await expect(alert(page, APP_TITLE)).toBeVisible();
  await expect(mainNav(page)).toHaveCount(0);
  await expect(page.getByText(SECRET)).toHaveCount(0);
  await expect(retry(page)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(reload(page)).toBeFocused();
  await page.waitForTimeout(400);
  await shot(page, testInfo, "root-error");

  await setFault(page, false);
  await page.keyboard.press("Shift+Tab");
  await expect(retry(page)).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("navigation", { name: "Werkzeuge" }).getByRole("link", { name: "Einstellungen", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kalender", exact: true })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: APP_TITLE })).toHaveCount(0);
});
