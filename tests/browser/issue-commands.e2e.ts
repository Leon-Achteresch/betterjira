import { expect, test } from "@playwright/test";

test("Palette bietet kontextbezogene Aktionen nur für das aktive Jira-Ticket", async ({
  page,
}) => {
  await page.goto("/tests/browser/fixture.html?route=/issue/DEMO-1");
  await expect(
    page.getByRole("button", { name: "Vorgang anheften" }),
  ).toBeVisible();
  await page.keyboard.press("ControlOrMeta+k");
  await page
    .getByPlaceholder("Vorgänge, Bereiche, Filter oder Befehle suchen…")
    .fill("Aktuelles Ticket anheften");
  await page.getByRole("option", { name: "Aktuelles Ticket anheften", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Nicht mehr anheften" }),
  ).toBeVisible();
  await page.keyboard.press("ControlOrMeta+k");
  await page
    .getByPlaceholder("Vorgänge, Bereiche, Filter oder Befehle suchen…")
    .fill("Aktuelles Ticket lösen");
  await page.getByRole("option", { name: "Aktuelles Ticket lösen", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Vorgang anheften" }),
  ).toBeVisible();
  await page.goto("/tests/browser/fixture.html?route=/tickets");
  await expect(page.getByRole("button", { name: "Suchen", exact: true })).toBeVisible();
  await page.keyboard.press("ControlOrMeta+k");
  await page
    .getByPlaceholder("Vorgänge, Bereiche, Filter oder Befehle suchen…")
    .fill("Aktuelles Ticket anheften");
  await expect(
    page.getByRole("option", { name: "Aktuelles Ticket anheften", exact: true }),
  ).toHaveCount(0);
});
