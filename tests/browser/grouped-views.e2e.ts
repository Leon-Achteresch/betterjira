import { expect, test, type Page } from "@playwright/test";

const route = (account = "qa-user") => `/tests/browser/fixture.html?${new URLSearchParams({ route: "/bereiche/DEMO", account })}`;
const openTable = async (page: Page, account?: string) => {
  await page.goto(route(account));
  await expect(page.getByRole("button", { name: "Ansicht und Export" })).toBeVisible();
};
const openMenu = async (page: Page) => page.getByRole("button", { name: "Ansicht und Export" }).click();
const groupBy = async (page: Page, label: string) => {
  await openMenu(page);
  await page.getByRole("menuitem", { name: "Gruppieren nach" }).focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("menuitemradio", { name: label, exact: true }).focus();
  await page.keyboard.press("Enter");
};

test.beforeEach(({ page }) => {
  page.on("pageerror", (error) => { throw error; });
});

test("Gruppen funktionieren per Tastatur, bleiben nach Neustart erhalten und sind kontogebunden", async ({ page }, testInfo) => {
  await openTable(page);
  await expect(page.getByRole("cell", { name: "DEMO-1", exact: true })).toBeVisible();
  await groupBy(page, "Status");
  const group = page.getByRole("button", { name: "In Arbeit: 3 geladene Vorgänge" });
  await expect(group).toHaveAttribute("aria-expanded", "true");
  await page.screenshot({ path: testInfo.outputPath("grouped-view.png") });
  await expect(page.getByText("Gruppen zählen nur die geladenen Vorgänge.", { exact: false })).toBeVisible();
  await group.focus();
  await page.keyboard.press("Enter");
  await expect(group).toBeFocused();
  await expect(group).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("cell", { name: "DEMO-1", exact: true })).toHaveCount(0);
  await openTable(page);
  await expect(group).toHaveAttribute("aria-expanded", "false");
  await openMenu(page);
  await page.getByRole("menuitem", { name: "Alle Gruppen aufklappen" }).click();
  await expect(page.getByRole("cell", { name: "DEMO-1", exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: "DEMO-1 auswählen", exact: true }).click();
  await expect(page.getByRole("region", { name: "Ausgewählte Vorgänge" })).toContainText("1 von 3");
  await group.click();
  await expect(page.getByRole("region", { name: "Ausgewählte Vorgänge" })).toContainText("1 von 3");
  await openTable(page, "qa-colleague");
  await expect(group).toHaveCount(0);
  await expect(page.getByRole("cell", { name: "DEMO-1", exact: true })).toBeVisible();
});

test("gespeicherte Ansichten stellen Gruppierung wieder her, Standard entfernt sie", async ({ page }) => {
  await openTable(page);
  await groupBy(page, "Bearbeiter");
  await expect(page.getByRole("button", { name: "Alex Beispiel: 3 geladene Vorgänge" })).toBeVisible();
  await openMenu(page);
  await page.getByRole("menuitem", { name: "Ansicht speichern…" }).click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Teamfokus");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await groupBy(page, "Priorität");
  await expect(page.getByRole("button", { name: "Mittel: 3 geladene Vorgänge" })).toBeVisible();
  await openMenu(page);
  await page.getByRole("menuitem", { name: /Teamfokus/ }).click();
  await expect(page.getByRole("button", { name: "Alex Beispiel: 3 geladene Vorgänge" })).toBeVisible();
  await openMenu(page);
  await page.getByRole("menuitem", { name: "Auf Standard zurücksetzen" }).click();
  await expect(page.getByRole("button", { name: "Alex Beispiel: 3 geladene Vorgänge" })).toHaveCount(0);
  await expect(page.getByRole("cell", { name: "DEMO-1", exact: true })).toBeVisible();
});

test("JSON-Import erklärt Fehler und übernimmt sichere Darstellung auch ohne sichtbare Gruppenspalte", async ({ page }) => {
  await openTable(page);
  await openMenu(page);
  await page.getByRole("menuitem", { name: "Ansicht importieren…" }).click();
  const input = page.getByRole("textbox", { name: "Ansichtsdefinition (JSON)" });
  await expect(input).toBeVisible();
  await input.fill("{ kaputt }");
  await page.getByRole("button", { name: "Ansicht übernehmen" }).click();
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("alert").filter({ hasText: "keine unterstützte BetterJira-Ansicht" })).toBeVisible();
  await input.fill(JSON.stringify({
    format: "betterjira.issue-view", version: 1,
    view: { columns: ["key", "summary"], sort: [], quick: [], facets: {}, dense: true, groupBy: "priority", jql: "project = SECRET" },
  }));
  await page.getByRole("button", { name: "Ansicht übernehmen" }).click();
  await expect(input).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mittel: 3 geladene Vorgänge" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Priorität", exact: true })).toHaveCount(0);
  await expect(page.getByRole("cell", { name: "DEMO-1", exact: true })).toBeVisible();
  await openTable(page);
  await expect(page.getByRole("button", { name: "Mittel: 3 geladene Vorgänge" })).toBeVisible();
  expect(await page.evaluate(() => window.__qa.writes)).toEqual([]);
});
