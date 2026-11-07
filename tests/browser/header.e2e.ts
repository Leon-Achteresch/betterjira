import { expect, test, type Page } from "@playwright/test";

const WIDTHS = [390, 760, 1024, 1440];

const openBusy = async (page: Page, width: number) => {
  await page.setViewportSize({ width, height: 800 });
  await page.goto("/tests/browser/fixture.html?scenario=busy");
  await expect(header(page).getByRole("button", { name: "Suchen" })).toBeVisible();
};

const header = (page: Page) => page.locator("header").first();
const tools = (page: Page) => page.getByRole("navigation", { name: "Werkzeuge" });
const issueTab = (page: Page, key: string) =>
  page.getByRole("tablist", { name: "Geöffnete Tickets" }).getByRole("tab", { name: new RegExp(`^${key}(?!\\d)`) });

const headerCollisions = (page: Page) =>
  page.evaluate(() => {
    const root = document.querySelector("header")!;
    const bounds = root.getBoundingClientRect();
    const visibleRect = (element: Element) => {
      let { left, right, top, bottom } = element.getBoundingClientRect();
      for (let parent = element.parentElement; parent && parent !== root; parent = parent.parentElement) {
        if (getComputedStyle(parent).overflowX === "visible") continue;
        const clip = parent.getBoundingClientRect();
        left = Math.max(left, clip.left);
        right = Math.min(right, clip.right);
      }
      return { left, right, top, bottom };
    };
    const name = (element: Element) => element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 24);
    const targets = [...root.querySelectorAll("button, a, [role=tab]")]
      .filter((element) => !element.closest("[role=tab]") || element.matches("[role=tab]"))
      .map((element) => ({ element, rect: visibleRect(element) }))
      .filter(({ rect }) => rect.right - rect.left > 1 && rect.bottom - rect.top > 1);
    const problems: string[] = [];
    for (const [index, a] of targets.entries()) {
      if (a.rect.left < bounds.left - 1 || a.rect.right > bounds.right + 1) problems.push(`${name(a.element)} außerhalb`);
      for (const b of targets.slice(index + 1)) {
        if (a.element.contains(b.element) || b.element.contains(a.element)) continue;
        const x = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
        const y = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
        if (x > 1 && y > 1) problems.push(`${name(a.element)} überdeckt ${name(b.element)}`);
      }
    }
    return problems;
  });

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

for (const width of WIDTHS) {
  test(`Kopfleiste ohne Überdeckung bei ${width} px`, async ({ page }) => {
    await openBusy(page, width);
    expect(await headerCollisions(page)).toEqual([]);
    await expect(tools(page).getByRole("link", { name: "Einstellungen" })).toBeVisible();
    await expect(tools(page).getByRole("button", { name: /^Benachrichtigungen/ })).toBeVisible();
    await expect(tools(page).getByRole("button", { name: "Weiterarbeiten" })).toBeVisible();
    if (width >= 640) {
      await expect(page.getByRole("tablist", { name: "Geöffnete Tickets" }).getByRole("tab")).toHaveCount(12);
      await expect(tools(page).getByRole("button", { name: /Design verwenden$/ })).toBeVisible();
    }
  });
}

test("Suche öffnet die Command Palette und findet Befehle", async ({ page }) => {
  for (const width of [390, 1440]) {
    await openBusy(page, width);
    await header(page).getByRole("button", { name: "Suchen" }).click();
    const palette = page.getByRole("dialog", { name: "Command palette" });
    await palette.getByRole("combobox").fill("Jira-Tickets");
    await expect(palette.getByRole("option", { name: /DEMO-1\b/ })).toHaveCount(0);
    await palette.getByRole("option", { name: /Jira-Tickets/ }).click();
    await expect(page).toHaveURL(/\/tickets$/);
  }
});

test("Einstellungen bleiben bei 390 px in der Kopfleiste erreichbar", async ({ page }) => {
  await openBusy(page, 390);
  await tools(page).getByRole("link", { name: "Einstellungen" }).click();
  await expect(page).toHaveURL(/\/settings\/darstellung$/);
});

