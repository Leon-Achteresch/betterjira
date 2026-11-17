import { expect, test, type Page, type TestInfo } from "@playwright/test";

type Write = { path: string; method: string; input: { fields?: { description?: unknown } } };
type QaIssue = { key: string; fields: { description: unknown } };
type QaWindow = { __qa: { writes: Write[]; issues: QaIssue[]; wiki: Record<string, string | null>; failNextWrite: boolean; failDescriptionRead: boolean } };

const ISSUE = "/tests/browser/fixture.html?route=/issue/DEMO-1";
const remote = (text: string) => ({ type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
const changeRemote = (page: Page, text: string) =>
  page.evaluate((doc) => { (window as unknown as QaWindow).__qa.issues.find((issue) => issue.key === "DEMO-1")!.fields.description = doc; }, remote(text));
const descriptionWrites = (page: Page) =>
  page.evaluate(() => (window as unknown as QaWindow).__qa.writes.filter((write) => write.method === "PUT" && write.path === "/issue/DEMO-1" && write.input.fields?.description !== undefined));
const panel = (page: Page) => page.getByRole("group", { name: "Beschreibung wurde in Jira geändert" });
const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  const dir = process.env.DESCRIPTION_CONFLICT_SHOTS;
  if (dir) await page.locator("form").filter({ has: panel(page) }).screenshot({ path: `${dir}/${testInfo.project.name}-${name}.png` });
};
const confirm = (page: Page) => panel(page).getByRole("button", { name: "Entwurf trotzdem speichern" });

test("Konflikt zeigt Jira-Fassung, Cmd/Ctrl+Enter bestaetigt nie und R zu R2 verlangt erneute Pruefung", async ({ page }, testInfo) => {
  await page.goto(ISSUE);
  await page.getByRole("button", { name: "Beschreibung bearbeiten" }).click();
  const editor = page.getByRole("textbox", { name: "Beschreibung" });
  await expect(editor).toBeFocused();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type(" Lokaler Zusatz");
  await changeRemote(page, "Fremde Änderung R");

  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(panel(page)).toBeVisible();
  await expect(panel(page).getByRole("heading", { name: "Beschreibung wurde in Jira geändert" })).toBeFocused();
  await expect(panel(page).getByLabel("Aktuell in Jira")).toContainText("Fremde Änderung R");
  await expect(panel(page).getByLabel("Stand bei Bearbeitungsbeginn")).toContainText("weniger Kontextwechseln");
  await expect(editor).toContainText("Lokaler Zusatz");
  await expect(confirm(page)).toBeDisabled();

  await editor.click();
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(panel(page)).toBeVisible();
  expect(await descriptionWrites(page)).toHaveLength(0);

  await panel(page).getByRole("checkbox").click();
  await expect(confirm(page)).toBeEnabled();
  await changeRemote(page, "Erneute Änderung R2");
  await confirm(page).click();
  await expect(panel(page).getByLabel("Aktuell in Jira")).toContainText("Erneute Änderung R2");
  await expect(panel(page).getByRole("checkbox")).not.toBeChecked();
  await expect(confirm(page)).toBeDisabled();
  expect(await descriptionWrites(page)).toHaveLength(0);
  await shot(page, testInfo, "r2");

  await panel(page).getByRole("checkbox").click();
  await confirm(page).click();
  await expect(editor).toHaveCount(0);
  const writes = await descriptionWrites(page);
  expect(writes).toHaveLength(1);
  expect(JSON.stringify(writes[0]?.input.fields?.description)).toContain("Lokaler Zusatz");
  expect(JSON.stringify(writes[0]?.input.fields?.description)).not.toContain("Erneute Änderung R2");
});

test("Altdraft ohne Basis bleibt bis zur bewussten Pruefung erhalten", async ({ page }) => {
  await page.addInitScript((local) => {
    const id = JSON.stringify(["qa-cloud", "qa-user", "DEMO-1", "description#adf"]);
    localStorage.setItem("betterjira-field-drafts", JSON.stringify({ state: { drafts: { [id]: { text: JSON.stringify(local), revision: "legacy" } } }, version: 0 }));
  }, remote("Alter lokaler Entwurf"));
  await page.goto(ISSUE);
  await page.getByRole("button", { name: "Beschreibung: Entwurf fortsetzen" }).click();
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  const unbased = page.getByRole("group", { name: "Ursprüngliche Fassung fehlt" });
  await expect(unbased).toBeVisible();
  await expect(unbased.getByText("Für diesen Entwurf nicht gespeichert.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Beschreibung" })).toContainText("Alter lokaler Entwurf");
  expect(await descriptionWrites(page)).toHaveLength(0);
  await unbased.getByRole("checkbox").click();
  await unbased.getByRole("button", { name: "Entwurf trotzdem speichern" }).click();
  await expect(page.getByRole("textbox", { name: "Beschreibung" })).toHaveCount(0);
  expect(await descriptionWrites(page)).toHaveLength(1);
});

test("Wiki-Rohtext bleibt exakt und null zu leer verlangt erneute Pruefung", async ({ page }) => {
  await page.goto(ISSUE);
  await page.getByRole("button", { name: "Beschreibung bearbeiten" }).click();
  await page.getByRole("button", { name: "Wiki-Markup", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Text bearbeiten" });
  const local = "h1. Lokal\n\n  eingerückt  \n|| a || b ||";
  await editor.fill(local);
  await page.evaluate(() => { (window as unknown as QaWindow).__qa.wiki["DEMO-1"] = null; });
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(panel(page)).toBeVisible();
  await panel(page).getByRole("checkbox").click();
  await page.evaluate(() => { (window as unknown as QaWindow).__qa.wiki["DEMO-1"] = ""; });
  await confirm(page).click();
  await expect(panel(page).getByRole("checkbox")).not.toBeChecked();
  await expect(confirm(page)).toBeDisabled();
  expect(await descriptionWrites(page)).toHaveLength(0);
  await expect(editor).toHaveValue(local);
  await panel(page).getByRole("checkbox").click();
  await confirm(page).click();
  await expect(editor).toHaveCount(0);
  expect((await descriptionWrites(page))[0]?.input.fields?.description).toBe(local);
});

test("GET- und Writefehler bei Vergleich behalten den editierbaren Entwurf", async ({ page }) => {
  await page.goto(ISSUE);
  await page.getByRole("button", { name: "Beschreibung bearbeiten" }).click();
  const editor = page.getByRole("textbox", { name: "Beschreibung" });
  await editor.press("ControlOrMeta+End"); await page.keyboard.type(" Lokaler Fehlerentwurf");
  await changeRemote(page, "Remote vor Fehler");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await panel(page).getByRole("checkbox").click();
  await page.evaluate(() => { (window as unknown as QaWindow).__qa.failDescriptionRead = true; });
  await confirm(page).click();
  await expect(page.getByRole("alert").filter({ hasText: "Beschreibung nicht lesbar" })).toBeVisible();
  await expect(editor).toContainText("Lokaler Fehlerentwurf");
  expect(await descriptionWrites(page)).toHaveLength(0);
  await page.evaluate(() => { (window as unknown as QaWindow).__qa.failDescriptionRead = false; });
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(panel(page)).toBeVisible();
  await panel(page).getByRole("checkbox").click();
  await page.evaluate(() => { (window as unknown as QaWindow).__qa.failNextWrite = true; });
  await confirm(page).click();
  await expect(page.getByRole("alert").filter({ hasText: "vorübergehend nicht erreichbar" })).toBeVisible();
  await expect(editor).toContainText("Lokaler Fehlerentwurf");
  expect(await descriptionWrites(page)).toHaveLength(0);
});
