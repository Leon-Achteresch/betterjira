import { expect, test, type Page } from "@playwright/test";

type ProjectRule = { status?: number; delayMs?: number; values?: { id: string; key: string; name: string; projectTypeKey: string; avatarUrls: { "48x48": string } }[] };

declare global {
  interface Window {
    __qaProjectRule?: () => ProjectRule;
    __qaProjectRuleValue?: ProjectRule;
    __qaReads?: string[];
  }
}

const shots = process.env.PROJECTS_SHOTS;

const open = (page: Page, route = "/bereiche") =>
  page.goto(`/tests/browser/fixture.html?${new URLSearchParams({ route, scenario: "projects" })}`);

const setRule = (page: Page, rule: ProjectRule) =>
  page.evaluate((value) => {
    window.__qaProjectRuleValue = value;
  }, rule);

const main = (page: Page) => page.getByRole("main");
const list = (page: Page) => main(page).getByRole("list", { name: "Bereiche" });
const views = (page: Page) => main(page).getByRole("navigation", { name: "Bereichsansicht" });
const search = (page: Page) => main(page).getByRole("searchbox", { name: "Bereiche durchsuchen" });
const prefs = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("betterjira-favorites") ?? "{}").state);

const sidebar = async (page: Page) => {
  if ((page.viewportSize()?.width ?? 0) < 768) await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  const content = page.locator('[data-sidebar="content"]:visible');
  await expect(content).toBeVisible();
  return content;
};

const closeSidebar = async (page: Page) => {
  if ((page.viewportSize()?.width ?? 0) < 768) await page.keyboard.press("Escape");
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.addInitScript(() => {
    window.__qaReads = [];
    window.__qaProjectRule = () => window.__qaProjectRuleValue ?? {};
  });
});

test("Suche und Ansicht stehen in der URL und folgen Zurück und Vorwärts", async ({ page }) => {
  await open(page, "/bereiche?ansicht=unbekannt&q=");
  await expect(views(page).getByRole("link", { name: /Alle/ })).toHaveAttribute("aria-current", "page");
  await expect(search(page)).toHaveValue("");
  await expect(list(page).getByRole("listitem")).toHaveCount(7);
  await expect(main(page).getByText("7 geladene Bereiche")).toBeVisible();

  await search(page).fill("ops");
  await expect(page).toHaveURL(/\/bereiche\?q=ops$/);
  await expect(list(page).getByRole("listitem")).toHaveCount(1);
  await expect(main(page).getByText("1 von 7 geladenen Bereichen")).toBeVisible();

  await views(page).getByRole("link", { name: /Favoriten/ }).click();
  await expect(page).toHaveURL(/ansicht=favoriten/);
  await expect(views(page).getByRole("link", { name: /Favoriten/ })).toHaveAttribute("aria-current", "page");

  await page.goBack();
  await expect(page).toHaveURL(/\/bereiche\?q=ops$/);
  await expect(search(page)).toHaveValue("ops");
  await page.goForward();
  await expect(page).toHaveURL(/ansicht=favoriten/);

  await list(page).getByRole("link", { name: /Betrieb/ }).click();
  await expect(page).toHaveURL(/\/bereiche\/OPS$/);
  await page.goBack();
  await expect(search(page)).toHaveValue("ops");
  await expect(views(page).getByRole("link", { name: /Favoriten/ })).toHaveAttribute("aria-current", "page");

  await search(page).fill("zzz");
  await expect(main(page).getByText("Keine Treffer", { exact: true })).toBeVisible();
  await main(page).getByRole("button", { name: "Suche zurücksetzen" }).click();
  await expect(search(page)).toHaveValue("");
  await expect(list(page).getByRole("listitem")).toHaveCount(1);

  const reads = await page.evaluate(() => window.__qaReads ?? []);
  expect(reads.filter((path) => path.startsWith("/board"))).toEqual([]);
});