test("Weitere Aktionen ersetzen Zurück, Vorwärts und Design bei 390 px", async ({ page }) => {
  await openBusy(page, 390);
  await expect(header(page).getByRole("button", { name: "Zurück" })).toBeHidden();
  await page.keyboard.press("g");
  await page.keyboard.press("t");
  await expect(page).toHaveURL(/\/tickets$/);

  const more = tools(page).getByRole("button", { name: "Weitere Aktionen" });
  await more.click();
  await page.getByRole("menuitem", { name: /Zurück/ }).click();
  await expect(page).toHaveURL(/\/issue\/DEMO-1$/);
  await more.click();
  await page.getByRole("menuitem", { name: /Vorwärts/ }).click();
  await expect(page).toHaveURL(/\/tickets$/);

  await more.click();
  const theme = page.getByRole("menuitem", { name: /Design verwenden$/ });
  const before = await theme.textContent();
  await theme.click();
  await more.click();
  await expect(page.getByRole("menuitem", { name: /Design verwenden$/ })).not.toHaveText(before ?? "");
  await page.keyboard.press("Escape");
});

test("Weitere Aktionen verwalten geöffnete Tickets bei 390 px ohne Tastenkürzel", async ({ page }) => {
  await openBusy(page, 390);
  const more = tools(page).getByRole("button", { name: "Weitere Aktionen" });
  const ticket = (key: string) => page.getByRole("menuitemradio", { name: new RegExp(`^${key} `) });

  await more.click();
  await expect(page.getByRole("group", { name: "Geöffnete Tickets" }).getByRole("menuitemradio")).toHaveCount(12);
  await expect(ticket("DEMO-1")).toHaveAttribute("aria-checked", "true");
  await expect(ticket("DEMO-2")).toHaveAccessibleName(/angeheftet/);
  await ticket("DEMO-3").click();
  await expect(page).toHaveURL(/\/issue\/DEMO-3$/);

  await more.click();
  await expect(ticket("DEMO-3")).toHaveAttribute("aria-checked", "true");
  await page.getByRole("menuitem", { name: "DEMO-3 anheften" }).click();
  await more.click();
  await expect(ticket("DEMO-3")).toHaveAccessibleName(/angeheftet/);
  await expect(page.getByRole("menuitem", { name: "Angeheftet, zum Schließen lösen" })).toBeDisabled();
  await page.getByRole("menuitem", { name: "DEMO-3 lösen" }).click();

  await more.click();
  await expect(ticket("DEMO-3")).not.toHaveAccessibleName(/angeheftet/);
  await page.getByRole("menuitem", { name: /^DEMO-3 schließen/ }).click();
  await expect(page).toHaveURL(/\/issue\/DEMO-4$/);
  await more.click();
  await expect(page.getByRole("menuitemradio")).toHaveCount(11);
  await expect(ticket("DEMO-3")).toHaveCount(0);
  await expect(ticket("DEMO-4")).toHaveAttribute("aria-checked", "true");
  await page.keyboard.press("Escape");

  await header(page).getByRole("link", { name: "betterjira" }).click();
  await expect(page).not.toHaveURL(/\/issue\//);
  await more.click();
  await expect(page.getByRole("menuitemradio", { checked: true })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: /anheften|lösen|schließen/ })).toHaveCount(0);
  await ticket("DEMO-5").click();
  await expect(page).toHaveURL(/\/issue\/DEMO-5$/);
});

test("Geöffnete Tickets im Menü sind per Tastatur bedienbar", async ({ page }) => {
  await openBusy(page, 390);
  const more = tools(page).getByRole("button", { name: "Weitere Aktionen" });
  const menuItems = page.getByRole("menu").locator('[role^="menuitem"]:not([aria-disabled="true"])');
  await more.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(menuItems.first()).toBeFocused();
  if (await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)) {
    expect(await page.getByRole("menu").evaluate((menu) => getComputedStyle(menu).animationName)).toBe("none");
  }
  const focusedText = () => page.evaluate(() => document.activeElement?.textContent ?? "");
  for (let step = 0; step < 20; step++) {
    const name = await focusedText();
    if (name.startsWith("DEMO-6")) break;
    await page.keyboard.press("ArrowDown");
    await expect.poll(focusedText).not.toBe(name);
  }
  await expect(page.getByRole("menuitemradio", { name: /^DEMO-6 / })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/issue\/DEMO-6$/);
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(more).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(menuItems.first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  await expect(more).toBeFocused();
});

