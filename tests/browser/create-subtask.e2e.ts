import { expect, test, type Page } from "@playwright/test";

const main = (page: Page) => page.getByRole("main");

test("erstellt eine Unteraufgabe mit festem Projekt und aktualisiert den Parent", async ({ page }) => {
  page.on("pageerror", (error) => { throw error; });
  await page.goto("/tests/browser/fixture.html?scenario=create&route=/issue/DEMO-1");
  await main(page).getByRole("link", { name: "Unteraufgabe erstellen", exact: true }).click();
  await expect(main(page).getByRole("heading", { name: "Unteraufgabe erstellen", exact: true })).toBeVisible();
  await expect(main(page).getByRole("combobox", { name: "Projekt", exact: true })).toBeDisabled();
  await expect(main(page).getByRole("combobox", { name: "Vorgangstyp", exact: true })).toContainText("Unteraufgabe");
  await main(page).getByRole("textbox", { name: "Titel", exact: true }).fill("Abnahmetest ergänzen");
  await main(page).getByRole("button", { name: "Erstellen", exact: true }).click();
  await expect(page).toHaveURL(/\/issue\/DEMO-4$/);
  await expect(main(page).getByRole("heading", { name: "Abnahmetest ergänzen", exact: true })).toBeVisible();
  await expect(main(page).getByRole("link", { name: "Unteraufgabe erstellen", exact: true })).toHaveCount(0);
  const writes = await page.evaluate(() => window.__qa.writes.filter((write) => write.path === "/issue"));
  expect(writes).toHaveLength(1);
  expect(writes[0].input.fields).toMatchObject({ project: { id: "1" }, issuetype: { id: "10003" }, parent: { key: "DEMO-1" }, summary: "Abnahmetest ergänzen" });
  await main(page).getByRole("link", { name: /DEMO-1/ }).first().click();
  const subtasks = page.locator("section").filter({ has: page.getByRole("heading", { name: "Unteraufgaben", exact: true }) });
  await expect(subtasks.getByRole("link", { name: /DEMO-4/ })).toBeVisible();
});

test("Unteraufgabenentwürfe überschreiben den gewöhnlichen Erstellungsentwurf nicht", async ({ page }) => {
  await page.goto("/tests/browser/fixture.html?scenario=create&route=/neu");
  await main(page).getByRole("textbox", { name: "Titel", exact: true }).fill("Eigenständiges Ticket");
  await page.goto("/tests/browser/fixture.html?scenario=create&route=/neu?parent=DEMO-1");
  await expect(main(page).getByRole("combobox", { name: "Vorgangstyp", exact: true })).toContainText("Unteraufgabe");
  await expect(main(page).getByRole("textbox", { name: "Titel", exact: true })).toHaveValue("");
  await main(page).getByRole("textbox", { name: "Titel", exact: true }).fill("Unteraufgabenentwurf");
  await page.goto("/tests/browser/fixture.html?scenario=create&route=/neu");
  await expect(main(page).getByRole("textbox", { name: "Titel", exact: true })).toHaveValue("Eigenständiges Ticket");
  await page.goto("/tests/browser/fixture.html?scenario=create&route=/neu?parent=DEMO-1");
  await expect(main(page).getByRole("textbox", { name: "Titel", exact: true })).toHaveValue("Unteraufgabenentwurf");
});
