import { expect, test, type Page } from "@playwright/test";

const open = (page: Page, route: string, scenario = "notifications") =>
  page.goto(`/tests/browser/fixture.html?${new URLSearchParams({ route, scenario })}`);

const kindTab = (page: Page, name: RegExp) => page.getByRole("tablist", { name: "Art der Benachrichtigung" }).getByRole("tab", { name });
const filter = (page: Page, name: "Alle" | "Ungelesen") => page.getByRole("radiogroup", { name: "Lesestatus" }).getByRole("radio", { name });
const inbox = (page: Page) => page.locator("#app-scroll");
const inboxRows = (page: Page) => inbox(page).getByRole("button", { name: /^DEMO-\d+ öffnen$/ });
const bell = (page: Page) => page.getByRole("button", { name: /^Benachrichtigungen(, \d+ ungelesen)?$/ });
const row = (page: Page, key: string) => inbox(page).getByRole("listitem").filter({ has: page.getByRole("button", { name: `${key} öffnen` }) });
const search = (page: Page) => page.getByRole("searchbox", { name: "Benachrichtigungen durchsuchen" });

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("Direktlink übernimmt Ansicht und Filter aus der URL und folgt Zurück und Vorwärts", async ({ page }) => {
  await open(page, "/benachrichtigungen?ansicht=beobachtet&nur=ungelesen");
  await expect(page.getByRole("heading", { name: "Benachrichtigungen", exact: true })).toBeVisible();
  await expect(kindTab(page, /Beobachtet/)).toHaveAttribute("aria-selected", "true");
  await expect(filter(page, "Ungelesen")).toHaveAttribute("aria-checked", "true");
  await expect(inboxRows(page)).toHaveCount(6);
  await expect(page.getByText(/keine vollständige Jira-Inbox/)).toBeVisible();

  await kindTab(page, /Direkt/).click();
  await expect(page).toHaveURL(/\/benachrichtigungen\?nur=ungelesen$/);
  await expect(inboxRows(page)).toHaveCount(2);

  await filter(page, "Alle").click();
  await expect(page).toHaveURL(/\/benachrichtigungen$/);
  await expect(inboxRows(page)).toHaveCount(3);

  await page.goBack();
  await expect(filter(page, "Ungelesen")).toHaveAttribute("aria-checked", "true");
  await page.goBack();
  await expect(kindTab(page, /Beobachtet/)).toHaveAttribute("aria-selected", "true");
  await page.goForward();
  await expect(kindTab(page, /Direkt/)).toHaveAttribute("aria-selected", "true");
});

test("Lesestatus ist zwischen Seite und Glocke geteilt, Zähler passen zum Bereich", async ({ page }) => {
  await open(page, "/benachrichtigungen");
  await expect(bell(page)).toHaveAccessibleName("Benachrichtigungen, 9 ungelesen");
  await expect(kindTab(page, /Direkt/)).toHaveText("Direkt3");
  await expect(kindTab(page, /Beobachtet/)).toHaveText("Beobachtet6");

  await row(page, "DEMO-2").getByRole("button", { name: "Als gelesen markieren" }).click();
  await expect(bell(page)).toHaveAccessibleName("Benachrichtigungen, 8 ungelesen");
  await expect(kindTab(page, /Direkt/)).toHaveText("Direkt2");

  await bell(page).click();
  const popover = page.locator("[data-slot=popover-content], [role=dialog]").filter({ hasText: "Alle Benachrichtigungen anzeigen" });
  const bellRow = (key: string) => popover.getByRole("listitem").filter({ has: page.getByRole("button", { name: `${key} öffnen` }) });
  await expect(bellRow("DEMO-2").getByRole("button", { name: "Als ungelesen markieren" })).toBeVisible();
  await bellRow("DEMO-1").getByRole("button", { name: "Als gelesen markieren" }).click();
  await page.keyboard.press("Escape");

  await expect(kindTab(page, /Direkt/)).toHaveText("Direkt");
  await expect(page.getByRole("button", { name: /in „Direkt“ als gelesen markieren/ })).toBeDisabled();

  await kindTab(page, /Beobachtet/).click();
  await page.getByRole("button", { name: "6 ungelesene in „Beobachtet“ als gelesen markieren" }).click();
  await expect(bell(page)).toHaveAccessibleName("Benachrichtigungen");
  await page.getByRole("button", { name: "Rückgängig" }).click();
  await expect(bell(page)).toHaveAccessibleName("Benachrichtigungen, 6 ungelesen");
});

