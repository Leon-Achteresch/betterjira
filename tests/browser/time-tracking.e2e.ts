import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __qa: { failSearch: boolean; searches: string[]; writes: unknown[] };
    __qaReads?: string[];
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
const searchField = (page: Page) => page.getByRole("searchbox", { name: "Buchungen durchsuchen" });
const matchTile = (page: Page) => page.getByLabel("Summen").locator("div").filter({ hasText: "Summe Treffer" });
const days = (page: Page) => page.getByRole("region", { name: /^(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag), / });

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

test.describe("Suche in eigenen Buchungen", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__qaReads = [];
    });
  });

  test("filtert Schlüssel, Titel und Kommentar ohne weitere Abfrage", async ({ page }) => {
    await open(page, "/zeiterfassung");
    await expect(total(page)).toContainText("3 h 30 min");
    await expect(page.getByText("Unvollständig geladen")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Aktualisieren" })).toBeEnabled();
    const reads = await page.evaluate(() => window.__qaReads?.length ?? 0);

    await searchField(page).fill("Review");
    await expect(page).toHaveURL(/\/zeiterfassung\?q=Review$/);
    await expect(total(page)).toContainText("Summe Woche");
    await expect(total(page)).toContainText("3 h 30 min");
    await expect(matchTile(page)).toContainText("1 h 15 min");
    await expect(matchTile(page)).toContainText("1 von 4 Buchungen");
    await expect(days(page)).toHaveCount(1);
    await expect(day(page, "Freitag, 6. November").getByLabel("Treffer am Tag 1 h 15 min")).toBeVisible();

    await searchField(page).fill("demo-1");
    await expect(matchTile(page)).toContainText("1 h 30 min");
    await expect(days(page)).toHaveCount(1);
    await expect(day(page, "Montag, 2. November").getByRole("link")).toHaveCount(2);

    await searchField(page).fill("Tastaturbedienung");
    await expect(matchTile(page)).toContainText("2 von 4 Buchungen");
    await expect(matchTile(page)).toContainText("2 h");
    await expect(days(page)).toHaveCount(2);
    await expect(day(page, "Montag, 2. November")).toHaveCount(0);

    await searchField(page).fill("team abgestimmt");
    await expect(page.getByText("Anforderungen mit dem Team abgestimmt")).toBeVisible();
    await expect(matchTile(page)).toContainText("1 von 4 Buchungen");

    await searchField(page).fill('".*([%&');
    await expect(page.getByText('Keine Treffer für „".*([%&“')).toBeVisible();
    await expect(total(page)).toContainText("3 h 30 min");
    await expect(days(page)).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => new URL(location.href).searchParams.get("q"))).toBe('".*([%&');

    await page.getByRole("button", { name: "Suche zurücksetzen" }).click();
    await expect(page).toHaveURL(/\/zeiterfassung$/);
    await expect(searchField(page)).toHaveValue("");
    await expect(matchTile(page)).toHaveCount(0);
    await expect(days(page)).toHaveCount(7);
    await expect(day(page, "Montag, 2. November").getByLabel("Tagessumme 1 h 30 min")).toBeVisible();

    expect(await page.evaluate(() => window.__qaReads?.length ?? 0)).toBe(reads);
    expect(await page.evaluate(() => window.__qa.writes.length)).toBe(0);
  });

  test("echter Leerzustand bleibt ohne Reset, Zeitraumwechsel erhält die Suche", async ({ page }) => {
    await open(page, "/zeiterfassung?datum=2026-09-01&q=Review");
    await expect(page.getByText("Keine Buchungen in dieser Woche")).toBeVisible();
    await expect(page.getByRole("button", { name: "Suche zurücksetzen" })).toHaveCount(0);
    await expect(searchField(page)).toHaveValue("Review");

    await page.getByRole("button", { name: "Nächste Woche" }).click();
    await expect(page).toHaveURL(/datum=2026-09-07&q=Review$/);
    await ranges(page).getByRole("link", { name: "Diese Woche" }).click();
    await expect(page).toHaveURL(/\/zeiterfassung\?q=Review$/);
    await expect(matchTile(page)).toContainText("1 h 15 min");
    await ranges(page).getByRole("link", { name: "Letzte Woche" }).click();
    await expect(page).toHaveURL(/datum=2026-10-26&q=Review$/);
    await expect(page.getByText("Keine Treffer für „Review“")).toBeVisible();
    await expect(total(page)).toContainText("2 h");
  });

  test("URL-Verlauf: Eingabe ersetzt, Zurück/Vorwärts und erneutes Öffnen stellen her", async ({ page }) => {
    await open(page, "/zeiterfassung");
    await expect(total(page)).toContainText("3 h 30 min");
    await searchField(page).fill("Rev");
    await searchField(page).fill("Review");

    await ranges(page).getByRole("link", { name: "Letzte Woche" }).click();
    await expect(page).toHaveURL(/datum=2026-10-26&q=Review$/);
    await searchField(page).fill("Übergabe");
    await expect(page.getByText("Übergabe dokumentiert")).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/zeiterfassung\?q=Review$/);
    await expect(searchField(page)).toHaveValue("Review");
    await expect(matchTile(page)).toContainText("1 h 15 min");

    await page.goForward();
    await expect(page).toHaveURL(/datum=2026-10-26&q=/);
    await expect(searchField(page)).toHaveValue("Übergabe");
    await expect(page.getByText("Übergabe dokumentiert")).toBeVisible();

    await open(page, "/zeiterfassung?q=Review");
    await expect(searchField(page)).toHaveValue("Review");
    await expect(matchTile(page)).toContainText("1 h 15 min");

    await open(page, "/zeiterfassung?q=%20%20");
    await expect(total(page)).toContainText("3 h 30 min");
    await expect(searchField(page)).toHaveValue("");
    await expect(matchTile(page)).toHaveCount(0);
  });

  test("Tastatur: Escape leert, Reset per Enter", async ({ page }) => {
    await open(page, "/zeiterfassung");
    await expect(total(page)).toContainText("3 h 30 min");
    await searchField(page).focus();
    await expect(searchField(page)).toBeFocused();
    await page.keyboard.type("Review");
    await expect(page).toHaveURL(/q=Review$/);
    await page.keyboard.press("Escape");
    await expect(searchField(page)).toHaveValue("");
    await expect(page).toHaveURL(/\/zeiterfassung$/);

    await page.keyboard.type("gibt es nicht");
    const reset = page.getByRole("button", { name: "Suche zurücksetzen" });
    await expect(reset).toBeVisible();
    await reset.focus();
    await expect(reset).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(searchField(page)).toHaveValue("");
    await expect(days(page)).toHaveCount(7);
  });

  test("unvollständige Daten behalten den Hinweis", async ({ page }) => {
    await page.addInitScript(() => {
      window.__qaWorklogRule = (key) => (key === "DEMO-2" ? { status: 503 } : null);
    });
    await open(page, "/zeiterfassung?q=Review");
    const notice = page.getByRole("alert").filter({ hasText: "Unvollständig geladen" });
    await expect(notice).toContainText("Nicht geladen: DEMO-2.");
    await expect(notice).toContainText("Die Summen zeigen nur den geladenen Stand.");
    await expect(total(page)).toContainText("geladener Stand");
    await expect(matchTile(page)).toContainText("Summe Treffer (geladener Stand)");
    await expect(matchTile(page)).toContainText("geladenen Buchungen");
    await expect(page.getByText("Keine Treffer für „Review“")).toBeVisible();
  });

  test("Darstellung: Desktop hell und 390 px dunkel mit reduzierter Bewegung", async ({ page }, info) => {
    const narrow = info.project.name !== "desktop";
    if (narrow) await page.setViewportSize({ width: 390, height: 844 });
    await open(page, "/zeiterfassung?q=demo");
    await expect(matchTile(page)).toContainText("3 h 30 min");
    await expect(days(page)).toHaveCount(3);
    const state = await page.evaluate(async () => {
      await document.fonts.load('16px "Geist Variable"');
      await document.fonts.ready;
      return {
        loaded: [...document.fonts].some((face) => face.family.includes("Geist") && face.status === "loaded"),
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        dark: document.documentElement.classList.contains("dark"),
        reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
      };
    });
    expect(state.loaded).toBe(true);
    expect(state.overflow).toBeLessThanOrEqual(0);
    expect(state.dark).toBe(narrow);
    expect(state.reduced).toBe(narrow);
    expect((await searchField(page).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(32);
    await page.mouse.move(0, 0);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${narrow ? "390-dunkel" : "desktop-hell"}-suche.png`, fullPage: true });
  });
});
