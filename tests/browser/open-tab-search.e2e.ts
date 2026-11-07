import { expect, test, type Page } from "@playwright/test";

const shots = process.env.OPEN_TAB_SEARCH_SHOTS;
const ORDER = ["DEMO-2", "DEMO-1", ...Array.from({ length: 10 }, (_, index) => `DEMO-${index + 3}`)];

const openBusy = async (page: Page, width = 1440, height = 900, route = "/issue/DEMO-1") => {
  await page.setViewportSize({ width, height });
  await page.goto(`/tests/browser/fixture.html?${new URLSearchParams({ scenario: "busy", route })}`);
  await expect(page.locator("header").first().getByRole("button", { name: "Suchen" })).toBeVisible();
};

const dialog = (page: Page) => page.getByRole("dialog", { name: "Geöffnete Tickets" });
const field = (page: Page) => dialog(page).getByRole("combobox", { name: "Geöffnete Tickets durchsuchen" });
const options = (page: Page) => dialog(page).getByRole("option");
const option = (page: Page, key: string) => dialog(page).getByRole("option", { name: new RegExp(`^${key} `) });
const more = (page: Page) =>
  page.getByRole("navigation", { name: "Werkzeuge" }).getByRole("button", { name: "Weitere Aktionen" });
const optionKeys = async (page: Page) =>
  (await options(page).allTextContents()).map((text) => text.match(/^DEMO-\d+/)?.[0]);
const reads = (page: Page) =>
  page.evaluate(() => {
    const qa = (window as unknown as { __qa: { issueReads: string[]; searches: string[] } }).__qa;
    return { issues: qa.issueReads.length, searches: qa.searches.length };
  });
const storedTabs = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("betterjira-issue-tabs") ?? "{}").state);

const shoot = async (page: Page, name: string) => {
  if (!shots) return;
  await expect
    .poll(() => page.evaluate(async () => (await document.fonts.ready, document.fonts.check("14px 'Geist Variable'"))))
    .toBe(true);
  await expect
    .poll(() => options(page).evaluateAll((items) => items.every((item) => getComputedStyle(item).opacity === "1")))
    .toBe(true);
  await page.screenshot({ path: `${shots}/${name}.png` });
};

const openFromMenu = async (page: Page) => {
  await more(page).click();
  await page.getByRole("menuitem", { name: "Geöffnete Tickets durchsuchen" }).click();
  await expect(dialog(page)).toBeVisible();
};

