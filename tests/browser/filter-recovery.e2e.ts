import { expect, test, type Page, type TestInfo } from "@playwright/test";

type FilterRule = { delayMs?: number; status?: number };
type Write = { path: string; method: string; input: { jql?: string; name?: string } };

declare global {
  interface Window {
    __qaFilterRule?: (id: string) => FilterRule;
    __qa: { sessionFailure: boolean; searches: string[]; writes: Write[]; filterReads: string[]; commands: string[] };
  }
}

const STALE_AFTER_MS = 31_000;

const open = (page: Page, route: string, scenario = "filters") =>
  page.goto(`/tests/browser/fixture.html?${new URLSearchParams({ route, scenario })}`);

const main = (page: Page) => page.getByRole("main");
const heading = (page: Page) => main(page).getByRole("heading", { level: 1 });
const jql = (page: Page) => main(page).getByRole("textbox", { name: "JQL" });
const editToggle = (page: Page) => main(page).getByRole("button", { name: "JQL bearbeiten" });
const preview = (page: Page) => main(page).getByText("Vorschau · nicht gespeichert");
const login = (page: Page) => page.getByRole("button", { name: "Mit Atlassian verbinden" });
const retry = (page: Page) => main(page).getByRole("button", { name: "Erneut versuchen" });
const qa = (page: Page) => page.evaluate(() => window.__qa);

const setRule = (page: Page, source: string) =>
  page.evaluate((body) => {
    window.__qaFilterRule = new Function("id", body) as Window["__qaFilterRule"];
  }, source);

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  const dir = process.env.FILTER_RECOVERY_SHOTS;
  if (dir) await page.screenshot({ path: `${dir}/${testInfo.project.name}-${name}.png` });
};

const openSidebarLink = async (page: Page, name: string) => {
  const link = page.getByRole("link", { name, exact: true });
  const collapsed = !(await link.isVisible());
  if (collapsed) await page.getByRole("button", { name: "Toggle Sidebar", exact: true }).click();
  await link.click();
  if (collapsed) await page.keyboard.press("Escape");
};

const editDraft = async (page: Page, text: string) => {
  await editToggle(page).click();
  await expect(jql(page)).toBeVisible();
  await jql(page).fill(text);
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test.describe("Sitzung", () => {
  test("eine langsame Sitzung zeigt Laden statt Anmeldung", async ({ page }) => {
    await open(page, "/filter/100", "session-slow");
    await expect(main(page).getByRole("status", { name: "Filter wird geladen" })).toBeVisible();
    await expect(login(page)).toHaveCount(0);
    await expect(heading(page)).toHaveText("Offene Testtickets");
  });

  test("ohne Sitzung bleibt die Anmeldung", async ({ page }) => {
    await open(page, "/filter/100", "calendar-offline");
    await expect(main(page).getByRole("button", { name: "Mit Atlassian verbinden" })).toBeVisible();
    await expect(page.getByText("Anmeldung konnte nicht geprüft werden")).toHaveCount(0);
    expect((await qa(page)).filterReads).toEqual([]);
  });

  test("ein Lesefehler ist keine Abmeldung und liest die Sitzung nicht öfter als die Ticketseite", async ({ page }, testInfo) => {
    const sessionReads = async () => (await qa(page)).commands.filter((command) => command === "session_get").length;
    await open(page, "/tickets", "session-error");
    await expect(main(page).getByText("Anmeldung konnte nicht geprüft werden", { exact: true })).toBeVisible();
    const baseline = await sessionReads();

    await open(page, "/filter/100", "session-error");
    await expect(main(page).getByText("Anmeldung konnte nicht geprüft werden", { exact: true })).toBeVisible();
    await expect(main(page).getByRole("button", { name: "Mit Atlassian verbinden" })).toHaveCount(0);
    await shot(page, testInfo, "sitzung-fehler");
    expect(await sessionReads()).toBe(baseline);

    await page.evaluate(() => {
      window.__qa.sessionFailure = false;
    });
    await retry(page).focus();
    await page.keyboard.press("Enter");
    await expect(heading(page)).toHaveText("Offene Testtickets");
    await expect(main(page).getByRole("cell", { name: "DEMO-1", exact: true })).toBeVisible();
  });
});

test.describe("Filter laden", () => {
  test("ein erster 503 zeigt einen Fehler mit Retry ohne Ersatzabfrage", async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      window.__qaFilterRule = () => ({ status: 503 });
    });
    await open(page, "/filter/100");
    await expect(main(page).getByText("Filter konnte nicht geladen werden")).toBeVisible();
    await expect(main(page).getByText("Test: Jira antwortet mit 503")).toBeVisible();
    await expect(editToggle(page)).toBeDisabled();
    await shot(page, testInfo, "erster-fehler");
    expect((await qa(page)).searches.filter((search) => search.includes("filter ="))).toEqual([]);

    await setRule(page, "return {};");
    await retry(page).focus();
    await page.keyboard.press("Enter");
    await expect(heading(page)).toHaveText("Offene Testtickets");
    await expect(main(page).getByRole("cell", { name: "DEMO-1", exact: true })).toBeVisible();
    await expect(main(page).getByText("Filter konnte nicht geladen werden")).toHaveCount(0);
  });

  for (const status of [403, 404]) {
    test(`${status} wird weder als Abmeldung noch als gelöscht gemeldet`, async ({ page }) => {
      await page.addInitScript((code) => {
        window.__qaFilterRule = () => ({ status: code });
      }, status);
      await open(page, "/filter/100");
      await expect(main(page).getByText("Filter nicht verfügbar")).toBeVisible();
      await expect(main(page).getByText(`(${status})`, { exact: false })).toBeVisible();
      await expect(main(page)).not.toContainText(/gelöscht/i);
      await expect(login(page)).toHaveCount(0);
      await expect(page.getByText("Anmeldung konnte nicht geprüft werden")).toHaveCount(0);
      await expect(retry(page)).toBeEnabled();
      expect((await qa(page)).filterReads).toEqual(["100"]);
    });
  }

  test("ein gescheiterter Refresh behält Name, JQL, Tabelle und Entwurf", async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await open(page, "/filter/100");
    await expect(heading(page)).toHaveText("Offene Testtickets");
    await editDraft(page, "project = DEMO AND text ~ entwurf");
    await expect(main(page).getByRole("cell", { name: "DEMO-1", exact: true })).toBeVisible();

    await setRule(page, "return { status: 503 };");
    await page.waitForTimeout(STALE_AFTER_MS);
    await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
    const notice = main(page).getByRole("alert").filter({ hasText: "Filter konnte nicht aktualisiert werden" });
    await expect(notice).toBeVisible();
    await expect(heading(page)).toHaveText("Offene Testtickets");
    await expect(jql(page)).toHaveValue("project = DEMO AND text ~ entwurf");
    await expect(main(page).getByRole("cell", { name: "DEMO-1", exact: true })).toBeVisible();
    await shot(page, testInfo, "refresh-fehler");

    await setRule(page, "return {};");
    await notice.getByRole("button", { name: "Erneut versuchen" }).click();
    await expect(notice).toHaveCount(0);
    await expect(jql(page)).toHaveValue("project = DEMO AND text ~ entwurf");
    expect((await qa(page)).writes).toEqual([]);
  });
});

