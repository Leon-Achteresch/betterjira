import { expect, test, type Page } from "@playwright/test";

const TICKET = (key: string) => `/tests/browser/fixture.html?scenario=comments&route=/issue/${key}`;
const shots = process.env.COMMENT_SEARCH_SHOTS;

const open = async (page: Page, key = "DEMO-1") => {
  await page.goto(TICKET(key));
  await expect(page.getByText(/^Kommentare · \d+$/i)).toBeVisible();
};

const toggle = (page: Page) => page.getByRole("button", { name: /^(Geladene Kommentare durchsuchen|Kommentarsuche schließen)$/ });
const searchbox = (page: Page) => page.getByRole("searchbox", { name: "Geladene Kommentare durchsuchen" });
const status = (page: Page) => page.getByRole("search").getByRole("status");
const items = (page: Page) => page.locator("ol").filter({ has: page.locator("li") }).last().locator(":scope > li");
const draft = (page: Page) => page.getByRole("textbox", { name: "Kommentar", exact: true });
const reads = (page: Page) => page.evaluate(() => (window as unknown as { __qa: { reads: string[] } }).__qa.reads.length);
const writes = (page: Page) => page.evaluate(() => (window as unknown as { __qa: { writes: unknown[] } }).__qa.writes.length);

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.clock.setFixedTime(new Date("2026-11-06T12:00:00.000Z"));
});

test("Suche filtert geladene Kommentare nach Text und Person, behält Sortierung und lädt nichts nach", async ({ page }) => {
  await open(page);
  await expect(items(page)).toHaveCount(5);
  const before = await reads(page);

  await toggle(page).focus();
  await page.keyboard.press("Enter");
  await expect(searchbox(page)).toBeFocused();
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
  await expect(status(page)).toHaveText("In 5 geladenen Kommentaren suchen");

  await page.keyboard.type("sam MUSTER");
  await expect(items(page)).toHaveCount(2);
  await expect(status(page)).toHaveText("2 von 5 geladenen Kommentaren");
  await expect(items(page).first()).toContainText("Rückfrage zum Rollout");

  await page.getByRole("button", { name: "Älteste zuerst" }).click();
  await expect(items(page).first()).toContainText("Danke @Kim Probe!");
  await page.getByRole("button", { name: "Neueste zuerst" }).click();
  await expect(items(page).first()).toContainText("Rückfrage zum Rollout");

  await searchbox(page).fill("staging ist");
  await expect(items(page)).toHaveCount(1);
  await searchbox(page).fill("(netto) + 19 % [offen]");
  await expect(items(page)).toHaveCount(1);
  await searchbox(page).fill("@kim");
  await expect(items(page)).toHaveCount(1);

  await searchbox(page).fill("gibt es nicht");
  await expect(items(page)).toHaveCount(0);
  await expect(status(page)).toHaveText("0 von 5 geladenen Kommentaren");
  await expect(page.getByText("Kein geladener Kommentar enthält „gibt es nicht“ im Text oder Namen.")).toBeVisible();
  await page.getByRole("button", { name: "Suche zurücksetzen" }).click();
  await expect(searchbox(page)).toBeFocused();
  await expect(searchbox(page)).toHaveValue("");
  await expect(items(page)).toHaveCount(5);

  await page.keyboard.type("kim");
  await page.keyboard.press("Escape");
  await expect(searchbox(page)).toHaveValue("");
  await expect(page).toHaveURL(/\/issue\/DEMO-1$/);
  await page.keyboard.press("Escape");
  await expect(searchbox(page)).toHaveCount(0);
  await expect(toggle(page)).toBeFocused();
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
  await expect(page).toHaveURL(/\/issue\/DEMO-1$/);

  expect(await reads(page)).toBe(before);
});

test("Entwurf bleibt beim Suchen erhalten und wird mit aktivem Filter gesendet", async ({ page }) => {
  await open(page);
  await draft(page).fill("Entwurf zur Freigabe");
  await draft(page).evaluate((element) => element.setAttribute("data-qa-mounted", "1"));

  await toggle(page).click();
  await searchbox(page).fill("freigabe");
  await expect(items(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Suche zurücksetzen" })).toBeVisible();
  await expect(draft(page)).toHaveText("Entwurf zur Freigabe");
  await expect(draft(page)).toHaveAttribute("data-qa-mounted", "1");

  await draft(page).click();
  await page.keyboard.type(" heute");
  await expect(draft(page)).toBeFocused();
  await expect(searchbox(page)).toHaveValue("freigabe");
  await expect(draft(page)).toHaveText("Entwurf zur Freigabe heute");

  await page.getByRole("button", { name: "Vorlage" }).click();
  await page.getByRole("menuitem").first().click();
  await expect(draft(page)).toBeFocused();
  await expect(draft(page).locator("p").first()).toHaveText("Entwurf zur Freigabe heute");
  await expect(draft(page)).toContainText("Stand");
  await expect(searchbox(page)).toHaveValue("freigabe");

  const sent = await writes(page);
  await page.keyboard.press("Control+Enter");
  await expect(draft(page)).toHaveText("");
  expect(await writes(page)).toBe(sent + 1);
  await expect(searchbox(page)).toHaveValue("freigabe");
  await expect(status(page)).toHaveText("1 von 6 geladenen Kommentaren");
  await expect(items(page).filter({ hasText: "Entwurf zur Freigabe heute" })).toHaveCount(1);
});

test("Ticketwechsel setzt die Suche zurück", async ({ page }) => {
  await open(page);
  await toggle(page).click();
  await searchbox(page).fill("sam");
  await expect(items(page)).toHaveCount(2);

  await page.locator("header").first().getByRole("button", { name: "Suchen" }).click();
  await page.keyboard.type("DEMO-2");
  await page.getByRole("option", { name: /DEMO-2/ }).first().click();
  await expect(page).toHaveURL(/\/issue\/DEMO-2$/);
  await expect(page.getByText(/^Kommentare · 2$/i)).toBeVisible();
  await expect(searchbox(page)).toHaveCount(0);
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
  await expect(items(page)).toHaveCount(2);
});

test("Schmal und dunkel ohne Seitenüberlauf", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await open(page);
  await toggle(page).click();
  await searchbox(page).fill("sam");
  await expect(items(page)).toHaveCount(2);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const box = await toggle(page).boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(32);
  expect(box?.height).toBeGreaterThanOrEqual(32);
  if (shots) {
    await toggle(page).evaluate((element) => element.scrollIntoView({ block: "start" }));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${shots}/${test.info().project.name}-390-dark.png` });
  }
});

test("Desktop hell mit Treffern", async ({ page }) => {
  test.skip(!shots || test.info().project.name !== "desktop");
  await page.setViewportSize({ width: 1280, height: 800 });
  await open(page);
  await toggle(page).click();
  await searchbox(page).fill("rollout");
  await toggle(page).evaluate((element) => element.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${shots}/desktop-light.png` });
});
