import { expect, test, type Page, type TestInfo } from "@playwright/test";

declare global {
  interface Window {
    __qa: { writes: unknown[]; searches: string[] };
  }
}

const TABLE = "/tests/browser/fixture.html?route=/bereiche/DEMO";
const DEFAULT_ORDER = ["Schlüssel", "Typ", "Zusammenfassung", "Status", "Bearbeiter", "Priorität", "Aktualisiert"];

const picker = (page: Page) => page.getByRole("dialog");
const trigger = (page: Page) => page.getByRole("button", { name: "Spalten", exact: true });
const moveUp = (page: Page, label: string) => picker(page).getByRole("button", { name: `${label} nach oben verschieben` });
const moveDown = (page: Page, label: string) => picker(page).getByRole("button", { name: `${label} nach unten verschieben` });
const activeRow = (page: Page, label: string) => picker(page).getByRole("listitem").filter({ hasText: label });
const moveActions = (page: Page, label: string) =>
  activeRow(page, label).locator("span", { has: page.getByRole("button", { name: `${label} nach oben verschieben` }) }).first();
const pickerOrder = (page: Page) => picker(page).getByRole("listitem").allTextContents();
const headerOrder = (page: Page) =>
  page.locator("thead th").evaluateAll((cells) => cells.map((cell) => cell.textContent?.trim() ?? "").filter(Boolean));
const storedColumns = (page: Page) =>
  page.evaluate(() => {
    const raw = window.localStorage.getItem("betterjira-issue-views");
    return raw ? (JSON.parse(raw).state?.views?.['project = "DEMO" ORDER BY updated DESC']?.columns ?? null) : null;
  });

const expectOrder = async (page: Page, labels: string[]) => {
  await expect.poll(() => pickerOrder(page)).toEqual(labels);
  await expect.poll(() => headerOrder(page)).toEqual(labels);
};

const openTable = async (page: Page) => {
  await page.goto(TABLE);
  await expect(page.getByRole("cell", { name: "DEMO-1", exact: true })).toBeVisible();
};

const openPicker = async (page: Page) => {
  await trigger(page).click();
  await expect(picker(page)).toBeVisible();
};

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  const dir = process.env.COLUMN_PICKER_SHOTS;
  if (!dir) return;
  const fontLoaded = await page.evaluate(async () => {
    await document.fonts.load('14px "Geist Variable"');
    await document.fonts.ready;
    await Promise.all(document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity).map((animation) => animation.finished.catch(() => undefined)));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return [...document.fonts].some((face) => face.family.includes("Geist") && face.status === "loaded");
  });
  expect(fontLoaded).toBe(true);
  await page.screenshot({ path: `${dir}/${testInfo.project.name}-${name}.png` });
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("Tastatur verschiebt Spalten, Fokus bleibt auf derselben Aktion, Escape kehrt zum Auslöser zurück", async ({ page }) => {
  await openTable(page);
  await openPicker(page);
  await expectOrder(page, DEFAULT_ORDER);

  await expect(moveUp(page, "Schlüssel")).toHaveAttribute("aria-disabled", "true");
  await expect(moveDown(page, "Aktualisiert")).toHaveAttribute("aria-disabled", "true");
  await expect(moveDown(page, "Schlüssel")).not.toHaveAttribute("aria-disabled", "true");

  const up = moveUp(page, "Zusammenfassung");
  await up.focus();
  await expect(up).toBeFocused();
  await page.keyboard.press("Enter");
  await expectOrder(page, ["Schlüssel", "Zusammenfassung", "Typ", "Status", "Bearbeiter", "Priorität", "Aktualisiert"]);
  await expect(up).toBeFocused();
  await page.keyboard.press("Enter");
  await expectOrder(page, ["Zusammenfassung", "Schlüssel", "Typ", "Status", "Bearbeiter", "Priorität", "Aktualisiert"]);
  await expect(up).toBeFocused();
  await expect(up).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Enter");
  await expectOrder(page, ["Zusammenfassung", "Schlüssel", "Typ", "Status", "Bearbeiter", "Priorität", "Aktualisiert"]);
  await expect(up).toBeFocused();

  await page.keyboard.press("Tab");
  const down = moveDown(page, "Zusammenfassung");
  await expect(down).toBeFocused();
  for (const expected of [
    ["Schlüssel", "Zusammenfassung", "Typ", "Status", "Bearbeiter", "Priorität", "Aktualisiert"],
    ["Schlüssel", "Typ", "Zusammenfassung", "Status", "Bearbeiter", "Priorität", "Aktualisiert"],
    ["Schlüssel", "Typ", "Status", "Zusammenfassung", "Bearbeiter", "Priorität", "Aktualisiert"],
  ]) {
    await page.keyboard.press("Space");
    await expectOrder(page, expected);
    await expect(down).toBeFocused();
  }
  await expect(moveActions(page, "Zusammenfassung")).toHaveCSS("opacity", "1");

  await page.keyboard.press("Escape");
  await expect(picker(page)).toHaveCount(0);
  await expect(trigger(page)).toBeFocused();
  expect(await storedColumns(page)).toEqual(["key", "issuetype", "status", "summary", "assignee", "priority", "updated"]);
  expect(await page.evaluate(() => window.__qa.writes)).toEqual([]);
});

