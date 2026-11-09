import { expect, test, type Page, type TestInfo } from "@playwright/test";

type TabTitleRule = { delayMs?: number; status?: number; summary?: string };
type TabTitleStats = { calls: string[]; open: number; peak: number };

declare global {
  interface Window {
    __qaTabTitleRule?: (key: string) => TabTitleRule;
    __qaTabTitles?: TabTitleStats;
    __qa: { issueReads: string[]; issues: { key: string; fields: { summary: string } }[] };
  }
}

const BUSY = "/tests/browser/fixture.html?scenario=busy&route=/issue/DEMO-1";
const KEYS = Array.from({ length: 12 }, (_, index) => `DEMO-${index + 1}`);

const tabs = (page: Page) => page.getByRole("tablist", { name: "Geöffnete Tickets" });
const tab = (page: Page, key: string) => tabs(page).locator(`[role="tab"][href="/issue/${key}"]`);

const fullReads = (page: Page) =>
  page.evaluate(() => window.__qa.issueReads.filter((read) => read.endsWith("?fields=*all")).map((read) => read.split("?")[0]));
const summaryReads = (page: Page) => page.evaluate(() => window.__qaTabTitles?.calls ?? []);

const setRule = (page: Page, rule: TabTitleRule) =>
  page.addInitScript((value) => {
    window.__qaTabTitleRule = () => value;
  }, rule);

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  const dir = process.env.ISSUE_TAB_SHOTS;
  if (!dir) return;
  const geist = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].some((font) => font.family.replaceAll('"', "") === "Geist Variable" && font.status === "loaded");
  });
  expect(geist).toBe(true);
  await page.screenshot({ path: `${dir}/${testInfo.project.name}-${name}.png` });
};

const waitForTitles = async (page: Page) => {
  for (const key of KEYS) await expect(tab(page, key)).toHaveAttribute("title", new RegExp(`^${key} · `));
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("zwölf offene Tabs laden volle Details nur für das aktive Ticket", async ({ page }, testInfo) => {
  await page.goto(BUSY);
  await expect(tabs(page).getByRole("tab")).toHaveCount(12);
  await waitForTitles(page);
  await expect(tab(page, "DEMO-1")).toHaveAttribute("title", "DEMO-1 · Suche für den Arbeitsalltag vereinfachen");
  await expect(tab(page, "DEMO-3")).toContainText("Übergabe an das Team vorbereiten");
  await shot(page, testInfo, "tabs");

  expect(await fullReads(page)).toEqual(["/issue/DEMO-1"]);
  expect((await summaryReads(page)).toSorted()).toEqual(KEYS.slice(1).toSorted());
});

test("hält höchstens vier Titel-Anfragen gleichzeitig offen", async ({ page }) => {
  await setRule(page, { delayMs: 400 });
  await page.goto(BUSY);
  await waitForTitles(page);
  const stats = await page.evaluate(() => window.__qaTabTitles);
  expect(stats?.peak).toBe(4);
  expect(stats?.calls).toHaveLength(11);
});

test("Tab-Wechsel lädt Details nur für das neue Ticket und behält vorhandene Titel", async ({ page }) => {
  await page.goto(BUSY);
  await waitForTitles(page);
  await tab(page, "DEMO-3").click();
  await expect(page).toHaveURL(/\/issue\/DEMO-3$/);
  await expect(page.getByRole("heading", { level: 1, name: "Übergabe an das Team vorbereiten" })).toBeVisible();
  await waitForTitles(page);

  expect(await fullReads(page)).toEqual(["/issue/DEMO-1", "/issue/DEMO-3"]);
  expect((await summaryReads(page)).filter((key) => key === "DEMO-1")).toEqual([]);
  expect(await summaryReads(page)).toHaveLength(11);
});

test("zeigt einen geänderten Titel nach dem Öffnen auch im inaktiven Tab", async ({ page }) => {
  await page.goto(BUSY);
  await waitForTitles(page);
  await page.evaluate(() => {
    const issue = window.__qa.issues.find((entry) => entry.key === "DEMO-4");
    if (issue) issue.fields.summary = "Geänderter Titel aus Jira";
  });
  await tab(page, "DEMO-4").click();
  await expect(page.getByRole("heading", { level: 1, name: "Geänderter Titel aus Jira" })).toBeVisible();
  await tab(page, "DEMO-1").click();
  await expect(page).toHaveURL(/\/issue\/DEMO-1$/);
  await expect(tab(page, "DEMO-4")).toHaveAttribute("title", "DEMO-4 · Geänderter Titel aus Jira");
});

test("fehlende Titel bleiben ruhig beim Schlüssel ohne wiederholte Anfragen", async ({ page }, testInfo) => {
  await setRule(page, { status: 503 });
  await page.goto(BUSY);
  await expect.poll(() => summaryReads(page).then((calls) => calls.length)).toBe(11);
  await expect(tab(page, "DEMO-5")).toHaveAttribute("title", "DEMO-5");
  await expect(tab(page, "DEMO-1")).toHaveAttribute("title", /^DEMO-1 · /);

  await page.evaluate(() => {
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(1500);
  expect(await summaryReads(page)).toHaveLength(11);
  await shot(page, testInfo, "fehlende-titel");
});

test("Abmelden bricht wartende Titel-Anfragen ab", async ({ page }) => {
  await setRule(page, { delayMs: 1200 });
  await page.goto(BUSY);
  await expect.poll(() => summaryReads(page).then((calls) => calls.length)).toBe(4);
  await page.keyboard.press("Control+k");
  await page.keyboard.type("Abmelden");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2500);
  expect(await summaryReads(page)).toHaveLength(4);
  await expect(tabs(page).getByRole("tab")).toHaveCount(0);
});
