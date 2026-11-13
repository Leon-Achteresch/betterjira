import { expect, test, type Page } from "@playwright/test";

const open = (page: Page, route = "/arbeitsplatz") => page.goto(`/tests/browser/fixture.html?${new URLSearchParams({ route, scenario: "workspace" })}`);
const entry = (page: Page, key: string) => page.locator(`[data-workspace-entry="${key}"]`);
const plan = async (page: Page, key: string, action: string) => {
  await entry(page, key).getByRole("button", { name: `Plan für ${key} ändern` }).click();
  await page.getByRole("menuitem", { name: action, exact: true }).click();
};
const filter = (page: Page, name: string) => page.getByRole("navigation", { name: "Arbeitskontexte filtern" }).getByRole("link", { name: new RegExp(`^${name} `) });
const visibleKeys = (page: Page) => page.locator("[data-workspace-entry]").evaluateAll((elements) => elements.map((element) => element.getAttribute("data-workspace-entry")));

test("Heute und Später sind persönlich, geordnet und nach Neustart wieder verfügbar", async ({ page }) => {
  test.setTimeout(60_000);
  await open(page);
  await plan(page, "DEMO-1", "Für heute planen");
  await plan(page, "DEMO-2", "Für heute planen");
  await filter(page, "Heute").click();
  await expect.poll(() => visibleKeys(page)).toEqual(["DEMO-1", "DEMO-2"]);
  await plan(page, "DEMO-2", "Im Plan nach oben");
  await expect.poll(() => visibleKeys(page)).toEqual(["DEMO-2", "DEMO-1"]);
  await open(page, "/arbeitsplatz?art=heute");
  await expect.poll(() => visibleKeys(page)).toEqual(["DEMO-2", "DEMO-1"]);
  await plan(page, "DEMO-2", "Für später planen");
  await expect(entry(page, "DEMO-2")).toHaveCount(0);
  await expect(page.getByRole("searchbox", { name: "Arbeitsplatz durchsuchen" })).toBeFocused();
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect.poll(() => visibleKeys(page)).toEqual(["DEMO-2", "DEMO-1"]);
  await plan(page, "DEMO-2", "Aus Plan entfernen");
  await expect(entry(page, "DEMO-2")).toHaveCount(0);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect.poll(() => visibleKeys(page)).toEqual(["DEMO-2", "DEMO-1"]);
  expect(await page.evaluate("window.__qa.writes")).toEqual([]);
});

test("Ticketaktionen planen für später und die schmale Übersicht bleibt bedienbar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "/issue/DEMO-1");
  await page.getByRole("button", { name: "Weitere Ticketaktionen", exact: true }).click();
  await page.getByRole("menuitem", { name: "Für später planen", exact: true }).click();
  await open(page, "/arbeitsplatz?art=spaeter");
  await expect(entry(page, "DEMO-1").getByText("Für später geplant", { exact: true })).toBeVisible();
  await entry(page, "DEMO-1").getByRole("button", { name: "Plan für DEMO-1 ändern" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: "Im Plan nach oben", exact: true })).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Escape");
  expect(await page.locator("#app-scroll").evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0);
  if (process.env.PLAN_SHOTS) await page.screenshot({ path: `${process.env.PLAN_SHOTS}/personal-plan-${test.info().project.name}.png` });
});
