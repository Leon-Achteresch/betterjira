import { expect, test, type Page } from "@playwright/test";

type Write = { path: string; method: string; input: { fields: Record<string, unknown> }; failed?: number };

declare global {
  interface Window {
    __qaProjectFailure?: boolean;
    __qa: {
      writes: Write[];
      searches: string[];
      delayMs: number;
      failNextWrite: boolean;
      metaDelay: Record<string, number>;
      createFailure: { status: number; body: unknown } | null;
      opened: string[];
    };
  }
}

const shots = process.env.CREATE_ISSUE_SHOTS;

const open = (page: Page) => page.goto("/tests/browser/fixture.html?scenario=create&route=/neu");
const main = (page: Page) => page.getByRole("main");
const posts = (page: Page) =>
  page.evaluate(() => window.__qa.writes.filter((write) => write.path === "/issue" && write.method === "POST"));

const choose = async (page: Page, label: string, option: RegExp) => {
  await main(page).getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option }).click();
};

const fillTask = async (page: Page) => {
  await choose(page, "Projekt", /Produktentwicklung/);
  await expect(main(page).getByRole("combobox", { name: "Vorgangstyp", exact: true })).toContainText("Aufgabe");
  await main(page).getByRole("textbox", { name: "Titel", exact: true }).fill("Export für Quartalsbericht");
  await main(page).getByRole("textbox", { name: "Beschreibung" }).fill("Bitte bis Freitag.");
  await choose(page, "Priorität", /^Hoch$/);
  await main(page).getByRole("textbox", { name: "Kunde", exact: true }).fill("ACME");
};

const submitButton = (page: Page) => main(page).getByRole("button", { name: /Erstellen|Wird erstellt/ });

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("Projektladefehler wird angezeigt und kann erneut geladen werden", async ({ page }) => {
  await page.addInitScript(() => { window.__qaProjectFailure = true; });
  await open(page);
  await expect(main(page).getByRole("alert")).toContainText("Angaben zum Erstellen konnten nicht geladen werden");
  await expect(submitButton(page)).toBeDisabled();
  await page.evaluate(() => { window.__qaProjectFailure = false; });
  await main(page).getByRole("button", { name: "Erneut laden" }).click();
  await choose(page, "Projekt", /Produktentwicklung/);
  await expect(main(page).getByRole("combobox", { name: "Vorgangstyp", exact: true })).toContainText("Aufgabe");
  expect(await posts(page)).toEqual([]);
});

test("Erstellt genau ein Ticket trotz Doppelklick und Enter und öffnet es", async ({ page }) => {
  await open(page);
  await fillTask(page);
  const searchesBefore = await page.evaluate(() => window.__qa.searches.length);
  await page.evaluate(() => (window.__qa.delayMs = 800));
  await submitButton(page).dblclick();
  await page.keyboard.press("Control+Enter");
  await expect(submitButton(page)).toHaveText(/Wird erstellt/);
  await expect(page).toHaveURL(/\/issue\/DEMO-4$/);
  await expect(main(page).getByRole("heading", { name: "Export für Quartalsbericht" })).toBeVisible();
  const sent = await posts(page);
  expect(sent).toHaveLength(1);
  expect(sent[0]!.input.fields).toEqual({
    project: { id: "1" },
    issuetype: { id: "10001" },
    summary: "Export für Quartalsbericht",
    description: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: "Bitte bis Freitag." }] }] },
    priority: { id: "2" },
    customfield_kunde: "ACME",
  });
  await expect.poll(() => page.evaluate(() => window.__qa.searches.length)).toBeGreaterThan(searchesBefore);
});

test("Pflichtfelder werden vor dem Senden geprüft", async ({ page }) => {
  await open(page);
  await choose(page, "Projekt", /Produktentwicklung/);
  await expect(main(page).getByRole("textbox", { name: "Kunde", exact: true })).toBeVisible();
  await submitButton(page).click();
  await expect(main(page).getByText("Titel fehlt")).toBeVisible();
  await expect(main(page).getByText("Kunde fehlt")).toBeVisible();
  await expect(main(page).getByRole("textbox", { name: "Titel", exact: true })).toBeFocused();
  expect(await posts(page)).toHaveLength(0);
});

test("Typwechsel sendet keine Felder des vorherigen Typs", async ({ page }) => {
  await open(page);
  await fillTask(page);
  await choose(page, "Vorgangstyp", /Fehler/);
  await expect(main(page).getByRole("textbox", { name: "Kunde", exact: true })).toHaveCount(0);
  await expect(main(page).getByRole("textbox", { name: "Titel", exact: true })).toHaveValue("Export für Quartalsbericht");
  await choose(page, "Umgebung", /Produktion/);
  await submitButton(page).click();
  await expect(page).toHaveURL(/\/issue\/DEMO-4$/);
  const [sent] = await posts(page);
  expect(Object.keys(sent!.input.fields).sort()).toEqual(["customfield_umgebung", "description", "issuetype", "project", "summary"]);
  expect(sent!.input.fields.customfield_umgebung).toEqual({ id: "e1" });
});

