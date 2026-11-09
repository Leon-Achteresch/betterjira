import { expect, test, type Page } from "@playwright/test";

type SearchRule = { delayMs?: number; status?: number };

declare global {
  interface Window {
    __qa: {
      searches: string[];
      emptySearch: boolean;
      failMyself: boolean;
      myselfCalls: number;
    };
    __qaSearchRule?: (jql: string) => SearchRule;
    __dashboardRule: SearchRule;
  }
}

const SHOTS = process.env.DASHBOARD_SHOTS;
const MY_WORK = "resolved >= -7d";

const open = (page: Page) => page.goto(`/tests/browser/fixture.html?${new URLSearchParams({ route: "/" })}`);

const freshness = (page: Page) => page.getByTestId("dashboard-freshness");
const status = (page: Page) => freshness(page).getByRole("status");
const refreshButton = (page: Page) => freshness(page).getByRole("button");
const ticket = (page: Page) => page.getByRole("main").getByRole("link", { name: "Suche für den Arbeitsalltag vereinfachen" });

const setRule = (page: Page, rule: SearchRule) =>
  page.evaluate((value) => {
    window.__dashboardRule = value;
  }, rule);

const workRequests = (page: Page) =>
  page.evaluate((marker) => window.__qa.searches.filter((jql) => jql.includes(marker)).length, MY_WORK);

const setDeviceOnline = (page: Page, online: boolean) =>
  page.evaluate((value) => {
    Object.defineProperty(Navigator.prototype, "onLine", { configurable: true, get: () => value });
    window.dispatchEvent(new Event(value ? "online" : "offline"));
  }, online);

const shot = async (page: Page, name: string) => {
  if (!SHOTS) return;
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.addInitScript((marker) => {
    window.__dashboardRule = {};
    window.__qaSearchRule = (jql) => (jql.includes(marker) ? window.__dashboardRule : {});
  }, MY_WORK);
});

test("Initiales Laden zeigt Platzhalter, danach Stand und Tickets", async ({ page }) => {
  await page.addInitScript(() => {
    window.__dashboardRule = { delayMs: 1200 };
  });
  await open(page);
  await expect(page.getByRole("main").locator("[aria-busy]")).toBeVisible();
  await expect(freshness(page)).toHaveCount(0);
  await expect(ticket(page)).toBeVisible();
  await expect(status(page)).toHaveText(/^Stand \d{2}:\d{2} Uhr$/);
  await shot(page, "fresh");
});

test("Initialfehler ohne Daten ist klar erkennbar, Retry lädt", async ({ page }) => {
  await page.addInitScript(() => {
    window.__dashboardRule = { status: 400 };
  });
  await open(page);
  const alert = page.getByRole("main").getByRole("alert");
  await expect(alert).toContainText("Deine Tickets konnten nicht geladen werden.");
  await expect(alert).toContainText("Test: Jira antwortet mit 400");
  await expect(freshness(page)).toHaveCount(0);
  await shot(page, "initial-error");
  await setRule(page, {});
  await alert.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(ticket(page)).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
});

test("Erfolgreiches Aktualisieren lädt genau einmal neu, Doppelklick löst keinen zweiten Abruf aus", async ({ page }) => {
  await open(page);
  await expect(status(page)).toHaveText(/^Stand/);
  const before = await workRequests(page);
  const myselfBefore = await page.evaluate(() => window.__qa.myselfCalls);
  await setRule(page, { delayMs: 1200 });
  await refreshButton(page).dblclick();
  await expect(status(page)).toContainText("Wird aktualisiert");
  await expect(refreshButton(page)).toHaveAttribute("aria-disabled", "true");
  await refreshButton(page).click({ force: true });
  await expect(ticket(page)).toBeVisible();
  await expect(status(page)).toHaveText(/^Stand/);
  expect(await workRequests(page)).toBe(before + 1);
  expect(await page.evaluate(() => window.__qa.myselfCalls)).toBe(myselfBefore + 1);
  await expect(refreshButton(page)).not.toHaveAttribute("aria-disabled");
});