test("Lokale Suche filtert erfasste Inhalte, steht in der URL und erklärt leere Treffer", async ({ page }) => {
  await open(page, "/benachrichtigungen");
  await search(page).fill("zugewiesen");
  await expect(page).toHaveURL(/suche=zugewiesen/);
  await expect(inboxRows(page)).toHaveCount(1);
  await expect(row(page, "DEMO-2")).toBeVisible();
  await expect(page.getByRole("button", { name: "1 ungelesene in Treffer in „Direkt“ als gelesen markieren" })).toBeEnabled();

  await search(page).fill("Übergabe kim");
  await expect(inboxRows(page)).toHaveCount(1);
  await expect(row(page, "DEMO-3")).toBeVisible();

  await search(page).fill("nichtvorhanden");
  await expect(page.getByText("Keine Treffer", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Suche zurücksetzen" }).click();
  await expect(page).toHaveURL(/\/benachrichtigungen$/);
  await expect(inboxRows(page)).toHaveCount(3);
});

test("Gelesene Inbox, fremdes Konto und abgemeldete Sitzung zeigen keine falschen Einträge", async ({ page }) => {
  await open(page, "/benachrichtigungen?nur=ungelesen");
  await page.getByRole("button", { name: "3 ungelesene in „Direkt“ als gelesen markieren" }).click();
  await expect(page.getByText("Alles gelesen", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Alle anzeigen" }).click();
  await expect(page).toHaveURL(/\/benachrichtigungen$/);

  await open(page, "/benachrichtigungen", "notifications-foreign");
  await expect(page.getByText("Noch keine Aktivität erfasst", { exact: true })).toBeVisible();
  await expect(inboxRows(page)).toHaveCount(0);
  await expect(bell(page)).toHaveAccessibleName("Benachrichtigungen");

  await open(page, "/benachrichtigungen", "calendar-offline");
  await expect(page.getByText("Nicht angemeldet", { exact: true })).toBeVisible();
  await expect(inboxRows(page)).toHaveCount(0);
});

test("Fehlgeschlagene Prüfung zeigt den lokalen Stand mit Wiederholen", async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { __qaSearchRule: (jql: string) => (jql.includes("updated >=") ? { status: 503 } : {}) });
  });
  await open(page, "/benachrichtigungen");
  await expect(page.getByText("Jira konnte zuletzt nicht geprüft werden", { exact: true })).toBeVisible();
  await expect(inboxRows(page)).toHaveCount(3);
  await page.evaluate(() => Object.assign(window, { __qaSearchRule: undefined }));
  await page.getByRole("button", { name: "Erneut prüfen" }).click();
  await expect(page.getByText("Jira konnte zuletzt nicht geprüft werden", { exact: true })).toHaveCount(0);
});

test("Schmal per Tastatur bedienbar, ohne Seitenüberlauf, Ticket öffnet und gilt als gelesen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "/benachrichtigungen");
  await kindTab(page, /Direkt/).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/ansicht=beobachtet/);
  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(/\/benachrichtigungen$/);

  await search(page).focus();
  await page.keyboard.type("DEMO-1");
  await expect(inboxRows(page)).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(search(page)).toHaveValue("");

  const overflow = await inbox(page).evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  await page.getByRole("button", { name: "DEMO-1 öffnen" }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/issue\/DEMO-1$/);
  await page.goBack();
  await expect(row(page, "DEMO-1").getByRole("button", { name: "Als ungelesen markieren" })).toBeVisible();
});
