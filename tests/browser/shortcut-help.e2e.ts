import { expect, test, type Page, type TestInfo } from "@playwright/test";

const open = (page: Page, route: string) =>
  page.goto(`/tests/browser/fixture.html?${new URLSearchParams({ route })}`);

const dialog = (page: Page) => page.getByRole("dialog", { name: "Tastenkürzel" });
const searchBox = (page: Page) => dialog(page).getByRole("searchbox", { name: "Tastenkürzel durchsuchen" });
const rows = (page: Page) => dialog(page).locator("section > div > div");
const headings = (page: Page) => dialog(page).getByRole("heading", { level: 3 });

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  const dir = process.env.SHORTCUT_HELP_SHOTS;
  if (!dir) return;
  await page.evaluate(async () => {
    await document.fonts.ready;
    if (!document.fonts.check('16px "Geist Variable"')) throw new Error("Geist nicht geladen");
  });
  await page.screenshot({ path: `${dir}/${testInfo.project.name}-${name}.png` });
};

const openFromSettings = async (page: Page) => {
  await open(page, "/settings/darstellung");
  const trigger = page.getByRole("button", { name: "Übersicht öffnen" });
  await trigger.click();
  await expect(dialog(page)).toBeVisible();
  return trigger;
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("durchsucht Aktion, Bereich und Tasten und blendet leere Gruppen aus", async ({ page }, testInfo) => {
  await openFromSettings(page);
  await expect(searchBox(page)).toBeFocused();
  await expect(dialog(page).getByText("17 Tastenkürzel", { exact: true })).toBeVisible();
  await expect(headings(page)).toHaveCount(4);
  await shot(page, testInfo, "alle");

  await searchBox(page).fill("zurück");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("Zurück");
  await expect(headings(page)).toHaveText(["Navigation"]);
  await expect(dialog(page).getByText("1 von 17 Tastenkürzeln")).toBeVisible();

  await searchBox(page).fill("listen");
  await expect(headings(page)).toHaveText(["Listen"]);
  await expect(rows(page)).toHaveCount(3);

  await searchBox(page).fill("strg+k");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("Suchen und Befehle");

  await searchBox(page).fill("g h");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("Heute");
  await shot(page, testInfo, "treffer");

  await searchBox(page).fill("");
  await expect(rows(page)).toHaveCount(17);
});

test("zeigt keine Treffer verständlich an und setzt die Suche zurück", async ({ page }, testInfo) => {
  await openFromSettings(page);
  await searchBox(page).fill("xyz");
  await expect(dialog(page).getByText("Kein Tastenkürzel gefunden")).toBeVisible();
  await expect(dialog(page).getByText("0 von 17 Tastenkürzeln")).toBeVisible();
  await expect(headings(page)).toHaveCount(0);
  await shot(page, testInfo, "leer");

  await dialog(page).getByRole("button", { name: "Suche zurücksetzen" }).click();
  await expect(searchBox(page)).toHaveValue("");
  await expect(searchBox(page)).toBeFocused();
  await expect(rows(page)).toHaveCount(17);
});

test("Esc leert erst die Suche, schließt dann und gibt den Fokus zurück", async ({ page }) => {
  const trigger = await openFromSettings(page);
  await searchBox(page).fill("tab");
  await page.getByRole("heading", { name: "Tastenkürzel" }).click();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeVisible();
  await expect(searchBox(page)).toHaveValue("");

  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("öffnet ohne alte Suche, hält den Fokus im Dialog und ? bleibt erhalten", async ({ page }) => {
  const trigger = await openFromSettings(page);
  await searchBox(page).fill("navigation");
  await dialog(page).getByRole("button", { name: "Schließen" }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(trigger).toBeFocused();

  await page.keyboard.press("?");
  await expect(dialog(page)).toBeVisible();
  await expect(searchBox(page)).toHaveValue("");
  await expect(rows(page)).toHaveCount(17);

  await searchBox(page).fill("?");
  await expect(dialog(page)).toBeVisible();
  await expect(rows(page)).toHaveCount(1);

  for (let index = 0; index < 6; index++) {
    await page.keyboard.press("Tab");
    expect(await dialog(page).evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
});

test("bleibt auf kleinen Fenstern bedienbar und scrollt intern", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await openFromSettings(page);
  const box = await dialog(page).boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 390 && box.y >= 0 && box.y + box.height <= 640).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  const list = dialog(page).locator(".overflow-y-auto");
  expect(await list.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  await shot(page, testInfo, "schmal");
  await list.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  await expect(rows(page).last()).toBeInViewport();
  await expect(searchBox(page)).toBeInViewport();
  await expect(dialog(page).getByRole("button", { name: "Schließen" })).toBeInViewport();
  const close = await dialog(page).getByRole("button", { name: "Schließen" }).boundingBox();
  expect(Math.min(close?.width ?? 0, close?.height ?? 0)).toBeGreaterThanOrEqual(32);
});
