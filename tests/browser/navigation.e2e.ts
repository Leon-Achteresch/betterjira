import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __qa: {
      searches: string[];
      searchDelayMs: number;
      failSearch: boolean;
      emptySearch: boolean;
      sessionFailure: boolean;
    };
  }
}

const open = (page: Page, route: string, scenario?: string) =>
  page.goto(`/tests/browser/fixture.html?${new URLSearchParams({ route, ...(scenario && { scenario }) })}`);

const mainNav = (page: Page) => page.getByRole("navigation", { name: "Hauptnavigation" });

const showMainNav = async (page: Page) => {
  if ((page.viewportSize()?.width ?? 0) >= 768) return mainNav(page);
  await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await expect(mainNav(page)).toBeVisible();
  return mainNav(page);
};

const presets = (page: Page) => page.getByRole("navigation", { name: "Ticket-Ansicht" });

const lastSearch = (page: Page) => page.evaluate(() => window.__qa.searches.at(-1) ?? "");

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("Hauptnavigation markiert die aktive Seite und führt zu den Jira-Tickets", async ({ page }) => {
  await open(page, "/");
  const nav = await showMainNav(page);
  for (const name of ["Übersicht", "Arbeitsplatz", "Jira-Tickets", "Pull Requests", "Kalender", "Benachrichtigungen"]) {
    await expect(nav.getByRole("link", { name, exact: true })).toHaveCount(1);
  }
  await expect(nav.getByRole("link", { name: "Einstellungen" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Übersicht", exact: true })).toHaveAttribute("aria-current", "page");

  await nav.getByRole("link", { name: "Jira-Tickets", exact: true }).click();
  await expect(page).toHaveURL(/\/tickets$/);
  await expect(page.getByRole("heading", { name: "Jira-Tickets", exact: true })).toBeVisible();
  const reopened = await showMainNav(page);
  await expect(reopened.getByRole("link", { name: "Jira-Tickets", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(reopened.getByRole("link", { name: "Übersicht", exact: true })).not.toHaveAttribute("aria-current", "page");

  await reopened.getByRole("link", { name: "Kalender", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/kalender$/);
  await expect(page.getByRole("heading", { name: "Kalender", exact: true })).toBeVisible();

  await page.getByRole("navigation", { name: "Werkzeuge" }).getByRole("link", { name: "Einstellungen", exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/darstellung$/);
});

test("Ticket-Ansichten kommen aus der URL und folgen Zurück und Vorwärts", async ({ page }) => {
  await open(page, "/tickets");
  const tabs = presets(page);
  await expect(tabs.getByRole("link", { name: "Meine offenen" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("cell", { name: "DEMO-1", exact: true })).toBeVisible();
  expect(await lastSearch(page)).toContain("assignee = currentUser()");

  await tabs.getByRole("link", { name: "Beobachtet" }).click();
  await expect(page).toHaveURL(/\/tickets\?ansicht=beobachtet$/);
  await expect(tabs.getByRole("link", { name: "Beobachtet" })).toHaveAttribute("aria-current", "page");
  await expect(tabs.getByRole("link", { name: "Meine offenen" })).not.toHaveAttribute("aria-current", "page");
  await expect.poll(() => lastSearch(page)).toContain("watcher = currentUser()");

  await tabs.getByRole("link", { name: "Alle meine" }).click();
  await expect(page).toHaveURL(/ansicht=alle$/);
  await expect.poll(() => lastSearch(page)).toContain("reporter = currentUser()");

  await page.goBack();
  await expect(tabs.getByRole("link", { name: "Beobachtet" })).toHaveAttribute("aria-current", "page");
  await page.goBack();
  await expect(page).toHaveURL(/\/tickets$/);
  await expect(tabs.getByRole("link", { name: "Meine offenen" })).toHaveAttribute("aria-current", "page");
  await page.goForward();
  await expect(tabs.getByRole("link", { name: "Beobachtet" })).toHaveAttribute("aria-current", "page");
});

test("Unbekannte Ansicht fällt auf Meine offenen zurück", async ({ page }) => {
  await open(page, "/tickets?ansicht=unbekannt");
  await expect(presets(page).getByRole("link", { name: "Meine offenen" })).toHaveAttribute("aria-current", "page");
  expect(await lastSearch(page)).toContain("statusCategory != Done");
});

test("Ladezustand, leere Ansicht und Abfragefehler", async ({ page }) => {
  await open(page, "/tickets");
  await expect(page.getByRole("cell", { name: "DEMO-1", exact: true })).toBeVisible();
  await page.evaluate(() => {
    window.__qa.searchDelayMs = 800;
    window.__qa.emptySearch = true;
  });
  await presets(page).getByRole("link", { name: "Beobachtet" }).click();
  await expect(page.locator("[aria-busy]")).toBeVisible();
  await expect(page.getByText("Keine Vorgänge", { exact: true })).toBeVisible();

  await page.evaluate(() => {
    window.__qa.searchDelayMs = 0;
    window.__qa.failSearch = true;
  });
  await presets(page).getByRole("link", { name: "Alle meine" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Test: Abfrage nicht möglich" })).toBeVisible();
});

test("Ohne Anmeldung erscheint die Anmeldung statt der Ansichten", async ({ page }) => {
  await open(page, "/tickets", "calendar-offline");
  await expect(page.getByText("Nicht angemeldet", { exact: true })).toBeVisible();
  await expect(presets(page)).toHaveCount(0);
  await showMainNav(page);
});

test("Ein Lesefehler der Sitzung wird nicht als Abmeldung gezeigt", async ({ page }) => {
  await open(page, "/tickets", "session-error");
  await expect(page.getByText("Anmeldung konnte nicht geprüft werden", { exact: true })).toBeVisible();
  await expect(page.getByText("Nicht angemeldet", { exact: true })).toHaveCount(0);
  await page.evaluate(() => {
    window.__qa.sessionFailure = false;
  });
  await page.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(presets(page).getByRole("link", { name: "Meine offenen" })).toHaveAttribute("aria-current", "page");
});