test("Projektwechsel mit später Antwort behält Entwurf und sperrt nicht unterstützte Pflichtfelder", async ({ page }) => {
  await open(page);
  await page.evaluate(() => (window.__qa.metaDelay = { "1": 1200 }));
  await main(page).getByRole("textbox", { name: "Titel", exact: true }).fill("Server neu starten");
  await choose(page, "Projekt", /Produktentwicklung/);
  await choose(page, "Projekt", /Betrieb/);
  await expect(main(page).getByText("Erstellen hier nicht möglich")).toBeVisible();
  await expect(main(page).getByRole("listitem").filter({ hasText: "Team" })).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(main(page).getByRole("combobox", { name: "Vorgangstyp", exact: true })).toContainText("Störung");
  await expect(main(page).getByRole("textbox", { name: "Kunde", exact: true })).toHaveCount(0);
  await expect(main(page).getByRole("textbox", { name: "Titel", exact: true })).toHaveValue("Server neu starten");
  await expect(submitButton(page)).toBeDisabled();
  await main(page).getByRole("button", { name: "In Jira öffnen" }).click();
  await expect.poll(() => page.evaluate(() => window.__qa.opened)).toEqual([
    "https://example.atlassian.net/secure/CreateIssueDetails!init.jspa?pid=2&issuetype=20001&summary=Server+neu+starten",
  ]);
  expect(await posts(page)).toHaveLength(0);
});

test("Fehlende Create-Berechtigung wird erklärt, nicht als leere Projektliste", async ({ page }) => {
  await open(page);
  await choose(page, "Projekt", /Archiv ohne Rechte/);
  await expect(main(page).getByText("Keine Berechtigung zum Erstellen")).toBeVisible();
  await expect(main(page).getByText("Keine Projekte sichtbar")).toHaveCount(0);
  await expect(submitButton(page)).toBeDisabled();
});

test("Serverfehler 400, 403 und 503 behalten alle Eingaben", async ({ page }) => {
  await open(page);
  await fillTask(page);
  if (shots) await page.screenshot({ path: `${shots}/form-${test.info().project.name}.png`, fullPage: true });

  await page.evaluate(() => {
    window.__qa.createFailure = {
      status: 400,
      body: { errorMessages: ["Test: Bitte Angaben prüfen"], errors: { customfield_kunde: "Test: Kunde unbekannt", components: "Test: Komponente fehlt" } },
    };
  });
  await submitButton(page).click();
  await expect(main(page).getByText("Test: Kunde unbekannt")).toBeVisible();
  await expect(main(page).getByText("Test: Bitte Angaben prüfen")).toBeVisible();
  await expect(main(page).getByText("components: Test: Komponente fehlt")).toBeVisible();
  await expect(main(page).getByRole("textbox", { name: "Kunde", exact: true })).toHaveValue("ACME");
  if (shots) await page.screenshot({ path: `${shots}/error-${test.info().project.name}.png`, fullPage: true });

  await page.evaluate(() => {
    window.__qa.createFailure = { status: 403, body: { errorMessages: [], errors: {} } };
  });
  await submitButton(page).click();
  await expect(main(page).getByText("Dir fehlt die Berechtigung, in diesem Projekt Tickets zu erstellen.")).toBeVisible();

  await page.evaluate(() => (window.__qa.failNextWrite = true));
  await submitButton(page).click();
  await expect(main(page).getByText("Test: Jira vorübergehend nicht erreichbar")).toBeVisible();
  await expect(main(page).getByRole("textbox", { name: "Titel", exact: true })).toHaveValue("Export für Quartalsbericht");
  await expect(main(page).getByRole("textbox", { name: "Beschreibung" })).toHaveText("Bitte bis Freitag.");
  await expect(page).toHaveURL(/\/neu$/);
  expect(await page.evaluate(() => window.__qa.writes.filter((write) => write.path === "/issue").length)).toBe(2);

  await submitButton(page).click();
  await expect(page).toHaveURL(/\/issue\/DEMO-4$/);
});

test("Tastenkürzel C öffnet das Formular, ohne Eingaben zu kapern", async ({ page }) => {
  await page.goto("/tests/browser/fixture.html?scenario=create&route=/tickets");
  await expect(main(page).getByRole("heading", { name: "Jira-Tickets" })).toBeVisible();
  await page.keyboard.press("c");
  await expect(page).toHaveURL(/\/neu$/);
  const title = main(page).getByRole("textbox", { name: "Titel", exact: true });
  await title.click();
  await page.keyboard.type("cc");
  await expect(title).toHaveValue("cc");
  await expect(page).toHaveURL(/\/neu$/);
});

test("Einstieg über Kopfleiste und Command Palette", async ({ page }) => {
  await page.goto("/tests/browser/fixture.html?scenario=create&route=/");
  const tools = page.getByRole("navigation", { name: "Werkzeuge" });
  if ((page.viewportSize()?.width ?? 0) < 640) {
    await tools.getByRole("button", { name: "Weitere Aktionen" }).click();
    await page.getByRole("menuitem", { name: /Ticket erstellen/ }).click();
  } else {
    await tools.getByRole("link", { name: "Ticket erstellen" }).click();
  }
  await expect(page).toHaveURL(/\/neu$/);
  await page.locator("header").getByRole("button", { name: "Suchen" }).click();
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await palette.getByRole("combobox").fill("Ticket erstellen");
  await expect(palette.getByRole("option", { name: /Ticket erstellen/ })).toBeVisible();
});

test("Bei 390 px bleibt das Formular ohne Seitenüberlauf bedienbar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tests/browser/fixture.html?scenario=create&route=/");
  await page.getByRole("navigation", { name: "Werkzeuge" }).getByRole("button", { name: "Weitere Aktionen" }).click();
  await page.getByRole("menuitem", { name: /Ticket erstellen/ }).click();
  await fillTask(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (shots) await page.screenshot({ path: `${shots}/narrow-${test.info().project.name}.png`, fullPage: true });
  await page.evaluate(() => (window.__qa.failNextWrite = true));
  await submitButton(page).click();
  await expect(main(page).getByText("Ticket wurde nicht erstellt")).toBeVisible();
  await main(page).getByRole("button", { name: "Erstellen" }).scrollIntoViewIfNeeded();
  if (shots) await page.screenshot({ path: `${shots}/narrow-error-${test.info().project.name}.png`, fullPage: true });
});