test("Seitenleiste lässt sich aus der Kopfleiste öffnen und schließen", async ({ page }) => {
  for (const width of [390, 1440]) {
    await openBusy(page, width);
    const nav = page.getByRole("navigation", { name: "Hauptnavigation" });
    const toggle = header(page).getByRole("button", { name: "Toggle Sidebar" });
    if (width < 768) {
      await toggle.click();
      await expect(nav).toBeVisible();
      await nav.getByRole("link", { name: "Jira-Tickets" }).click();
      await expect(page).toHaveURL(/\/tickets$/);
      await expect(nav).toBeHidden();
    } else {
      await expect(nav).toBeVisible();
      await toggle.click();
      await expect(page.locator("[data-slot=sidebar][data-state=collapsed]")).toHaveCount(1);
      await toggle.click();
      await expect(page.locator("[data-slot=sidebar][data-state=expanded]")).toHaveCount(1);
    }
  }
});

test("Tastatur erreicht alle Kopfleisten-Aktionen mit sichtbarem Fokus", async ({ page }) => {
  for (const width of [390, 760]) {
    await openBusy(page, width);
    await page.keyboard.press("Control+k");
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeHidden();

    const reached = new Set<string>();
    await header(page).getByRole("button", { name: "Toggle Sidebar" }).focus();
    for (let step = 0; step < 60; step++) {
      const focused = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        if (!element?.closest("header")) return null;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return {
          name: element.getAttribute("aria-label") ?? element.textContent?.trim() ?? "",
          ring: style.outlineStyle !== "none" || style.boxShadow !== "none",
          visible: rect.width > 0 && rect.height > 0,
        };
      });
      if (focused) {
        expect(focused.visible, `${focused.name} fokussiert, aber unsichtbar`).toBe(true);
        expect(focused.ring, `${focused.name} ohne sichtbaren Fokus`).toBe(true);
        reached.add(focused.name);
        if (focused.name === "Minimieren") break;
      }
      await page.keyboard.press("Tab");
    }
    for (const name of ["Suchen", "Weiterarbeiten", "Einstellungen"]) expect([...reached]).toContain(name);
    expect([...reached]).toContain(width < 640 ? "Weitere Aktionen" : "Vorwärts");
  }
});

test("Ticket-Tabs bleiben bei 390 px per Tastatur wechselbar", async ({ page }) => {
  await openBusy(page, 390);
  await expect(page).toHaveURL(/\/issue\/DEMO-1$/);
  await page.keyboard.press("Control+Tab");
  await expect(page).not.toHaveURL(/\/issue\/DEMO-1$/);
  await expect(page).toHaveURL(/\/issue\/DEMO-/);
});

test("Mittelklick schließt Ticket-Tab ohne neues Fenster", async ({ page }) => {
  await openBusy(page, 1440);
  const popups: string[] = [];
  page.context().on("page", (popup) => popups.push(popup.url()));

  await issueTab(page, "DEMO-8").click({ button: "middle" });
  await expect(issueTab(page, "DEMO-8")).toHaveCount(0);
  await issueTab(page, "DEMO-2").click({ button: "middle" });
  await page.waitForTimeout(300);
  await expect(issueTab(page, "DEMO-2")).toHaveCount(1);
  await expect(page).toHaveURL(/\/issue\/DEMO-1$/);
  expect(popups).toEqual([]);
});

test("Wechsel von Ticket zu Ticket öffnet einen Tab", async ({ page }) => {
  await openBusy(page, 1440);
  await expect(page).toHaveURL(/\/issue\/DEMO-1$/);
  await page.getByRole("button", { name: "DEMO-5 schließen" }).click({ force: true });
  await expect(issueTab(page, "DEMO-5")).toHaveCount(0);

  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await palette.getByRole("combobox").fill("DEMO-5");
  await palette.getByRole("option", { name: /DEMO-5(?!\d)/ }).first().click();
  await expect(page).toHaveURL(/\/issue\/DEMO-5$/);
  await expect(issueTab(page, "DEMO-5")).toHaveAttribute("aria-selected", "true");
});