test("Maus verschiebt Spalten, Reihenfolge bleibt nach Neuladen, Felder lassen sich weiter ändern", async ({ page }, testInfo) => {
  await openTable(page);
  await openPicker(page);

  const actions = moveActions(page, "Bearbeiter");
  await page.mouse.move(0, 0);
  await expect(actions).toHaveCSS("opacity", "0");
  await activeRow(page, "Bearbeiter").hover();
  await expect(actions).toHaveCSS("opacity", "1");
  await shot(page, testInfo, "hover");

  const up = moveUp(page, "Bearbeiter");
  await up.click();
  await expectOrder(page, ["Schlüssel", "Typ", "Zusammenfassung", "Bearbeiter", "Status", "Priorität", "Aktualisiert"]);
  await expect(up).toBeFocused();
  await up.click();
  const moved = ["Schlüssel", "Typ", "Bearbeiter", "Zusammenfassung", "Status", "Priorität", "Aktualisiert"];
  await expectOrder(page, moved);
  await expect(up).toBeFocused();

  const box = await up.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(32);
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(32);

  await openTable(page);
  await expect.poll(() => headerOrder(page)).toEqual(moved);
  await openPicker(page);
  await expect.poll(() => pickerOrder(page)).toEqual(moved);

  await picker(page).getByRole("button", { name: "Priorität ausblenden" }).click();
  const withoutPriority = moved.filter((label) => label !== "Priorität");
  await expectOrder(page, withoutPriority);

  await picker(page).getByPlaceholder("Feld hinzufügen…").fill("Priorität");
  const option = picker(page).getByRole("option", { name: "Priorität", exact: true });
  await expect(option).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expectOrder(page, [...withoutPriority, "Priorität"]);
  await expect(moveDown(page, "Priorität")).toHaveAttribute("aria-disabled", "true");
  await expect(moveDown(page, "Aktualisiert")).not.toHaveAttribute("aria-disabled", "true");

  expect(await page.evaluate(() => window.__qa.writes)).toEqual([]);
});

test("Ziehen am Griff sortiert weiterhin über denselben Pfad", async ({ page }) => {
  await openTable(page);
  await openPicker(page);

  const grip = activeRow(page, "Status").locator("span[aria-hidden]").first();
  const target = activeRow(page, "Typ");
  const from = await grip.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("Spaltenzeilen nicht sichtbar");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, to.y + 2, { steps: 12 });
  await page.mouse.up();

  await expect.poll(async () => (await pickerOrder(page)).indexOf("Status")).toBeLessThan(DEFAULT_ORDER.indexOf("Status"));
  const order = await pickerOrder(page);
  expect(new Set(order).size).toBe(DEFAULT_ORDER.length);
  await expect.poll(() => headerOrder(page)).toEqual(order);
  expect(await page.evaluate(() => window.__qa.writes)).toEqual([]);
});

test.describe("390 px, dunkel, reduzierte Bewegung", () => {
  test.use({ viewport: { width: 390, height: 844 }, colorScheme: "dark", reducedMotion: "reduce" });

  test("Picker bleibt ohne Seitenüberlauf mit großen Aktionen bedienbar", async ({ page }, testInfo) => {
    await openTable(page);
    await openPicker(page);
    await expect(picker(page)).toHaveCSS("animation-name", "none");
    const up = moveUp(page, "Status");
    await up.focus();
    await expect(up).toBeFocused();
    await page.keyboard.press("Enter");
    await expect.poll(() => pickerOrder(page)).toEqual(["Schlüssel", "Typ", "Status", "Zusammenfassung", "Bearbeiter", "Priorität", "Aktualisiert"]);
    await expect(up).toBeFocused();

    const state = await page.evaluate(async () => {
      await document.fonts.load('14px "Geist Variable"');
      await document.fonts.ready;
      const panel = document.querySelector('[role="dialog"]')?.getBoundingClientRect();
      return {
        dark: document.documentElement.classList.contains("dark") && matchMedia("(prefers-color-scheme: dark)").matches,
        font: [...document.fonts].some((face) => face.family.includes("Geist") && face.status === "loaded"),
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        left: panel?.left ?? -1,
        right: panel?.right ?? Number.POSITIVE_INFINITY,
      };
    });
    expect(state.dark).toBe(true);
    expect(state.font).toBe(true);
    expect(state.overflow).toBeLessThanOrEqual(0);
    expect(state.left).toBeGreaterThanOrEqual(0);
    expect(state.right).toBeLessThanOrEqual(390);
    const box = await up.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(32);
    await expect(moveActions(page, "Status")).toHaveCSS("opacity", "1");
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await shot(page, testInfo, "390-dunkel");
    expect(await page.evaluate(() => window.__qa.writes)).toEqual([]);
  });
});
