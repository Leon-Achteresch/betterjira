import { expect, test, type Page } from "@playwright/test";

const shots = process.env.FILTER_SHOTS;

const open = async (page: Page, route = "/filter", account?: string) => {
  await page.goto(
    `/tests/browser/fixture.html?${new URLSearchParams({ scenario: "filters", route, ...(account && { account }) })}`,
  );
  await expect(page.getByRole("heading", { name: "Filter", level: 1 })).toBeVisible();
};

const views = (page: Page) => page.getByRole("navigation", { name: "Filter-Ansicht" });
const list = (page: Page) => page.getByRole("list", { name: "Filter" });
const rows = (page: Page) => list(page).getByRole("listitem");
const search = (page: Page) => page.getByRole("searchbox", { name: "Filter durchsuchen" });
const sidebar = (page: Page) => page.locator('[data-sidebar="sidebar"]');
const star = (page: Page, name: string, action: "zu Favoriten hinzufügen" | "aus Favoriten entfernen") =>
  list(page).getByRole("button", { name: `„${name}“ ${action}` });
const qa = <T,>(page: Page, expression: string) => page.evaluate<T>(`window.__qa.${expression}`);
const favouriteWrites = (page: Page) =>
  page.evaluate<number>(`window.__qa.writes.filter((write) => write.path.endsWith("/favourite")).length`);
const shoot = async (page: Page, name: string) => {
  if (!shots) return;
  expect(await page.evaluate(async () => (await document.fonts.ready).check('14px "Geist Variable"'))).toBe(true);
  await page.screenshot({ path: `${shots}/${test.info().project.name}-${name}.png` });
};
const wide = (page: Page) => (page.viewportSize()?.width ?? 0) >= 768;

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("Nichttextliche Suchparameter lassen die Filterübersicht nutzbar", async ({ page }) => {
  for (const value of ["123", "false", '{"query":"support"}']) {
    await open(page, `/filter?${new URLSearchParams({ q: value, ansicht: "geteilt" })}`);
    await expect(search(page)).toHaveValue("");
    await expect(rows(page)).toHaveCount(7);
    await expect(views(page).getByRole("link", { name: "Alle 7" })).toHaveAttribute("aria-current", "page");
  }
});