const openFromPalette = async (page: Page) => {
  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await palette.getByRole("combobox").fill("Geöffnete Tickets durchsuchen");
  await palette.getByRole("option", { name: /Geöffnete Tickets durchsuchen/ }).click();
  await expect(dialog(page)).toBeVisible();
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("Palette gibt beim Schließen der Tab-Suche den Fokus an Suchen zurück", async ({ page }, info) => {
  const narrow = info.project.name !== "desktop";
  await openBusy(page, narrow ? 390 : 1440, narrow ? 844 : 900);
  await openFromPalette(page);
  await expect(field(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.locator("header").first().getByRole("button", { name: "Suchen", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
});

test("Suche leeren per Tastatur wählt keinen markierten Tab aus", async ({ page }, info) => {
  const narrow = info.project.name !== "desktop";
  await openBusy(page, narrow ? 390 : 1440, narrow ? 844 : 900);
  await openFromPalette(page);
  await field(page).fill("DEMO-5");
  await expect(options(page)).toHaveCount(1);
  await page.keyboard.press("Tab");
  await expect(dialog(page).getByRole("button", { name: "Suche leeren" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(field(page)).toHaveValue("");
  await expect(options(page)).toHaveCount(12);
  await expect(page).toHaveURL(/\/issue\/DEMO-1$/);
});

test("Weitere Aktionen öffnet die Suche mit allen Tabs in ihrer Reihenfolge", async ({ page }) => {
  await openBusy(page, 390, 844);
  await openFromMenu(page);
  await expect(field(page)).toBeFocused();
  await expect(field(page)).toHaveValue("");
  await expect(options(page)).toHaveCount(12);
  expect(await optionKeys(page)).toEqual(ORDER);
  await expect(option(page, "DEMO-1")).toHaveAttribute("aria-current", "page");
  await expect(option(page, "DEMO-1")).toContainText("Aktuell");
  await expect(option(page, "DEMO-2")).toHaveAccessibleName(/angeheftet/);
  await expect(option(page, "DEMO-3")).not.toHaveAccessibleName(/angeheftet/);

  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  await expect(more(page)).toBeFocused();
  await expect(page).toHaveURL(/\/issue\/DEMO-1$/);
});

test("Suche nach Schlüssel und Titel fragt Jira nicht erneut ab", async ({ page }) => {
  await openBusy(page);
  await openFromPalette(page);
  await expect(option(page, "DEMO-3")).toContainText("Übergabe an das Team vorbereiten");
  for (const key of ORDER) await expect(option(page, key)).not.toContainText("Titel nicht geladen");
  const before = await reads(page);

  await field(page).fill("demo-1");
  expect(await optionKeys(page)).toEqual(["DEMO-1", "DEMO-10", "DEMO-11", "DEMO-12"]);
  await field(page).fill("Übergabe");
  expect(await optionKeys(page)).toEqual(["DEMO-3", "DEMO-6", "DEMO-9", "DEMO-12"]);
  await field(page).fill("übergabe teil 9");
  expect(await optionKeys(page)).toEqual(["DEMO-9"]);

  await field(page).fill("Nichts Passendes");
  await expect(options(page)).toHaveCount(0);
  await expect(dialog(page).getByText("Kein geöffnetes Ticket passt zu „Nichts Passendes“.")).toBeVisible();
  await shoot(page, `kein-treffer-${test.info().project.name}`);
  await dialog(page).getByRole("button", { name: "Suche zurücksetzen" }).click();
  await expect(field(page)).toHaveValue("");
  await expect(field(page)).toBeFocused();
  await expect(options(page)).toHaveCount(12);

  expect(await reads(page)).toEqual(before);
});

test("Tastatur und Maus wechseln den Tab und Entwürfe bleiben erhalten", async ({ page }) => {
  await openBusy(page);
  const comment = page.getByRole("textbox", { name: "Kommentar" });
  await comment.fill("QA-Entwurf aus der Tab-Suche");
  const tabsBefore = await storedTabs(page);

  await openFromPalette(page);
  await field(page).fill("teil 5");
  expect(await optionKeys(page)).toEqual(["DEMO-5"]);
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toBeHidden();
  await expect(page).toHaveURL(/\/issue\/DEMO-5$/);

  await openFromPalette(page);
  await expect(option(page, "DEMO-5")).toHaveAttribute("aria-current", "page");
  await field(page).fill("übergabe");
  await expect(option(page, "DEMO-3")).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowDown");
  await expect(option(page, "DEMO-6")).toHaveAttribute("aria-selected", "true");
  await expect(field(page)).toHaveAttribute("aria-activedescendant", (await option(page, "DEMO-6").getAttribute("id"))!);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/issue\/DEMO-6$/);

  await openFromPalette(page);
  await option(page, "DEMO-1").click();
  await expect(dialog(page)).toBeHidden();
  await expect(page).toHaveURL(/\/issue\/DEMO-1$/);
  await expect(comment).toHaveValue("QA-Entwurf aus der Tab-Suche");
  expect(await storedTabs(page)).toEqual(tabsBefore);
});

test("Tabs ohne bekannten Titel sind nur über den Schlüssel auffindbar", async ({ page }) => {
  await page.addInitScript(() => {
    const keys = ["DEMO-1", "DEMO-404", "DEMO-3"];
    const scope = JSON.stringify(["qa-cloud", "qa-user"]);
    localStorage.setItem("betterjira-issue-tabs", JSON.stringify({ state: { workspaces: { [scope]: { keys, pinned: [] } } }, version: 0 }));
  });
  await openBusy(page);
  await openFromPalette(page);
  await expect(options(page)).toHaveCount(3);
  await expect(option(page, "DEMO-404")).toContainText("Titel nicht geladen");
  await field(page).fill("nicht geladen");
  await expect(options(page)).toHaveCount(0);
  await field(page).fill("404");
  expect(await optionKeys(page)).toEqual(["DEMO-404"]);
});

test("Wiederöffnen startet leer; 390 px dunkel und reduziert bleibt im Fenster", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await openBusy(page, 390, 520);
  await openFromMenu(page);
  await field(page).fill("teil");
  await expect(options(page)).toHaveCount(9);
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();

  await openFromMenu(page);
  await expect(field(page)).toHaveValue("");
  await expect(options(page)).toHaveCount(12);
  expect(await dialog(page).evaluate((element) => getComputedStyle(element).animationName)).toBe("none");

  const box = (await dialog(page).boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(520);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const list = dialog(page).getByRole("listbox", { name: "Geöffnete Tickets" });
  expect(await list.evaluate((element) => element.parentElement!.scrollHeight > element.parentElement!.clientHeight)).toBe(true);
  await shoot(page, `390-dunkel-${test.info().project.name}`);

  for (let step = 0; step < 11; step++) await page.keyboard.press("ArrowDown");
  await expect(option(page, "DEMO-12")).toHaveAttribute("aria-selected", "true");
  await expect(option(page, "DEMO-12")).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/issue\/DEMO-12$/);
  await expect(more(page)).toBeFocused();
});

test("Desktop-Ansicht", async ({ page }) => {
  await openBusy(page);
  await openFromPalette(page);
  await field(page).fill("demo-1");
  await expect(options(page)).toHaveCount(4);
  await expect(option(page, "DEMO-1")).toContainText("Aktuell");
  await shoot(page, `desktop-${test.info().project.name}`);
});

test("Abmelden bietet keine Tab-Suche und löst keine Ticketabfrage aus", async ({ page }) => {
  await openBusy(page, 1440, 900, "/arbeitsplatz");

  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await palette.getByRole("combobox").fill("Abmelden");
  await palette.getByRole("option", { name: /Abmelden/ }).click();
  await expect(page.getByRole("main").getByText("Nicht angemeldet", { exact: true })).toBeVisible();
  const before = await reads(page);

  await page.keyboard.press("Control+k");
  await expect(palette).toBeVisible();
  await expect(palette.getByRole("option", { name: /Geöffnete Tickets durchsuchen/ })).toHaveCount(0);
  await expect(page.getByRole("tablist", { name: "Geöffnete Tickets" }).getByRole("tab")).toHaveCount(0);
  await page.keyboard.press("Escape");
  expect(await reads(page)).toEqual(before);
  expect(await storedTabs(page)).toMatchObject({ workspaces: { [JSON.stringify(["qa-cloud", "qa-user"])]: { pinned: ["DEMO-2"] } } });
});
