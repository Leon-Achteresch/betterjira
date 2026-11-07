import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __qa: { searches: string[]; outlook: { calls: { action: string }[] } };
    __qaStorage: { reads: number; writes: number };
  }
}

const storageKey = "betterjira:calendar:rollouts:v1";

const open = async (page: Page, route = "/kalender") => {
  await page.goto(`/tests/browser/fixture.html?${new URLSearchParams({ scenario: "rollout-search", route })}`);
  await expect(page.getByRole("heading", { name: "Kalender", exact: true })).toBeVisible();
};

const field = (page: Page) => page.getByRole("searchbox", { name: "Geladene Rollouts durchsuchen" });
const results = (page: Page) => page.getByRole("list", { name: "Treffer in geladenen Rollouts" });
const result = (page: Page, title: string) => results(page).getByRole("button", { name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
const status = (page: Page) => page.getByRole("region", { name: "Geladene Rollouts durchsuchen" }).getByRole("status");
const agenda = (page: Page) => page.getByRole("region", { name: "Tagesagenda" });
const monthHeading = (page: Page, name: string) => page.getByRole("heading", { name, exact: true });
const searchParam = (page: Page) => new URL(page.url()).searchParams.get("q");

const countStorage = (page: Page) =>
  page.addInitScript((key) => {
    window.__qaStorage = { reads: 0, writes: 0 };
    const { getItem, setItem } = Storage.prototype;
    Storage.prototype.getItem = function (name) {
      if (name === key) window.__qaStorage.reads += 1;
      return getItem.call(this, name);
    };
    Storage.prototype.setItem = function (name, value) {
      if (name === key || name.startsWith("betterjira:calendar:outlook")) window.__qaStorage.writes += 1;
      return setItem.call(this, name, value);
    };
  }, storageKey);

const accessSnapshot = (page: Page) =>
  page.evaluate(() => ({
    reads: window.__qaStorage.reads,
    writes: window.__qaStorage.writes,
    searches: window.__qa.searches.length,
    outlook: window.__qa.outlook.calls.length,
  }));

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.clock.setFixedTime(new Date("2026-11-06T12:00:00.000Z"));
});

test("Suche filtert nur die Trefferliste, Kalender und Tagesagenda bleiben unverändert", async ({ page }) => {
  await open(page);
  await expect(agenda(page).locator("article").filter({ hasText: "Produktion Release 2.4" })).toBeVisible();
  await expect(results(page)).toHaveCount(0);
  await expect(status(page)).toHaveCount(0);

  await field(page).fill("migration");
  await expect(result(page, "Datenbank Migration")).toBeVisible();
  await expect(result(page, "Datenbank Migration")).toContainText("Do., 3. Dez. 2026");
  await expect(result(page, "Datenbank Migration")).toContainText("OPS-7");
  await expect(status(page)).toHaveText("1 Treffer in den geladenen Rollouts");
  await expect.poll(() => searchParam(page)).toBe("migration");
  await expect(monthHeading(page, "November 2026")).toBeVisible();
  await expect(monthHeading(page, "Freitag, 6. November")).toBeVisible();
  await expect(agenda(page).locator("article").filter({ hasText: "Produktion Release 2.4" })).toBeVisible();
});

test("Mehrere Wörter, Groß/Klein und Sonderzeichen werden wörtlich verglichen", async ({ page }) => {
  await open(page);
  await field(page).fill("RELEASE demo-1");
  await expect(results(page).getByRole("button")).toHaveCount(1);
  await expect(result(page, "Produktion Release 2.4")).toBeVisible();

  await field(page).fill("(grafana)");
  await expect(results(page).getByRole("button")).toHaveCount(1);
  await expect(result(page, "Produktion Release 2.4")).toBeVisible();

  await field(page).fill("[intern] 50%");
  await expect(results(page).getByRole("button")).toHaveCount(1);
  await expect(result(page, "Wartungsfenster [intern] 50%")).toBeVisible();

  await field(page).fill("release ops-7");
  await expect(status(page)).toContainText("Keine Treffer in den geladenen Rollouts");
  await field(page).fill(".*");
  await expect(status(page)).toContainText("Keine Treffer in den geladenen Rollouts");
  await expect(results(page)).toHaveCount(0);
});

test("Treffer in anderem Monat wählt den richtigen Tag und navigiert den Zeitraum", async ({ page }) => {
  await open(page);
  await field(page).fill("migration");
  await result(page, "Datenbank Migration").click();
  await expect(monthHeading(page, "Dezember 2026")).toBeVisible();
  await expect(monthHeading(page, "Donnerstag, 3. Dezember")).toBeVisible();
  await expect(agenda(page).locator("article").filter({ hasText: "Datenbank Migration" })).toBeVisible();
  await expect(agenda(page)).toBeInViewport();
  await expect(field(page)).toHaveValue("migration");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await field(page).fill("hotfix-release 1.0.3");
  await result(page, "Hotfix-Release 1.0.3").click();
  await expect(monthHeading(page, "Oktober 2026")).toBeVisible();
  await expect(monthHeading(page, "Samstag, 3. Oktober")).toBeVisible();
});