test("Übersicht zeigt eigene und favorisierte Filter mit Suche, Ansicht und Verlauf in der URL", async ({ page }) => {
  await open(page);
  await expect(views(page).getByRole("link", { name: "Alle 7" })).toHaveAttribute("aria-current", "page");
  await expect(views(page).getByRole("link", { name: "Favoriten 3" })).toBeVisible();
  await expect(rows(page)).toHaveCount(7);
  await expect(rows(page).first()).toContainText("Offene Bugs Team");
  await expect(list(page).getByText("Backlog des Kollegen")).toHaveCount(0);
  await expect(page.getByText("Andere geteilte Filter werden hier nicht durchsucht.", { exact: false })).toBeVisible();
  expect(await qa<number>(page, "filterRequests")).toBe(1);
  await shoot(page, "overview");

  await views(page).getByRole("link", { name: /^Favoriten/ }).click();
  await expect(page).toHaveURL(/\/filter\?ansicht=favoriten$/);
  await expect(rows(page)).toHaveCount(3);
  await search(page).fill("support");
  await expect(page).toHaveURL(/ansicht=favoriten&q=support$/);
  await expect(rows(page)).toHaveCount(1);
  await search(page).fill("gibt es nicht");
  await expect(page.getByText("Kein passender Filter")).toBeVisible();
  await page.getByRole("button", { name: "Suche zurücksetzen" }).click();
  await expect(page).toHaveURL(/\/filter\?ansicht=favoriten$/);

  await views(page).getByRole("link", { name: /^Alle/ }).click();
  await expect(page).toHaveURL(/\/filter$/);
  await page.goBack();
  await expect(views(page).getByRole("link", { name: /^Favoriten/ })).toHaveAttribute("aria-current", "page");
  await expect(rows(page)).toHaveCount(3);
  await page.goForward();
  await expect(views(page).getByRole("link", { name: /^Alle/ })).toHaveAttribute("aria-current", "page");

  await open(page, "/filter?ansicht=favoriten&q=rollout");
  await expect(search(page)).toHaveValue("rollout");
  await expect(rows(page)).toHaveCount(1);
  await open(page, "/filter?ansicht=geteilt");
  await expect(views(page).getByRole("link", { name: /^Alle/ })).toHaveAttribute("aria-current", "page");

  await list(page).getByRole("link", { name: "Kundenfeedback Q4" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/filter\/107$/);
  await expect(page.getByRole("heading", { name: "Kundenfeedback Q4" })).toBeVisible();
  if (wide(page)) {
    await expect(sidebar(page).getByRole("link", { name: "Kundenfeedback Q4" })).toHaveAttribute("data-active", "true");
    await expect(sidebar(page).getByRole("link", { name: "Alle Filter" })).not.toHaveAttribute("data-active", "true");
  }
  await page.goBack();
  await expect(page).toHaveURL(/\/filter\?ansicht=geteilt$/);
  await expect(views(page).getByRole("link", { name: /^Alle/ })).toHaveAttribute("aria-current", "page");
  await expect(rows(page)).toHaveCount(7);
});

test("Favorit ändern bleibt mit der Seitenleiste synchron, schreibt einmal und nimmt Fehler zurück", async ({ page }) => {
  await open(page);
  if (wide(page)) await expect(sidebar(page).getByRole("link", { name: "Kundenfeedback Q4" })).toBeVisible();

  await page.evaluate("window.__qa.delayMs = 400");
  await star(page, "Kundenfeedback Q4", "zu Favoriten hinzufügen").dblclick();
  await expect(star(page, "Kundenfeedback Q4", "aus Favoriten entfernen")).toHaveAttribute("aria-pressed", "true");
  await expect(views(page).getByRole("link", { name: "Favoriten 4" })).toBeVisible();
  await expect(star(page, "Kundenfeedback Q4", "aus Favoriten entfernen")).toBeEnabled();
  expect(await favouriteWrites(page)).toBe(1);
  await expect.poll(() => qa<boolean>(page, `filters.find((filter) => filter.id === "107").favourite`)).toBe(true);
  if (wide(page)) {
    const sidebarRows = sidebar(page).getByRole("link").filter({ hasText: /Bugs|Rollouts|Support|Kundenfeedback/ });
    await expect(sidebarRows).toHaveText(["Offene Bugs Team", "Rollouts diese Woche", "Support-Eskalationen", "Kundenfeedback Q4"]);
  }

  await page.evaluate("window.__qa.failNextWrite = true");
  await star(page, "Meine Rückfragen", "zu Favoriten hinzufügen").click();
  await expect(page.getByText("Favorit für „Meine Rückfragen“ konnte nicht geändert werden")).toBeVisible();
  await expect(star(page, "Meine Rückfragen", "zu Favoriten hinzufügen")).toHaveAttribute("aria-pressed", "false");
  await expect(views(page).getByRole("link", { name: "Favoriten 4" })).toBeVisible();
  expect(await favouriteWrites(page)).toBe(1);

  await star(page, "Support-Eskalationen", "aus Favoriten entfernen").click();
  await expect(list(page).getByText("Support-Eskalationen")).toHaveCount(0);
  await page.getByRole("button", { name: "Rückgängig" }).click();
  await expect(star(page, "Support-Eskalationen", "aus Favoriten entfernen")).toBeVisible();
  expect(await favouriteWrites(page)).toBe(3);
});

test("Ladefehler bietet Retry, Aktualisierungsfehler behält den gecachten Stand", async ({ page }) => {
  await page.goto("/tests/browser/fixture.html?scenario=filters&fail=filters&route=/filter");
  const failure = page.getByRole("main").getByRole("alert").filter({ hasText: "Filter konnten nicht geladen werden" });
  await expect(failure).toContainText("Test: Filter vorübergehend nicht erreichbar");
  await expect(page.getByText("Noch keine Filter")).toHaveCount(0);
  await page.evaluate("window.__qa.failFilters = false");
  await failure.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(rows(page)).toHaveCount(7);

  await page.evaluate("window.__qa.failFilters = true");
  await star(page, "Meine Rückfragen", "zu Favoriten hinzufügen").click();
  const warning = page.getByRole("main").getByRole("alert").filter({ hasText: "Aktualisierung fehlgeschlagen" });
  await expect(warning).toBeVisible();
  await expect(rows(page)).toHaveCount(7);
  await expect(star(page, "Meine Rückfragen", "aus Favoriten entfernen")).toHaveAttribute("aria-pressed", "true");
  if (wide(page)) await expect(sidebar(page).getByRole("link", { name: "Meine Rückfragen" })).toBeVisible();
  await page.evaluate("window.__qa.failFilters = false");
  await warning.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(warning).toHaveCount(0);
  await expect(rows(page)).toHaveCount(7);
});

test("Abmelden und Kontowechsel zeigen keine Filter eines anderen Kontos", async ({ page }) => {
  await open(page, "/filter", "qa-colleague");
  await expect(rows(page)).toHaveCount(1);
  await expect(list(page).getByText("Backlog des Kollegen")).toBeVisible();
  await expect(list(page).getByText("Offene Bugs Team")).toHaveCount(0);

  await page.locator("header").first().getByRole("button", { name: "Suchen" }).click();
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await palette.getByRole("combobox").fill("Abmelden");
  await palette.getByRole("option", { name: /Abmelden/ }).click();
  await expect(page.getByRole("main").getByText("Nicht angemeldet", { exact: true })).toBeVisible();
  await expect(list(page)).toHaveCount(0);
  await expect(page.getByText("Backlog des Kollegen")).toHaveCount(0);

  await open(page);
  await expect(rows(page)).toHaveCount(7);
  await expect(page.getByText("Backlog des Kollegen")).toHaveCount(0);
});

test("Command Palette und Seitenleiste führen per Tastatur und bei 390 px zur Übersicht", async ({ page }) => {
  await page.goto("/tests/browser/fixture.html?scenario=filters&route=/");
  await page.locator("header").first().getByRole("button", { name: "Suchen" }).click();
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await palette.getByRole("combobox").fill("Alle Filter");
  await expect(palette.getByRole("option", { name: /Alle Filter/ }).first()).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/filter$/);
  await expect(rows(page)).toHaveCount(7);

  await search(page).focus();
  await page.keyboard.type("bugs");
  await page.keyboard.press("Tab");
  await expect(list(page).getByRole("link", { name: "Offene Bugs Team" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(star(page, "Offene Bugs Team", "aus Favoriten entfernen")).toBeFocused();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tests/browser/fixture.html?scenario=filters&route=/");
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  const sheet = sidebar(page);
  await sheet.getByRole("link", { name: "Alle Filter" }).click();
  await expect(page).toHaveURL(/\/filter$/);
  await expect(sheet).toBeHidden();
  await expect(rows(page)).toHaveCount(7);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const row of await rows(page).all()) {
    const box = await row.getByRole("button").boundingBox();
    expect(box && Math.min(box.width, box.height)).toBeGreaterThanOrEqual(32);
  }
  await shoot(page, "390");
});
