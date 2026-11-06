import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __qa: { failSearch: boolean; searches: string[] };
    __qaWorklogRule?: (key: string) => { status?: number; delayMs?: number; pageSize?: number } | null;
  }
}

const NOW = new Date("2026-11-06T15:00:00+01:00");
const SHOTS = process.env.TIME_TRACKING_SHOTS;

const open = async (page: Page, route: string, scenario = "time-tracking") => {
  await page.clock.setFixedTime(NOW);
  await page.goto(`/tests/browser/fixture.html?${new URLSearchParams({ route, scenario })}`);
};

const ranges = (page: Page) => page.getByRole("navigation", { name: "Zeitraum" });
const total = (page: Page) => page.getByLabel("Summen").locator("div").first();
const day = (page: Page, label: string) => page.getByRole("region", { name: label });

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("Woche zeigt nur eigene Buchungen mit Tages- und Wochensummen", async ({ page }) => {
  await open(page, "/zeiterfassung");
  await expect(page.getByRole("heading", { name: "Meine Zeiterfassung" })).toBeVisible();
  await expect(ranges(page).getByRole("link", { name: "Diese Woche" })).toHaveAttribute("aria-current", "page");
  await expect(total(page)).toContainText("Summe Woche");
  await expect(total(page)).toContainText("3 h 30 min");

  const monday = day(page, "Montag, 2. November");
  await expect(monday.getByLabel("Tagessumme 1 h 30 min")).toBeVisible();
  await expect(monday.getByRole("link")).toHaveCount(2);
  await expect(monday).toContainText("Anforderungen mit dem Team abgestimmt");
  await expect(page.getByText("Fremde Buchung")).toHaveCount(0);

  await expect(day(page, "Donnerstag, 5. November").getByLabel("Tagessumme 45 min")).toBeVisible();
  await expect(day(page, "Mittwoch, 4. November")).toContainText("Keine Buchungen");
  await expect(day(page, "Freitag, 6. November").getByLabel("Tagessumme 1 h 15 min")).toBeVisible();
  await expect(page.getByText("Unvollständig geladen")).toHaveCount(0);

  const jql = await page.evaluate(() => window.__qa.searches.find((entry) => entry.includes("worklogAuthor")) ?? "");
  expect(jql).toContain("worklogAuthor = currentUser()");

  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${test.info().project.name}-woche.png`, fullPage: true });
});

test("Zeitraum steht in der URL und folgt Zurück und Vorwärts", async ({ page }) => {
  await open(page, "/zeiterfassung");
  await expect(total(page)).toContainText("3 h 30 min");

  await ranges(page).getByRole("link", { name: "Letzte Woche" }).click();
  await expect(page).toHaveURL(/\/zeiterfassung\?datum=2026-10-26$/);
  await expect(total(page)).toContainText("2 h");
  await expect(page.getByText("Übergabe dokumentiert")).toBeVisible();

  await ranges(page).getByRole("link", { name: "Heute" }).click();
  await expect(page).toHaveURL(/zeitraum=tag$/);
  await expect(total(page)).toContainText("Summe Tag");
  await expect(total(page)).toContainText("1 h 15 min");

  await page.getByRole("button", { name: "Vorheriger Tag" }).click();
  await expect(page).toHaveURL(/zeitraum=tag&datum=2026-11-05$/);
  await expect(total(page)).toContainText("45 min");
  await expect(ranges(page).getByRole("link", { name: "Heute" })).not.toHaveAttribute("aria-current", "page");

  await page.goBack();
  await expect(ranges(page).getByRole("link", { name: "Heute" })).toHaveAttribute("aria-current", "page");
  await page.goBack();
  await expect(ranges(page).getByRole("link", { name: "Letzte Woche" })).toHaveAttribute("aria-current", "page");
  await expect(total(page)).toContainText("2 h");
  await page.goForward();
  await expect(total(page)).toContainText("1 h 15 min");
});

test("Leerer Zeitraum wird erklärt", async ({ page }) => {
  await open(page, "/zeiterfassung?datum=2026-09-01");
  await expect(page.getByText("Keine Buchungen in dieser Woche")).toBeVisible();
  await expect(total(page)).toContainText("0 min");
  await page.getByRole("button", { name: "Nächste Woche" }).click();
  await expect(page).toHaveURL(/datum=2026-09-07$/);
});

test("Buchung öffnet das Ticket im Zeitbereich", async ({ page }) => {
  await open(page, "/zeiterfassung");
  await day(page, "Freitag, 6. November").getByRole("link").first().click();
  await expect(page).toHaveURL(/\/issue\/DEMO-2\?bereich=zeit$/);
  await expect(page.getByRole("tab", { name: "Zeit" })).toHaveAttribute("aria-selected", "true");
});

test("Fehler eines Tickets lässt andere Summen stehen und lässt sich nachladen", async ({ page }) => {
  await page.addInitScript(() => {
    window.__qaWorklogRule = (key) => (key === "DEMO-2" ? { status: 503 } : null);
  });
  await open(page, "/zeiterfassung");
  const notice = page.getByRole("alert").filter({ hasText: "Unvollständig geladen" });
  await expect(notice).toContainText("Nicht geladen: DEMO-2.");
  await expect(total(page)).toContainText("geladener Stand");
  await expect(total(page)).toContainText("1 h 30 min");

  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${test.info().project.name}-teilweise.png`, fullPage: true });

  await page.evaluate(() => {
    window.__qaWorklogRule = undefined;
  });
  await notice.getByRole("button", { name: "Fehlende laden" }).click();
  await expect(notice).toHaveCount(0);
  await expect(total(page)).toContainText("3 h 30 min");
  await expect(total(page)).not.toContainText("geladener Stand");
});

test("Seitenlimit wird als unvollständig gemeldet", async ({ page }) => {
  await page.addInitScript(() => {
    window.__qaWorklogRule = () => ({ pageSize: 0 });
  });
  await open(page, "/zeiterfassung");
  await expect(page.getByRole("alert").filter({ hasText: "Nicht alle Buchungen geladen bei DEMO-1" })).toBeVisible();
});

test("Abfragefehler, Retry und fehlgeschlagene Aktualisierung", async ({ page }) => {
  await open(page, "/zeiterfassung");
  await expect(total(page)).toContainText("3 h 30 min");

  await page.evaluate(() => {
    window.__qa.failSearch = true;
  });
  await page.getByRole("button", { name: "Aktualisieren" }).click();
  const refresh = page.getByRole("alert").filter({ hasText: "Aktualisierung fehlgeschlagen" });
  await expect(refresh).toBeVisible();
  await expect(total(page)).toContainText("3 h 30 min");

  await ranges(page).getByRole("link", { name: "Letzte Woche" }).click();
  const failed = page.getByRole("alert").filter({ hasText: "Buchungen konnten nicht geladen werden" });
  await expect(failed).toContainText("Test: Abfrage nicht möglich");
  await page.evaluate(() => {
    window.__qa.failSearch = false;
  });
  await failed.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(total(page)).toContainText("2 h");
});

test("Ohne Anmeldung erscheint die Anmeldung", async ({ page }) => {
  await open(page, "/zeiterfassung", "calendar-offline");
  await expect(page.getByText("Nicht angemeldet", { exact: true })).toBeVisible();
  await expect(ranges(page)).toHaveCount(0);
});
