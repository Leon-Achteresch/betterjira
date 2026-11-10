import { expect, test, type Locator, type Page } from "@playwright/test";

const shots = process.env.PROJECT_PREFS_SHOTS;
const STORE = "betterjira-favorites";
const DEMO = "10000";
const OPS = "10001";
const scope = (cloud: string, account: string) => JSON.stringify([cloud, account]);
const own = scope("qa-cloud", "qa-user");
const colleague = scope("qa-cloud", "qa-colleague");
const otherInstance = scope("other-cloud", "qa-user");

const projects = [
  { id: DEMO, key: "DEMO", name: "Produktentwicklung", projectTypeKey: "software", avatarUrls: { "48x48": "/logo.svg" } },
  { id: OPS, key: "OPS", name: "Betrieb", projectTypeKey: "software", avatarUrls: { "48x48": "/logo.svg" } },
];

type Open = { route?: string; account?: string; cloud?: string; scenario?: string; reduce?: boolean };

const open = (page: Page, { route = "/settings/bereiche", account, cloud, scenario, reduce }: Open = {}) =>
  page.goto(
    `/tests/browser/fixture.html?${new URLSearchParams({
      route,
      ...(account && { account }),
      ...(cloud && { cloud }),
      ...(scenario && { scenario }),
      ...(reduce && { reduce: "1" }),
    })}`,
  );

const seed = (page: Page, state: unknown) =>
  page.addInitScript(
    ([key, value]) => {
      if (sessionStorage.getItem("qa-project-prefs-seeded")) return;
      localStorage.setItem(key, value);
      sessionStorage.setItem("qa-project-prefs-seeded", "1");
    },
    [STORE, JSON.stringify({ state, version: 0 })] as const,
  );

const stored = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "null")?.state ?? null, STORE);

const star = (page: Page, name: string) => page.getByRole("main").getByRole("button", { name: new RegExp(`^${name} (favorisieren|aus Favoriten entfernen)$`) });
const shown = (page: Page, name: string) => page.getByRole("main").getByRole("switch", { name: `${name} in Sidebar anzeigen` });
const legacyNotice = (page: Page) => page.getByRole("region", { name: "Frühere Bereichs-Einstellungen" });

const sidebar = async (page: Page) => {
  if ((page.viewportSize()?.width ?? 0) < 768) await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  const content = page.locator('[data-sidebar="content"]:visible');
  await expect(content).toBeVisible();
  return content;
};

const closeSidebar = async (page: Page) => {
  if ((page.viewportSize()?.width ?? 0) < 768) await page.keyboard.press("Escape");
};

const favoritesGroup = (content: Locator) =>
  content.locator('[data-sidebar="group"]').filter({ has: content.page().getByRole("button", { name: "Favoriten", exact: true }) });

const dashboardFavorites = (page: Page) =>
  page.getByRole("main").locator('section:has(> h2:text-is("Favoriten"))');

const geistReady = (page: Page) =>
  expect.poll(() => page.evaluate(async () => (await document.fonts.ready, document.fonts.check("16px 'Geist Variable'")))).toBe(true);

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.addInitScript((list) => Object.assign(window, { __qaProjects: list }), projects);
});