test("Vollständiger Refreshfehler behält Tickets, warnt und Retry stellt den Stand wieder her", async ({ page }) => {
  await open(page);
  await expect(status(page)).toHaveText(/^Stand/);
  await setRule(page, { status: 400 });
  await page.evaluate(() => {
    window.__qa.failMyself = true;
  });
  await refreshButton(page).click();
  await expect(status(page)).toContainText("Aktualisierung fehlgeschlagen", { timeout: 20_000 });
  await expect(ticket(page)).toBeVisible();
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toContainText("Alex");
  await expect(page.getByRole("main").getByText("in Arbeit", { exact: false }).first()).toBeVisible();
  await shot(page, "refresh-failed");
  await setRule(page, {});
  await page.evaluate(() => {
    window.__qa.failMyself = false;
  });
  await freshness(page).getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(status(page)).toHaveText(/^Stand/);
  await expect(freshness(page).getByRole("button", { name: "Übersicht aktualisieren" })).toBeVisible();
});

test("Teilweiser Refreshfehler nennt den Bereich und behauptet keinen frischen Stand", async ({ page }) => {
  await open(page);
  await expect(status(page)).toHaveText(/^Stand/);
  await setRule(page, { status: 400 });
  await refreshButton(page).click();
  await expect(status(page)).toContainText("Tickets nicht aktualisiert");
  await expect(ticket(page)).toBeVisible();
  await setRule(page, {});
  await freshness(page).getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(status(page)).toHaveText(/^Stand/);
});

test("Leere Arbeitsliste mit fehlgeschlagenem Refresh zeigt trotzdem eine Warnung", async ({ page }) => {
  await page.addInitScript(() => {
    let qa: Window["__qa"] | undefined;
    Object.defineProperty(window, "__qa", {
      configurable: true,
      get: () => qa,
      set: (value: Window["__qa"]) => {
        qa = { ...value, emptySearch: true };
      },
    });
  });
  await open(page);
  await expect(page.getByText("Nichts Offenes auf deinem Tisch.")).toBeVisible();
  await expect(status(page)).toHaveText(/^Stand/);
  await setRule(page, { status: 400 });
  await refreshButton(page).click();
  await expect(status(page)).toContainText("Tickets nicht aktualisiert");
  await expect(page.getByText("Nichts Offenes auf deinem Tisch.")).toBeVisible();
  await shot(page, "empty-refresh-failed");
});

test("Offline pausiert ohne Dauerladen, online setzt fort", async ({ page }) => {
  await open(page);
  await expect(status(page)).toHaveText(/^Stand/);
  const before = await workRequests(page);
  await setDeviceOnline(page, false);
  await expect(status(page)).toContainText("Offline");
  await refreshButton(page).click();
  await expect(status(page)).toContainText("Offline");
  await expect(status(page)).not.toContainText("Wird aktualisiert");
  await expect(ticket(page)).toBeVisible();
  await shot(page, "offline");
  await setDeviceOnline(page, true);
  await expect(status(page)).toHaveText(/^Stand/);
  expect(await workRequests(page)).toBeGreaterThan(before);
});

test("Tastatur erreicht und löst Aktualisieren aus, schmale Ansicht ohne Überlauf", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await expect(status(page)).toHaveText(/^Stand/);
  const box = await refreshButton(page).boundingBox();
  expect(Math.round(box!.width * 100) / 100).toBeGreaterThanOrEqual(32);
  expect(Math.round(box!.height * 100) / 100).toBeGreaterThanOrEqual(32);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await setRule(page, { delayMs: 600 });
  const before = await workRequests(page);
  await refreshButton(page).focus();
  await expect(refreshButton(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(status(page)).toContainText("Wird aktualisiert");
  await expect.poll(() => workRequests(page)).toBe(before + 1);
  await expect(refreshButton(page)).toBeFocused();
  await expect(status(page)).toHaveText(/^Stand/);
  await shot(page, "narrow");
  await expect(refreshButton(page)).not.toHaveAttribute("aria-disabled", "true");
  await setRule(page, { status: 400 });
  await page.keyboard.press("Enter");
  await expect(status(page)).toContainText("Tickets nicht aktualisiert");
  await expect(freshness(page).getByRole("button", { name: "Erneut versuchen" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await shot(page, "narrow-partial");
});