test.describe("Filterwechsel", () => {
  test("ein Entwurf aus A erscheint nicht in B und wird dort nicht gespeichert", async ({ page }) => {
    await open(page, "/filter/100");
    await expect(heading(page)).toHaveText("Offene Testtickets");
    await editDraft(page, "project = DEMO AND text ~ fremd");
    await main(page).getByRole("button", { name: "Vorschau", exact: true }).click();
    await expect(preview(page)).toBeVisible();

    await openSidebarLink(page, "Team-Rückstand");
    await expect(heading(page)).toHaveText("Team-Rückstand");
    await expect(preview(page)).toHaveCount(0);
    await expect(editToggle(page)).toHaveAttribute("aria-pressed", "false");
    await expect(jql(page)).toHaveCount(0);
    await expect.poll(async () => (await qa(page)).searches.at(-1)).toContain("ORDER BY created DESC");

    await editToggle(page).click();
    await expect(jql(page)).toHaveValue("project = DEMO ORDER BY created DESC");
    await expect(main(page).getByRole("button", { name: "Speichern", exact: true })).toBeDisabled();

    await main(page).getByRole("button", { name: "Filteraktionen" }).click();
    await page.getByRole("menuitem", { name: "Löschen…" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.goBack();
    await expect(heading(page)).toHaveText("Offene Testtickets");
    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    expect((await qa(page)).writes).toEqual([]);
  });

  test("normales Bearbeiten, Anwenden und Speichern schreibt genau einmal in den Filter", async ({ page }, testInfo) => {
    await open(page, "/filter/100");
    await expect(heading(page)).toHaveText("Offene Testtickets");
    await editDraft(page, "project = DEMO ORDER BY key ASC");
    await main(page).getByRole("button", { name: "Vorschau", exact: true }).click();
    await expect(preview(page)).toBeVisible();
    await expect.poll(async () => (await qa(page)).searches.some((search) => search.includes("ORDER BY key ASC"))).toBe(true);
    await shot(page, testInfo, "vorschau");

    await main(page).getByRole("button", { name: "Speichern", exact: true }).click();
    await expect(page.getByText("Filter gespeichert")).toBeVisible();
    await expect(preview(page)).toHaveCount(0);
    const writes = (await qa(page)).writes;
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ path: "/filter/100", method: "PUT", input: { jql: "project = DEMO ORDER BY key ASC" } });
  });
});