test("Längere Trefferliste ist begrenzt und klappt bei neuer Suche wieder ein", async ({ page }) => {
  await open(page);
  await field(page).fill("hotfix");
  await expect(status(page)).toHaveText("10 Treffer in den geladenen Rollouts");
  await expect(results(page).getByRole("button")).toHaveCount(8);
  await page.getByRole("button", { name: "Weitere anzeigen (2)" }).click();
  await expect(results(page).getByRole("button")).toHaveCount(10);
  await expect(page.getByRole("button", { name: "Weniger anzeigen" })).toBeVisible();

  await field(page).fill("hotfix-release");
  await expect(results(page).getByRole("button")).toHaveCount(8);
  await expect(page.getByRole("button", { name: "Weitere anzeigen (2)" })).toBeVisible();
});

test("Eingabe und Auswahl lösen keine zusätzlichen Lese- oder Schreibzugriffe aus", async ({ page }) => {
  await countStorage(page);
  await open(page);
  await expect(agenda(page).locator("article").filter({ hasText: "Produktion Release 2.4" })).toBeVisible();
  const before = await accessSnapshot(page);

  for (const text of ["m", "mi", "migration", "hotfix", "RELEASE demo-1", ""]) await field(page).fill(text);
  await field(page).fill("migration");
  await expect(result(page, "Datenbank Migration")).toBeVisible();
  expect(await accessSnapshot(page)).toEqual(before);

  await result(page, "Datenbank Migration").click();
  await expect(monthHeading(page, "Donnerstag, 3. Dezember")).toBeVisible();
  const after = await accessSnapshot(page);
  expect(after.writes).toBe(before.writes);
  expect(after.outlook).toBe(before.outlook);
  expect(after.reads).toBe(before.reads);
});

test("Suchtext folgt URL, Zurück/Vorwärts und lässt sich zurücksetzen", async ({ page }) => {
  await open(page, "/kalender?q=Migration");
  await expect(field(page)).toHaveValue("Migration");
  await expect(result(page, "Datenbank Migration")).toBeVisible();

  await field(page).fill("hotfix");
  await expect.poll(() => searchParam(page)).toBe("hotfix");
  const calendarLink = page.getByRole("link", { name: "Kalender", exact: true });
  const toggled = !(await calendarLink.isVisible());
  if (toggled) await page.getByRole("button", { name: "Toggle Sidebar", exact: true }).click();
  await calendarLink.click();
  if (toggled && (await calendarLink.isVisible())) await page.keyboard.press("Escape");
  await expect.poll(() => searchParam(page)).toBeNull();
  await expect(field(page)).toHaveValue("");
  await expect(results(page)).toHaveCount(0);

  await page.goBack();
  await expect.poll(() => searchParam(page)).toBe("hotfix");
  await expect(field(page)).toHaveValue("hotfix");
  await expect(results(page).getByRole("button")).toHaveCount(8);
  await page.goForward();
  await expect.poll(() => searchParam(page)).toBeNull();
  await expect(field(page)).toHaveValue("");

  await field(page).fill("migration");
  await field(page).press("Escape");
  await expect(field(page)).toHaveValue("");
  await expect.poll(() => searchParam(page)).toBeNull();

  await field(page).fill("migration");
  await page.getByRole("button", { name: "Suche leeren", exact: true }).click();
  await expect(field(page)).toHaveValue("");
  await expect(results(page)).toHaveCount(0);

  await open(page, "/kalender?q=%20%20%20");
  await expect(field(page)).toHaveValue("");
  await expect(status(page)).toHaveCount(0);
});

test("Ladefehler der Rollouts erscheint nicht als leere Trefferliste", async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, "{kaputt"), storageKey);
  await open(page);
  await expect(page.getByText("Rollouts konnten nicht geladen werden", { exact: true })).toBeVisible();
  await field(page).fill("migration");
  await expect(status(page)).toHaveText("Die Rollouts sind gerade nicht geladen, deshalb kann nicht gesucht werden.");
  await expect(page.getByText(/Keine Treffer/)).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe("{kaputt");
});

test("Tastatur: Treffer per Tab erreichen und mit Enter den Tag wählen", async ({ page }) => {
  await open(page);
  await field(page).focus();
  await page.keyboard.type("migration");
  const target = result(page, "Datenbank Migration");
  await expect(target).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Suche leeren", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(target).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(monthHeading(page, "Donnerstag, 3. Dezember")).toBeVisible();
  await expect(target).toBeFocused();
  await field(page).focus();
  await page.keyboard.press("Escape");
  await expect(field(page)).toHaveValue("");
});

for (const scheme of ["light", "dark"] as const) {
  test(`390 px ${scheme === "light" ? "hell" : "dunkel"} ohne Seitenüberlauf`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Eigene Breite und eigenes Schema");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: scheme });
    await open(page);
    await field(page).fill("release");
    await expect(results(page).getByRole("button").first()).toBeVisible();
    const state = await page.evaluate(async () => {
      await document.fonts.load('16px "Geist Variable"');
      await document.fonts.ready;
      await Promise.all(
        document
          .getAnimations()
          .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
          .map((animation) => animation.finished.catch(() => undefined)),
      );
      return {
        loaded: [...document.fonts].some((face) => face.family.includes("Geist") && face.status === "loaded"),
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        dark: document.documentElement.classList.contains("dark"),
      };
    });
    expect(state.loaded).toBe(true);
    expect(state.overflow).toBeLessThanOrEqual(0);
    expect(state.dark).toBe(scheme === "dark");
    await page.getByRole("region", { name: "Geladene Rollouts durchsuchen" }).scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    const dir = process.env.ROLLOUT_SEARCH_SHOTS;
    if (dir) await page.screenshot({ path: `${dir}/390-${scheme === "light" ? "hell" : "dunkel"}.png` });
  });
}
