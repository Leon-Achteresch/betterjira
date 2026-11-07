import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

declare global {
  interface Window {
    __qaCopied: string[];
    __qa: { searches: string[] };
  }
}

const TABLE = "/tests/browser/fixture.html?route=/bereiche/DEMO";

const viewTrigger = (page: Page) => page.getByRole("button", { name: "Ansicht und Export" });
const filterTrigger = (page: Page) => page.locator("button[aria-haspopup=menu]").filter({ hasText: /^Filter/ });
const item = (page: Page, name: string) => page.getByRole("menuitem", { name, exact: true });
const submenu = (page: Page) => page.locator("[data-slot=dropdown-menu-sub-content]");
const copied = (page: Page) => page.evaluate(() => window.__qaCopied.at(-1));

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  const dir = process.env.DROPDOWN_SUBMENU_SHOTS;
  if (dir) {
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.fonts.check('14px "Geist Variable"'))).toBe(true);
    await page.screenshot({ path: `${dir}/${testInfo.project.name}-${name}.png` });
  }
};

const expectReachable = async (page: Page, items: Locator) => {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Kein Viewport");
  await expect(async () => {
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
    for (let index = 0; index < count; index++) {
      const target = items.nth(index);
      const box = await target.boundingBox();
      if (!box) throw new Error(`Eintrag ${index} ohne Fläche`);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
      const hit = await target.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const probes = [
          [rect.left + 4, rect.top + rect.height / 2],
          [rect.left + rect.width / 2, rect.top + rect.height / 2],
          [rect.right - 4, rect.top + rect.height / 2],
        ];
        return probes.every(([x, y]) => element.contains(document.elementFromPoint(x, y)));
      });
      expect(hit, `Eintrag ${index} ist verdeckt oder abgeschnitten`).toBe(true);
    }
  }).toPass({ timeout: 3000 });
};

const glide = async (page: Page, target: Locator) => {
  const box = await target.boundingBox();
  if (!box) throw new Error("Ziel ohne Fläche");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
};

const openCopyMenuWithMouse = async (page: Page) => {
  await viewTrigger(page).click();
  await glide(page, item(page, "Kopieren als"));
  await expect(submenu(page)).toBeVisible();
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.addInitScript(() => {
    window.__qaCopied = [];
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: async (text: string) => void window.__qaCopied.push(text) },
    });
  });
});

for (const narrow of [false, true]) {
  test.describe(narrow ? "390 px" : "Projektbreite", () => {
    test.beforeEach(async ({ page }) => {
      if (narrow) await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(TABLE);
      await expect(page.getByRole("cell", { name: "DEMO-1", exact: true })).toBeVisible();
    });

    test("Kopieren als: Untermenü vollständig sichtbar, Mausklick kopiert", async ({ page }, testInfo) => {
      await openCopyMenuWithMouse(page);
      await expectReachable(page, submenu(page).getByRole("menuitem"));
      await shot(page, testInfo, `${narrow ? "390" : "breit"}-kopieren-als`);

      await glide(page, item(page, "Markdown"));
      await expect(item(page, "Markdown")).toBeFocused();
      await item(page, "Markdown").click();
      await expect(submenu(page)).toHaveCount(0);
      await expect.poll(() => copied(page)).toMatch(/^\| .+ \|\n\| --- \|/);
      await expect(page.getByText("Zeilen kopiert")).toBeVisible();
    });

    test("Mauswechsel zwischen Haupt- und Untermenü", async ({ page }) => {
      await openCopyMenuWithMouse(page);
      await glide(page, page.getByRole("menuitemcheckbox", { name: "Kompakte Zeilen" }));
      await expect(submenu(page)).toHaveCount(0);
      await glide(page, item(page, "Kopieren als"));
      await expect(submenu(page)).toBeVisible();
      await glide(page, item(page, "JQL"));
      await expect(item(page, "JQL")).toBeFocused();
      await page.mouse.down();
      await page.mouse.up();
      await expect.poll(() => copied(page)).toContain('project = "DEMO"');
      await expect(page.getByRole("menu")).toHaveCount(0);
    });

    test("Tastatur: Pfeiltasten, Enter, Escape und Fokusrückgabe", async ({ page }) => {
      await viewTrigger(page).focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("menuitemcheckbox", { name: "Kompakte Zeilen" })).toBeFocused();
      await page.keyboard.press("ArrowDown");
      await expect(item(page, "Kopieren als")).toBeFocused();
      await page.keyboard.press("ArrowRight");
      await expect(item(page, "Tabelle (Excel, Numbers)")).toBeFocused();
      await expectReachable(page, submenu(page).getByRole("menuitem"));
      await page.keyboard.press("ArrowDown");
      await expect(item(page, "Markdown")).toBeFocused();
      await page.keyboard.press("ArrowLeft");
      await expect(submenu(page)).toHaveCount(0);
      await expect(item(page, "Kopieren als")).toBeFocused();

      await page.keyboard.press("ArrowRight");
      await expect(item(page, "Tabelle (Excel, Numbers)")).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("menu")).toHaveCount(0);
      await expect(viewTrigger(page)).toBeFocused();
      expect(await copied(page)).toMatch(/^[^\n]+\t[^\n]+\nDEMO-/);

      await page.keyboard.press("Enter");
      await expect(page.getByRole("menuitemcheckbox", { name: "Kompakte Zeilen" })).toBeFocused();
      await page.keyboard.press("ArrowDown");
      await expect(item(page, "Kopieren als")).toBeFocused();
      await page.keyboard.press("ArrowRight");
      await expect(item(page, "Tabelle (Excel, Numbers)")).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("menu")).toHaveCount(0);
      await expect(viewTrigger(page)).toBeFocused();
    });

    test("Filter: Status-Untermenü erreichbar, Auswahl filtert die Tabelle", async ({ page }, testInfo) => {
      await filterTrigger(page).click();
      await glide(page, item(page, "Status"));
      await expect(submenu(page)).toBeVisible();
      const options = submenu(page).getByRole("menuitemcheckbox");
      await expectReachable(page, options);
      await shot(page, testInfo, `${narrow ? "390" : "breit"}-filter-status`);

      const first = options.first();
      const label = (await first.innerText()).trim();
      await glide(page, first);
      await expect(first).toBeFocused();
      await first.click();
      await expect(first).toHaveAttribute("aria-checked", "true");
      await expect(submenu(page)).toBeVisible();
      await expect
        .poll(() => page.evaluate((value) => window.__qa.searches.some((jql) => jql.includes(`status in ("${value}")`)), label))
        .toBe(true);

      await page.keyboard.press("Escape");
      await expect(page.getByRole("menu")).toHaveCount(0);
      await expect(filterTrigger(page)).toBeFocused();
    });
  });
}
