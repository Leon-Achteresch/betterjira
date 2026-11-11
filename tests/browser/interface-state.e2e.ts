import { expect, test, type Page } from "@playwright/test";

const openTable = async (page: Page, account = "qa-user") => {
  await page.goto(`/tests/browser/fixture.html?${new URLSearchParams({ route: "/bereiche/DEMO", account })}`);
  await expect(page.getByRole("searchbox", { name: "Volltextsuche" })).toBeVisible();
};

const showSidebar = async (page: Page) => {
  if ((page.viewportSize()?.width ?? 0) < 768) await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  const content = page.locator('[data-sidebar="content"]:visible');
  await expect(content).toBeVisible();
  return content;
};

test.beforeEach(({ page }) => {
  page.on("pageerror", (error) => { throw error; });
});

test("Suchtext, Schnellfilter und Zeilendichte bleiben erhalten und werden je Konto getrennt", async ({ page }) => {
  await openTable(page);
  const search = page.getByRole("searchbox", { name: "Volltextsuche" });
  await expect(page.getByRole("cell", { name: "DEMO-1", exact: true })).toBeVisible();
  await search.fill("Login");
  const mine = page.getByRole("button", { name: "Mir zugewiesen", exact: true });
  await mine.click();
  await expect(mine).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Ansicht und Export" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Kompakte Zeilen" }).click();
  await page.keyboard.press("Escape");

  await openTable(page);
  await expect(search).toHaveValue("Login");
  await expect(mine).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Ansicht und Export" }).click();
  await expect(page.getByRole("menuitemcheckbox", { name: "Kompakte Zeilen" })).toBeChecked();
  await page.keyboard.press("Escape");

  await openTable(page, "qa-colleague");
  await expect(search).toHaveValue("");
  await expect(mine).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Ansicht und Export" }).click();
  await expect(page.getByRole("menuitemcheckbox", { name: "Kompakte Zeilen" })).not.toBeChecked();
  await page.keyboard.press("Escape");

  await openTable(page);
  await expect(search).toHaveValue("Login");
  await expect(mine).toHaveAttribute("aria-pressed", "true");
});

test("geschlossene Sidebar-Gruppen werden wiederhergestellt und bleiben kontobezogen", async ({ page }) => {
  await openTable(page);
  let content = await showSidebar(page);
  const group = () => content.getByRole("button", { name: /^Bereiche/ });
  await expect(group()).toHaveAttribute("aria-expanded", "true");
  await group().click();
  await expect(group()).toHaveAttribute("aria-expanded", "false");

  await openTable(page);
  content = await showSidebar(page);
  await expect(group()).toHaveAttribute("aria-expanded", "false");

  await openTable(page, "qa-colleague");
  content = await showSidebar(page);
  await expect(group()).toHaveAttribute("aria-expanded", "true");
});

test("Desktop-Seitenleiste bleibt nach Neustart eingeklappt", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 768, "Mobile Overlays werden absichtlich geschlossen gestartet.");
  await openTable(page);
  const sidebar = page.locator('[data-slot="sidebar"][data-state]');
  await expect(sidebar).toHaveAttribute("data-state", "expanded");
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await expect(sidebar).toHaveAttribute("data-state", "collapsed");
  await openTable(page);
  await expect(sidebar).toHaveAttribute("data-state", "collapsed");
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await expect(sidebar).toHaveAttribute("data-state", "expanded");
});


test("eingeklappte Navigation bleibt aus der Tab-Reihenfolge und gibt Fokus zurück", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) < 768, "Desktop-Offcanvas");
  await openTable(page);
  const today = page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("link", { name: "Heute", exact: true });
  await today.focus();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+b" : "Control+b");
  const toggle = page.getByRole("button", { name: "Toggle Sidebar" });
  await expect(toggle).toBeFocused();
  await expect(page.locator('[data-slot="sidebar-container"]')).toHaveAttribute("inert", "");
  await openTable(page);
  await expect(page.locator('[data-slot="sidebar-container"]')).toHaveAttribute("inert", "");
  const more = page.getByRole("navigation", { name: "Werkzeuge" }).getByRole("button", { name: "Weitere Aktionen" });
  await more.click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => document.activeElement?.closest('[data-slot="sidebar-container"]') === null)).toBe(true);
});
