import { expect, test, type Page, type TestInfo } from "@playwright/test";

declare global {
  interface Window {
    __qaReads?: string[];
    __qa: { writes: Array<{ path: string }>; commands: string[]; delayMs: number };
  }
}

const ISSUE = (key: string) => `/tests/browser/fixture.html?scenario=attachment-sort&route=/issue/${key}`;

const ORDER = {
  original: ["Bericht 10.pdf", "bericht 2.pdf", "Screenshot.png", "Unbenannte Datei", "Anhang.txt"],
  name: ["Anhang.txt", "bericht 2.pdf", "Bericht 10.pdf", "Screenshot.png", "Unbenannte Datei"],
  newest: ["bericht 2.pdf", "Anhang.txt", "Bericht 10.pdf", "Unbenannte Datei", "Screenshot.png"],
  largest: ["Bericht 10.pdf", "Screenshot.png", "Unbenannte Datei", "Anhang.txt", "bericht 2.pdf"],
};

const LABEL = {
  original: "Ursprüngliche Reihenfolge",
  name: "Dateiname A–Z",
  newest: "Neueste zuerst",
  largest: "Größte zuerst",
};

const panel = (page: Page) => page.getByRole("dialog").getByRole("tabpanel");
const trigger = (page: Page) => panel(page).getByRole("combobox", { name: "Anhänge sortieren" });
const names = (page: Page) => panel(page).locator("ul > li span.truncate");

const openAttachments = async (page: Page) => {
  await page.getByRole("button", { name: "Weitere Ticketaktionen" }).click();
  await page.getByRole("menuitem", { name: /Anhänge/ }).click();
  await expect(panel(page)).toBeVisible();
};

const choose = async (page: Page, mode: keyof typeof LABEL) => {
  await trigger(page).click();
  await page.getByRole("option", { name: LABEL[mode] }).click();
  await expect(trigger(page)).toContainText(LABEL[mode]);
};

const traffic = (page: Page) =>
  page.evaluate(() => ({
    attachmentReads: (window.__qaReads ?? []).filter((path) => path.startsWith("/attachment/")),
    writes: window.__qa.writes.length,
    opened: window.__qa.commands.filter((command) => command.startsWith("plugin:opener")).length,
  }));

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  const dir = process.env.ATTACHMENT_SORT_SHOTS;
  if (!dir) return;
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check("12px 'Geist Variable'"))).toBe(true);
  await expect.poll(() => panel(page).locator("ul > li").evaluateAll(
    (items) => items.every((item) => getComputedStyle(item).transform === "none"),
  )).toBe(true);
  await page.screenshot({ path: `${dir}/${testInfo.project.name}-${name}.png` });
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.addInitScript(() => {
    window.__qaReads = [];
  });
});

test("sortiert je Modus, erhält Kacheln und lädt nichts nach", async ({ page }, testInfo) => {
  const downloads: string[] = [];
  page.on("download", (download) => downloads.push(download.suggestedFilename()));
  await page.goto(ISSUE("DEMO-1"));
  await openAttachments(page);
  await expect(trigger(page)).toContainText(LABEL.original);
  await expect(names(page)).toHaveText(ORDER.original);
  await expect(panel(page).locator("ul > li img")).toHaveCount(1);
  await shot(page, testInfo, "original");

  await panel(page)
    .locator("ul > li")
    .evaluateAll((items) => items.forEach((item, index) => item.setAttribute("data-qa-mark", String(index))));
  const before = await traffic(page);

  for (const mode of ["name", "newest", "largest", "original"] as const) {
    await choose(page, mode);
    await expect(names(page)).toHaveText(ORDER[mode]);
    if (testInfo.project.name.includes("reduced"))
      expect(await panel(page).locator("ul > li").evaluateAll((items) => items.map((item) => getComputedStyle(item).transform))).toEqual(
        Array(5).fill("none"),
      );
    if (mode === "newest") await shot(page, testInfo, "neueste");
  }

  expect(await panel(page).locator("ul > li[data-qa-mark]").count()).toBe(5);
  expect(await traffic(page)).toEqual(before);
  expect(downloads).toEqual([]);
});

test("bedienbar per Tastatur mit Fokusrückgabe", async ({ page }) => {
  await page.goto(ISSUE("DEMO-1"));
  await openAttachments(page);
  await trigger(page).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox")).toBeHidden();
  await expect(trigger(page)).toBeFocused();
  await expect(trigger(page)).toContainText(LABEL.name);
  await expect(names(page)).toHaveText(ORDER.name);
});

test("Vorschau zeigt den angeklickten Anhang auch nach dem Umsortieren", async ({ page }) => {
  await page.goto(ISSUE("DEMO-1"));
  await openAttachments(page);
  await choose(page, "largest");
  await panel(page).getByRole("button", { name: /Screenshot\.png/ }).click();
  const preview = page.getByRole("dialog", { name: "Screenshot.png" });
  await expect(preview).toBeVisible();
  await expect(preview.getByRole("img", { name: "Screenshot.png" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(preview).toBeHidden();
  await expect(trigger(page)).toContainText(LABEL.largest);
});

test("Upload läuft beim Sortieren weiter und neue Datei wird einsortiert", async ({ page }) => {
  await page.goto(ISSUE("DEMO-1"));
  await openAttachments(page);
  await page.evaluate(() => {
    window.__qa.delayMs = 1200;
  });
  await panel(page)
    .locator('input[type="file"]')
    .setInputFiles({ name: "neu.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
  const uploadButton = panel(page).getByRole("button", { name: "Datei anhängen" });
  await expect(uploadButton).toBeDisabled();
  await choose(page, "largest");
  await expect(uploadButton).toBeDisabled();
  await expect(names(page)).toHaveText([...ORDER.largest, "neu.txt"]);
  await expect(uploadButton).toBeEnabled();
  await expect(trigger(page)).toContainText(LABEL.largest);
  const writes = await page.evaluate(() => window.__qa.writes.filter((write) => write.path.endsWith("/attachments")).length);
  expect(writes).toBe(1);
});

test("setzt die Sortierung beim Ticketwechsel zurück", async ({ page }) => {
  await page.goto(ISSUE("DEMO-1"));
  await openAttachments(page);
  await choose(page, "name");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.locator('a[href="/issue/DEMO-2"]').first().click();
  await expect(page).toHaveURL(/\/issue\/DEMO-2$/);
  await openAttachments(page);
  await expect(trigger(page)).toContainText(LABEL.original);
  await expect(names(page)).toHaveText(["zeta.txt", "alpha.txt"]);
  await choose(page, "name");
  await expect(names(page)).toHaveText(["alpha.txt", "zeta.txt"]);
  await page.keyboard.press("Escape");

  await page.goBack();
  await expect(page).toHaveURL(/\/issue\/DEMO-1$/);
  await openAttachments(page);
  await expect(trigger(page)).toContainText(LABEL.original);
  await expect(names(page)).toHaveText(ORDER.original);
});

test("390 px: keine Überbreite, Ziele mindestens 32 px", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(ISSUE("DEMO-1"));
  await openAttachments(page);
  await expect.poll(async () => (await trigger(page).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(32);
  await trigger(page).click();
  for (const option of await page.getByRole("option").all())
    await expect.poll(async () => (await option.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(32);
  const listbox = await page.getByRole("listbox").boundingBox();
  expect((listbox?.x ?? -1) >= 0 && (listbox?.x ?? 0) + (listbox?.width ?? 0) <= 390).toBe(true);
  await shot(page, testInfo, "390-offen");
  await page.getByRole("option", { name: LABEL.newest }).click();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await shot(page, testInfo, "390");
});