test("Gleiche Projekt-ID bleibt je Konto und Instanz getrennt, Sidebar, Übersicht und Einstellungen synchron", async ({ page }) => {
  await open(page);
  await star(page, "Produktentwicklung").click();
  await shown(page, "Betrieb").click();
  await expect(star(page, "Produktentwicklung")).toHaveAttribute("aria-pressed", "true");
  await expect(shown(page, "Betrieb")).not.toBeChecked();

  let content = await sidebar(page);
  await expect(favoritesGroup(content).getByRole("link", { name: "Produktentwicklung" })).toBeVisible();
  await expect(content.getByRole("link", { name: "Betrieb" })).toHaveCount(0);
  await closeSidebar(page);

  await open(page, { route: "/" });
  await expect(dashboardFavorites(page).getByRole("link", { name: "Produktentwicklung" })).toBeVisible();

  await open(page, { route: "/", account: "qa-colleague" });
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toContainText("Alex");
  content = await sidebar(page);
  await expect(content.getByRole("link", { name: "Betrieb" })).toBeVisible();
  await expect(content.getByRole("button", { name: "Favoriten", exact: true })).toHaveCount(0);
  await closeSidebar(page);
  await expect(dashboardFavorites(page)).toHaveCount(0);

  await open(page, { account: "qa-colleague" });
  await expect(star(page, "Produktentwicklung")).toHaveAttribute("aria-pressed", "false");
  await expect(shown(page, "Betrieb")).toBeChecked();
  await star(page, "Betrieb").click();
  await expect(star(page, "Betrieb")).toHaveAttribute("aria-pressed", "true");

  await open(page, { cloud: "other-cloud" });
  await expect(star(page, "Produktentwicklung")).toHaveAttribute("aria-pressed", "false");
  await expect(star(page, "Betrieb")).toHaveAttribute("aria-pressed", "false");
  await expect(shown(page, "Betrieb")).toBeChecked();

  const state = await stored(page);
  expect(state.scopes).toEqual({
    [own]: { favoriteIds: [DEMO], hiddenIds: [OPS] },
    [colleague]: { favoriteIds: [OPS], hiddenIds: [] },
  });
  expect(state.scopes[otherInstance]).toBeUndefined();
});

test("Alte globale Einstellungen werden erst nach ausdrücklicher Übernahme einem Konto zugeordnet", async ({ page }) => {
  await seed(page, { projectIds: [DEMO], hiddenProjectIds: [OPS] });
  await open(page, { route: "/" });
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toContainText("Alex");
  await expect(dashboardFavorites(page)).toHaveCount(0);
  const content = await sidebar(page);
  await expect(content.getByRole("link", { name: "Betrieb" })).toBeVisible();
  await closeSidebar(page);
  expect(JSON.stringify(await stored(page))).not.toContain("qa-user");

  await open(page);
  await expect(legacyNotice(page)).toContainText("1 Favorit, 1 ausgeblendeter Bereich");
  await expect(legacyNotice(page)).toContainText("Alex Beispiel (Lokale UI-Testdaten)");
  await expect(star(page, "Produktentwicklung")).toHaveAttribute("aria-pressed", "false");
  await geistReady(page);
  if (shots) await page.screenshot({ path: `${shots}/${test.info().project.name}-legacy.png` });

  await legacyNotice(page).getByRole("button", { name: "Übernehmen" }).dblclick();
  await expect(legacyNotice(page)).toHaveCount(0);
  await expect(star(page, "Produktentwicklung")).toHaveAttribute("aria-pressed", "true");
  await expect(shown(page, "Betrieb")).not.toBeChecked();
  expect(await stored(page)).toEqual({ scopes: { [own]: { favoriteIds: [DEMO], hiddenIds: [OPS] } }, legacy: null });

  await open(page);
  await expect(star(page, "Produktentwicklung")).toHaveAttribute("aria-pressed", "true");
  await expect(legacyNotice(page)).toHaveCount(0);

  await open(page, { account: "qa-colleague" });
  await expect(star(page, "Produktentwicklung")).toHaveAttribute("aria-pressed", "false");
  await expect(shown(page, "Betrieb")).toBeChecked();
  await expect(legacyNotice(page)).toHaveCount(0);
});

test("Verwerfen der alten Einstellungen lässt sich rückgängig machen und hält über Neuladen", async ({ page }) => {
  await seed(page, { projectIds: [DEMO], hiddenProjectIds: [] });
  await open(page);
  await legacyNotice(page).getByRole("button", { name: "Verwerfen" }).click();
  await expect(legacyNotice(page)).toHaveCount(0);
  expect((await stored(page)).legacy).toBeNull();

  await page.getByRole("button", { name: "Rückgängig" }).click();
  await expect(legacyNotice(page)).toContainText("1 Favorit, 0 ausgeblendete Bereiche");

  await open(page);
  await expect(legacyNotice(page)).toBeVisible();
  expect(await stored(page)).toEqual({ scopes: {}, legacy: { favoriteIds: [DEMO], hiddenIds: [] } });
});