test("Favoriten bleiben mit der Seitenleiste synchron, ohne die Sichtbarkeit zu ändern", async ({ page }) => {
  await open(page);
  const row = list(page).getByRole("listitem").filter({ hasText: "Mobile App" });
  const star = row.getByRole("button", { name: "Mobile App favorisieren" });
  await star.hover();
  await expect(page.getByText("Favorisieren", { exact: true })).toBeVisible();
  await star.click();
  await expect(row.getByRole("button", { name: "Mobile App aus Favoriten entfernen" })).toHaveAttribute("aria-pressed", "true");
  await expect(views(page).getByRole("link", { name: /Favoriten/ })).toContainText("2");

  const bar = await sidebar(page);
  const favorites = bar.locator('[data-sidebar="group"]').filter({ hasText: "Favoriten" });
  await expect(favorites.getByRole("link", { name: /Mobile App/ })).toBeVisible();
  await favorites.getByRole("link", { name: /Betrieb/ }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Aus Favoriten entfernen" }).click();
  await closeSidebar(page);
  await expect(list(page).getByRole("button", { name: "Betrieb favorisieren" })).toHaveAttribute("aria-pressed", "false");
  expect(await prefs(page)).toEqual({ projectIds: ["4"], hiddenProjectIds: ["3"] });
});

test("Versteckte Bereiche sind auffindbar, gekennzeichnet und öffnen den Bereich", async ({ page }) => {
  await open(page);
  const bar = await sidebar(page);
  await expect(bar.getByRole("link", { name: "Archiv 2024" })).toHaveCount(0);
  await closeSidebar(page);

  await search(page).fill("arch");
  const row = list(page).getByRole("listitem").filter({ hasText: "Archiv 2024" });
  await expect(row.getByText("Nicht in Seitenleiste")).toBeVisible();
  await row.getByRole("button", { name: "Archiv 2024 favorisieren" }).click();
  await row.getByRole("link", { name: /Archiv 2024/ }).click();
  await expect(page).toHaveURL(/\/bereiche\/OLD$/);
  await expect(main(page).getByRole("heading", { name: "Archiv 2024" })).toBeVisible();
  expect(await prefs(page)).toEqual({ projectIds: ["2", "3"], hiddenProjectIds: ["3"] });
});

test("Ladefehler bietet Retry, eine fehlgeschlagene Aktualisierung behält die Liste", async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    window.__qaProjectRuleValue = { status: 403 };
  });
  await open(page);
  const failed = main(page).getByRole("alert").filter({ hasText: "Bereiche konnten nicht geladen werden" });
  await expect(failed).toContainText("Test: Jira antwortet mit 403");
  await setRule(page, {});
  await failed.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(list(page).getByRole("listitem")).toHaveCount(7);

  await setRule(page, { status: 400 });
  await page.clock.setSystemTime(Date.now() + 31_000);
  await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
  const refresh = main(page).getByRole("alert").filter({ hasText: "Aktualisierung fehlgeschlagen" });
  await expect(refresh).toBeVisible();
  await expect(list(page).getByRole("listitem")).toHaveCount(7);
  if (shots) {
    await page.mouse.move(0, 0);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${shots}/aktualisierung-${test.info().project.name}.png` });
  }

  await setRule(page, {});
  await refresh.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(refresh).toHaveCount(0);
  await expect(list(page).getByRole("listitem")).toHaveCount(7);
});

test("Abmelden und Kontowechsel zeigen keine Bereiche des vorherigen Kontos", async ({ page }) => {
  await open(page);
  await expect(list(page).getByRole("listitem")).toHaveCount(7);
  await page.keyboard.press("Control+k");
  await page.keyboard.type("Abmelden");
  await page.keyboard.press("Enter");
  await expect(main(page).getByText("Melde dich an, um deine Bereiche zu sehen.")).toBeVisible();
  await expect(page.getByText("Betrieb")).toHaveCount(0);
  await expect(page.getByText("Produktentwicklung")).toHaveCount(0);

  await page.addInitScript(() => {
    window.__qaProjectRuleValue = {
      values: [{ id: "20", key: "FIN", name: "Finanzen", projectTypeKey: "business", avatarUrls: { "48x48": "/logo.svg" } }],
    };
  });
  await open(page);
  await expect(list(page).getByRole("listitem")).toHaveCount(1);
  await expect(list(page)).toContainText("Finanzen");
  await expect(views(page).getByRole("link", { name: /Favoriten/ })).toContainText("0");
  await views(page).getByRole("link", { name: /Favoriten/ }).click();
  await expect(main(page).getByText("Noch keine Favoriten")).toBeVisible();
  await expect(page.getByText("Betrieb")).toHaveCount(0);
});

test("Command Palette und Tastatur führen zur Übersicht und in einen Bereich", async ({ page }) => {
  await open(page, "/");
  await expect(main(page).getByRole("heading", { level: 1 })).toBeVisible();
  await page.keyboard.press("Control+k");
  await page.keyboard.type("Alle Bereiche");
  await expect(page.getByRole("option", { name: /Alle Bereiche/ })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/bereiche$/);

  await search(page).focus();
  await page.keyboard.type("daten");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(list(page).getByRole("link", { name: /Datenplattform/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/bereiche\/DATA$/);

  if ((page.viewportSize()?.width ?? 0) >= 768) {
    const action = (await sidebar(page)).getByRole("link", { name: "Alle Bereiche" });
    const box = await action.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(32);
    await action.click();
    await expect(page).toHaveURL(/\/bereiche$/);
  }
});

test("Darstellung: Desktop hell und 390 px dunkel ohne Seitenüberlauf", async ({ page }, info) => {
  const narrow = info.project.name !== "desktop";
  if (narrow) await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await expect(list(page).getByRole("listitem")).toHaveCount(7);
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      loaded: [...document.fonts].some((face) => face.family.includes("Geist") && face.status === "loaded"),
      family: getComputedStyle(document.querySelector("main h1")!).fontFamily,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      dark: document.documentElement.classList.contains("dark"),
    };
  });
  expect(fonts.loaded).toBe(true);
  expect(fonts.family).toContain("Geist");
  expect(fonts.overflow).toBeLessThanOrEqual(0);
  expect(fonts.dark).toBe(narrow);
  await page.mouse.move(0, 0);
  if (shots) await page.screenshot({ path: `${shots}/${narrow ? "390-dunkel" : "desktop-hell"}.png` });
});
