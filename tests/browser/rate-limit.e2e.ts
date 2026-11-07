import { expect, test, type Page, type TestInfo } from "@playwright/test";

type SearchRule = { status?: number; headers?: Record<string, string>; keys?: string[] };

declare global {
  interface Window {
    __qaSearchRule?: (jql: string, pageToken: string | null) => SearchRule;
    __qa: { searches: string[]; commands: string[] };
  }
}

const TABLE = "/tests/browser/fixture.html?route=/bereiche/DEMO";
const THROTTLED = "Jira begrenzt gerade die Anzahl der Anfragen.";

const row = (page: Page, key: string) => page.getByRole("cell", { name: key, exact: true });
const searches = (page: Page) => page.evaluate(() => window.__qa.searches.length);
const setRule = (page: Page, source: string) =>
  page.evaluate((body) => {
    window.__qaSearchRule = new Function("jql", "token", body) as Window["__qaSearchRule"];
  }, source);

const expectSignedIn = async (page: Page) => {
  await expect(page.getByRole("button", { name: "Mit Atlassian verbinden" })).toHaveCount(0);
  const commands = await page.evaluate(() => window.__qa.commands);
  expect(commands).not.toContain("session_delete");
  expect(commands).not.toContain("oauth_login");
};

const expectNoAutomaticRetry = async (page: Page) => {
  const before = await searches(page);
  await page.waitForTimeout(3500);
  expect(await searches(page)).toBe(before);
};

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  const dir = process.env.RATE_LIMIT_SHOTS;
  if (!dir) return;
  if (testInfo.project.name !== "desktop") await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('16px "Geist Variable"'))).toBe(true);
  await page.screenshot({ path: `${dir}/${testInfo.project.name}-${name}.png` });
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("Drosselung beim ersten Laden nennt den frühesten Zeitpunkt, bleibt angemeldet und erholt sich per Retry", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    window.__qaSearchRule = () => ({ status: 429, headers: { "retry-after": "120" } });
  });
  await page.goto(TABLE);
  const error = page.getByRole("alert").filter({ hasText: THROTTLED });
  await expect(error).toContainText(/Bitte frühestens ab \d{2}:\d{2} Uhr erneut versuchen\./);
  await expect(error).not.toContainText("Test: Jira antwortet mit 429");
  await expect(error).not.toContainText("120");
  await expect(page.getByRole("table")).toHaveCount(0);
  await expectNoAutomaticRetry(page);
  await expectSignedIn(page);
  await shot(page, testInfo, "erstfehler");

  await setRule(page, "return {};");
  await error.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(row(page, "DEMO-3")).toBeVisible();
  await expect(error).toHaveCount(0);
  await expectSignedIn(page);
});

test("Drosselung beim Aktualisieren behält die geladenen Zeilen mit Hinweis", async ({ page }, testInfo) => {
  await page.goto(TABLE);
  await expect(row(page, "DEMO-3")).toBeVisible();
  await setRule(page, `return { status: 429, headers: { "retry-after": "bald" } };`);

  await page.getByRole("button", { name: "Aktualisieren" }).click();
  const notice = page.getByRole("alert").filter({ hasText: "zuletzt geladene Stand" });
  await expect(notice).toContainText(`${THROTTLED} Bitte später erneut versuchen.`);
  await expect(notice).not.toContainText("bald");
  await expect(row(page, "DEMO-1")).toBeVisible();
  await expect(row(page, "DEMO-3")).toBeVisible();
  await expectNoAutomaticRetry(page);
  await expectSignedIn(page);
  await shot(page, testInfo, "aktualisierung");

  await setRule(page, `return { keys: ["DEMO-1"] };`);
  await notice.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(notice).toHaveCount(0);
  await expect(row(page, "DEMO-3")).toHaveCount(0);
  await expect(row(page, "DEMO-1")).toBeVisible();
});
