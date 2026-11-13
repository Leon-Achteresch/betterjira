import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __qaLinkPermission?: boolean;
  }
}

const section = (page: Page) => page.locator("section").filter({ has: page.getByRole("heading", { name: /^Verknüpfungen/ }) });
const editor = (page: Page) => page.getByRole("dialog", { name: "Ticket verknüpfen", exact: true });
const chooseTarget = async (page: Page, key: string) => {
  await editor(page).getByRole("textbox", { name: "…dieses Ticket", exact: true }).fill(key);
  await editor(page).getByRole("button", { name: new RegExp(`^${key} `) }).click();
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => { throw error; });
});

test("legt gerichtete Beziehung an und aktualisiert die Liste", async ({ page }) => {
  await page.goto("/tests/browser/fixture.html?route=/issue/DEMO-2");
  await section(page).getByRole("button", { name: "Verknüpfen", exact: true }).click();
  await editor(page).getByRole("combobox", { name: "Dieses Ticket…", exact: true }).click();
  await page.getByRole("option", { name: "is blocked by", exact: true }).click();
  await chooseTarget(page, "DEMO-3");
  await page.evaluate(() => { window.__qa.delayMs = 500; });
  await editor(page).getByRole("button", { name: "Verknüpfung anlegen" }).dblclick();
  await expect(editor(page)).toHaveCount(0);
  await expect(section(page).getByRole("group", { name: "is blocked by", exact: true }).getByRole("link", { name: /DEMO-3/ })).toBeVisible();
  const writes = await page.evaluate(() => window.__qa.writes.filter((write) => write.path === "/issueLink"));
  expect(writes).toHaveLength(1);
  expect(writes[0].input).toEqual({ type: { id: "10000" }, inwardIssue: { key: "DEMO-3" }, outwardIssue: { key: "DEMO-2" } });
});

test("verhindert Selbstbezug und doppelte Beziehung", async ({ page }) => {
  await page.goto("/tests/browser/fixture.html?route=/issue/DEMO-1");
  await section(page).getByRole("button", { name: "Verknüpfen", exact: true }).click();
  await chooseTarget(page, "DEMO-1");
  await expect(editor(page).getByRole("alert")).toContainText("selbst");
  await expect(editor(page).getByRole("button", { name: "Verknüpfung anlegen" })).toBeDisabled();
  await chooseTarget(page, "DEMO-2");
  await expect(editor(page).getByRole("alert")).toContainText("bereits");
  await expect(editor(page).getByRole("button", { name: "Verknüpfung anlegen" })).toBeDisabled();
  expect(await page.evaluate(() => window.__qa.writes)).toEqual([]);
});

test("Entfernen lässt sich rückgängig machen und Fehler stellen die Zeile wieder her", async ({ page }) => {
  await page.goto("/tests/browser/fixture.html?route=/issue/DEMO-1");
  const blocks = section(page).getByRole("group", { name: "blocks", exact: true });
  await blocks.getByRole("button", { name: "Verknüpfung zu DEMO-2 entfernen", exact: true }).click();
  await expect(blocks).toHaveCount(0);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).last().click();
  await expect(blocks.getByRole("link", { name: /DEMO-2/ })).toBeVisible();
  await page.evaluate(() => { window.__qa.failNextWrite = true; });
  await blocks.getByRole("button", { name: "Verknüpfung zu DEMO-2 entfernen", exact: true }).click();
  await expect(page.getByText(/Verknüpfung konnte nicht entfernt werden:/)).toBeVisible();
  await expect(blocks.getByRole("link", { name: /DEMO-2/ })).toBeVisible();
});

test("fehlende Berechtigung erklärt die gesperrte Aktion", async ({ page }) => {
  await page.addInitScript(() => { window.__qaLinkPermission = false; });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tests/browser/fixture.html?route=/issue/DEMO-1");
  await section(page).getByRole("button", { name: "Verknüpfen", exact: true }).click();
  await expect(editor(page)).toContainText("Dir fehlt die Jira-Berechtigung");
  await expect(section(page).getByRole("button", { name: /Verknüpfung zu .* entfernen/ })).toHaveCount(0);
  expect(await page.evaluate(() => window.__qa.writes)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("Rückgängig bleibt nach Ticketwechsel an die ursprüngliche Beziehung gebunden", async ({ page }) => {
  await page.goto("/tests/browser/fixture.html?route=/issue/DEMO-1");
  await section(page).getByRole("group", { name: "blocks", exact: true }).getByRole("button", { name: "Verknüpfung zu DEMO-2 entfernen", exact: true }).click();
  await expect(page.getByText("Verknüpfung entfernt", { exact: true })).toBeVisible();
  await section(page).getByRole("group", { name: "is blocked by", exact: true }).getByRole("link", { name: /DEMO-3/ }).click();
  await expect(page).toHaveURL(/\/issue\/DEMO-3$/);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).last().click();
  await expect.poll(() => page.evaluate(() => window.__qa.writes.filter((write) => write.path === "/issueLink").length)).toBe(1);
  const write = await page.evaluate(() => window.__qa.writes.find((entry) => entry.path === "/issueLink"));
  expect(write?.input).toEqual({ type: { id: "10000" }, inwardIssue: { key: "DEMO-1" }, outwardIssue: { key: "DEMO-2" } });
});