const accountState = {
  scopes: { [own]: { favoriteIds: [DEMO], hiddenIds: [OPS] } },
  legacy: { favoriteIds: [OPS], hiddenIds: [] },
};

test("Verzögerte Kontoprüfung zeigt erst danach die eigenen Einstellungen", async ({ page }) => {
  await seed(page, accountState);
  await page.addInitScript(() => Object.assign(window, { __qaMyselfDelayMs: 2500 }));
  await open(page);
  await expect(page.getByRole("main").getByRole("status")).toBeVisible();
  await expect(star(page, "Produktentwicklung")).toHaveCount(0);
  await expect(legacyNotice(page)).toHaveCount(0);

  await expect(star(page, "Produktentwicklung")).toHaveAttribute("aria-pressed", "true");
  await expect(legacyNotice(page)).toBeVisible();
  expect(await stored(page)).toEqual(accountState);
});

test("Fehlgeschlagene Kontoprüfung zeigt keine Einstellungen und schreibt nichts", async ({ page }) => {
  await seed(page, accountState);
  await page.addInitScript(() => Object.assign(window, { __qaFailMyself: true }));
  await open(page);
  await expect(star(page, "Produktentwicklung")).toBeDisabled();
  await expect(star(page, "Produktentwicklung")).toHaveAttribute("aria-pressed", "false");
  await expect(shown(page, "Betrieb")).toBeChecked();
  await expect(shown(page, "Betrieb")).toBeDisabled();
  await expect(legacyNotice(page)).toHaveCount(0);
  expect(await stored(page)).toEqual(accountState);

  await open(page, { scenario: "session-error" });
  await expect(star(page, "Produktentwicklung")).toHaveCount(0);
  expect(await stored(page)).toEqual(accountState);
});

test("Abmelden blendet die Einstellungen aus, erneute Anmeldung stellt sie wieder her", async ({ page }) => {
  await seed(page, accountState);
  await open(page, { route: "/" });
  await expect(dashboardFavorites(page).getByRole("link", { name: "Produktentwicklung" })).toBeVisible();

  const content = await sidebar(page);
  await expect(favoritesGroup(content).getByRole("link", { name: "Produktentwicklung" })).toBeVisible();
  await page.locator('[data-sidebar="footer"]:visible').getByRole("button").first().click();
  await page.getByRole("menuitem", { name: "Abmelden" }).click();
  await expect(page.locator('[data-sidebar="footer"]:visible').getByRole("button", { name: "Mit Atlassian verbinden" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Favoriten", exact: true })).toHaveCount(0);
  await closeSidebar(page);
  await expect(page.getByRole("main").getByRole("button", { name: "Mit Atlassian verbinden" })).toBeVisible();
  await expect(dashboardFavorites(page)).toHaveCount(0);
  expect(await stored(page)).toEqual(accountState);

  await open(page, { route: "/" });
  await expect(dashboardFavorites(page).getByRole("link", { name: "Produktentwicklung" })).toBeVisible();
});

test("390 px, Tastatur und reduzierte Bewegung", async ({ page }) => {
  await seed(page, { projectIds: [DEMO], hiddenProjectIds: [OPS] });
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, { reduce: true });
  await expect(legacyNotice(page)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const name of ["Übernehmen", "Verwerfen"]) {
    const box = await legacyNotice(page).getByRole("button", { name }).boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(32);
  }
  await geistReady(page);
  if (shots) await page.screenshot({ path: `${shots}/${test.info().project.name}-390.png` });

  await legacyNotice(page).getByRole("button", { name: "Übernehmen" }).focus();
  await page.keyboard.press("Enter");
  await expect(legacyNotice(page)).toHaveCount(0);

  await star(page, "Betrieb").focus();
  await page.keyboard.press("Space");
  await expect(star(page, "Betrieb")).toHaveAttribute("aria-pressed", "true");
  await shown(page, "Betrieb").focus();
  await page.keyboard.press("Space");
  await expect(shown(page, "Betrieb")).toBeChecked();
  expect((await stored(page)).scopes[own]).toEqual({ favoriteIds: [DEMO, OPS], hiddenIds: [] });
});
