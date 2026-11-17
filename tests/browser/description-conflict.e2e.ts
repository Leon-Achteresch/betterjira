import { expect, test, type Page, type TestInfo } from "@playwright/test";

type Write = { path: string; method: string; input: { fields?: { description?: unknown } } };
type QaIssue = { key: string; fields: { description: unknown } };
type QaWindow = { __qa: { writes: Write[]; issues: QaIssue[] } };

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
