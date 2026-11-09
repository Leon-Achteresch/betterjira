import { expect, test } from "@playwright/test";

const BOARD = "/tests/browser/fixture.html?scenario=board&route=/bereiche/DEMO?board=1";

test("large board shows page one, loads further pages and reuses metadata", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "__qaBoardIssueCount", { value: 350 });
    Object.defineProperty(window, "__qaReads", { value: [] });
    Object.defineProperty(window, "IntersectionObserver", { value: undefined });
  });
  await page.goto(BOARD);
  await expect(page.getByText("100 Vorgänge geladen", { exact: true })).toBeVisible();
  await expect(page.getByText("DEMO-1", { exact: true })).toBeVisible();
  await expect(page.getByText("DEMO-350", { exact: true })).toHaveCount(0);
  if (process.env.BOARD_PERF_SHOTS) {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${process.env.BOARD_PERF_SHOTS}/${testInfo.project.name}.png` });
  }
  const load = page.getByRole("button", { name: "Weitere Vorgänge laden", exact: true });
  await load.click();
  await expect(page.getByText("200 Vorgänge geladen", { exact: true })).toBeVisible();
  await load.click();
  await expect(page.getByText("300 Vorgänge geladen", { exact: true })).toBeVisible();
  await load.click();
  await expect(page.getByText("350 Vorgänge", { exact: true })).toBeVisible();
  await expect(load).toHaveCount(0);
  const reads = await page.evaluate(() => Reflect.get(window, "__qaReads") as string[]);
  expect(reads.filter((path) => path === "/field")).toHaveLength(1);
  expect(reads.filter((path) => path === "/board/1/configuration")).toHaveLength(1);
  const searches = await page.evaluate(() => (Reflect.get(window, "__qa") as { searches: string[] }).searches);
  expect(searches.filter((jql) => jql.includes("filter = 100"))).toHaveLength(4);
});

test("scrolling to the end automatically loads the next board page", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "__qaBoardIssueCount", { value: 250 });
  });
  await page.goto(BOARD);
  await expect(page.getByText("100 Vorgänge geladen", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Weitere Vorgänge laden", exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByText("200 Vorgänge geladen", { exact: true })).toBeVisible();
  const searches = await page.evaluate(() => (Reflect.get(window, "__qa") as { searches: string[] }).searches);
  expect(searches.filter((jql) => jql.includes("filter = 100"))).toHaveLength(2);
});
