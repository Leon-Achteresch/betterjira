import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __qa: {
      outlook: {
        calls: { action: string }[];
        failNext: boolean;
        failureMessage?: string | null;
        events: { rolloutId?: string }[];
      };
    };
  }
}

const storageKey = "betterjira:calendar:rollouts:v1";

const openCalendar = async (page: Page) => {
  await page.goto("/tests/browser/fixture.html?route=/kalender");
  await expect(page.getByRole("heading", { name: "Kalender", exact: true })).toBeVisible();
};

const createRollout = async (page: Page, title = "Produktion Release 2.4") => {
  await page.getByRole("button", { name: "Rollout planen", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Titel", { exact: true }).fill(title);
  await dialog.getByLabel("Beginn", { exact: true }).fill("2026-11-06");
  await dialog.getByLabel("Uhrzeit Beginn", { exact: true }).fill("14:00");
  await dialog.getByLabel("Ende", { exact: true }).fill("2026-11-06");
  await dialog.getByLabel("Uhrzeit Ende", { exact: true }).fill("15:00");
  await dialog.getByRole("option").filter({ hasText: "DEMO-1" }).click();
  await dialog.getByLabel("Notizen").fill("Rollout prüfen und Monitoring beobachten");
  await dialog.getByRole("button", { name: "Anlegen", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  return page.locator("article").filter({ hasText: title });
};

const connectOutlook = async (page: Page) => {
  await page.getByRole("button", { name: "Outlook-Verbindung: Outlook verbinden", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Keine App-ID oder zusätzliche betterjira-Anmeldung nötig")).toBeVisible();
  await dialog.getByRole("button", { name: "Outlook verbinden", exact: true }).click();
  await expect(dialog.getByText("outlook@example.com", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Schließen", exact: true }).click();
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => { throw error; });
  await page.clock.setFixedTime(new Date("2026-11-06T12:00:00.000Z"));
});

test("Rollout mit Ticket anlegen, nach Neuladen bearbeiten und löschen", async ({ page }) => {
  await openCalendar(page);
  const article = await createRollout(page);
  await expect(article.getByText("DEMO-1", { exact: true })).toBeVisible();
  await expect(article.getByText("14:00 – 15:00")).toBeVisible();
  await openCalendar(page);
  await expect(article).toBeVisible();
  await article.getByRole("button", { name: "Bearbeiten", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Titel", { exact: true })).toHaveValue("Produktion Release 2.4");
  await dialog.getByLabel("Titel", { exact: true }).fill("Release nachgezogen");
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  const edited = page.locator("article").filter({ hasText: "Release nachgezogen" });
  await expect(edited).toBeVisible();
  await edited.getByRole("button", { name: "Löschen", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Löschen", exact: true }).click();
  await expect(edited).not.toBeVisible();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "[]"), storageKey)).toEqual([]);
});

test("Formular validiert Titel und Zeitraum und bewahrt Eingaben", async ({ page }) => {
  await openCalendar(page);
  await page.getByRole("button", { name: "Rollout planen", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Anlegen", exact: true }).click();
  await expect(dialog.getByText("Bitte einen Titel angeben.")).toBeVisible();
  await dialog.getByLabel("Titel", { exact: true }).fill("Validierungstest");
  await dialog.getByLabel("Uhrzeit Ende", { exact: true }).fill("01:00");
  await dialog.getByRole("button", { name: "Anlegen", exact: true }).click();
  await expect(dialog.getByText("Das Ende muss nach dem Beginn liegen.")).toBeVisible();
  await expect(dialog.getByLabel("Titel", { exact: true })).toHaveValue("Validierungstest");
});

test("Monatswechsel, Tagesauswahl und Heute funktionieren ohne Seitenüberlauf", async ({ page }, testInfo) => {
  await openCalendar(page);
  await expect(page.getByRole("heading", { name: "November 2026", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Nächster Monat", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Dezember 2026", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Vorheriger Monat", exact: true }).click();
  await page.getByRole("button", { name: "Samstag, 7. November", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Samstag, 7. November", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Heute", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Freitag, 6. November", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("calendar.png"), fullPage: true });
});

test("Outlook ohne App-ID verbinden, Termine lesen, Rollout synchronisieren und öffnen", async ({ page }) => {
  await openCalendar(page);
  const article = await createRollout(page);
  await connectOutlook(page);
  await expect(page.getByText("Externer Outlook-Termin").last()).toBeVisible();
  await article.getByRole("button", { name: "Mit Outlook synchronisieren", exact: true }).click();
  await expect(article.getByText("In Outlook eingetragen", { exact: true })).toBeVisible();
  await article.getByRole("button", { name: "Erneut synchronisieren", exact: true }).click();
  await article.getByRole("button", { name: "In Outlook öffnen", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__qa.outlook.calls.filter((call) => call.action === "open").length)).toBe(1);
  expect(await page.evaluate(() => window.__qa.outlook.events.filter((event) => !!event.rolloutId).length)).toBe(1);
});

test("Outlook-Fehler beim Verbinden und Synchronisieren werden gezeigt, lokale Daten bleiben erhalten", async ({ page }) => {
  await openCalendar(page);
  const article = await createRollout(page);
  await page.evaluate(() => { window.__qa.outlook.failNext = true; });
  await page.getByRole("button", { name: "Outlook-Verbindung: Outlook verbinden", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Outlook verbinden", exact: true }).click();
  await expect(dialog.getByText("Verbindung nicht möglich")).toBeVisible();
  await dialog.getByRole("button", { name: "Outlook verbinden", exact: true }).click();
  await expect(dialog.getByText("outlook@example.com", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Schließen", exact: true }).click();
  await page.evaluate(() => { window.__qa.outlook.failNext = true; });
  await article.getByRole("button", { name: "Mit Outlook synchronisieren", exact: true }).click();
  await expect(page.getByText("Synchronisierung fehlgeschlagen", { exact: true })).toBeVisible();
  await expect(article.getByText("Nur lokal", { exact: true })).toBeVisible();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "[]").length, storageKey)).toBe(1);
});

test("Ticketlink öffnet das verknüpfte Jira-Ticket", async ({ page }) => {
  await openCalendar(page);
  const article = await createRollout(page);
  await article.getByRole("button", { name: "DEMO-1", exact: true }).click();
  await expect(page).toHaveURL(/\/issue\/DEMO-1/);
});

test("Kalender ist ohne Jira-Anmeldung erreichbar und speichert lokale Rollouts", async ({ page }) => {
  await page.goto("/tests/browser/fixture.html?scenario=calendar-offline&route=/kalender");
  await expect(page.getByRole("heading", { name: "Kalender", exact: true })).toBeVisible();
  const calendarLink = page.getByRole("link", { name: "Kalender", exact: true });
  if (!await calendarLink.isVisible()) {
    await page.getByRole("button", { name: "Toggle Sidebar", exact: true }).click();
    await expect(calendarLink).toBeVisible();
    await page.keyboard.press("Escape");
  } else {
    await expect(calendarLink).toBeVisible();
  }
  await page.getByRole("button", { name: "Rollout planen", exact: true }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Melde dich bei Jira an, um Tickets zu suchen und zu verknüpfen.")).toBeVisible();
  await dialog.getByLabel("Titel", { exact: true }).fill("Offline-Rollout");
  await dialog.getByRole("button", { name: "Anlegen", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("article").filter({ hasText: "Offline-Rollout" })).toBeVisible();
});

test("Fehlgeschlagenes Outlook-Löschen erhält den Rollout und erlaubt erneutes Löschen", async ({ page }) => {
  await openCalendar(page);
  const article = await createRollout(page);
  await connectOutlook(page);
  await article.getByRole("button", { name: "Mit Outlook synchronisieren", exact: true }).click();
  await expect(article.getByText("In Outlook eingetragen", { exact: true })).toBeVisible();
  await page.evaluate(() => { window.__qa.outlook.failNext = true; });
  await article.getByRole("button", { name: "Löschen", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button", { name: "Löschen", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Der Rollout wurde nicht gelöscht.");
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "[]").length, storageKey)).toBe(1);
  await dialog.getByRole("button", { name: "Löschen", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(article).not.toBeVisible();
});

test("Outlook trennen entfernt keine Rollouts und blendet externe Termine aus", async ({ page }) => {
  await openCalendar(page);
  const article = await createRollout(page);
  await connectOutlook(page);
  await expect(page.getByText("Externer Outlook-Termin").last()).toBeVisible();
  await page.getByRole("button", { name: /^Outlook-Verbindung:/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Trennen", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Outlook verbinden", exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Schließen", exact: true }).click();
  await expect(page.getByText("Externer Outlook-Termin")).toHaveCount(0);
  await expect(article).toBeVisible();
});

test("Office-Mandantenfehler und fehlende Outlook-Sitzung werden ohne gespeicherte Verbindung erklärt", async ({ page }) => {
  await openCalendar(page);
  await page.getByRole("button", { name: "Outlook-Verbindung: Outlook verbinden", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Klassisches Outlook ist geöffnet und dein Kalender dort erreichbar")).toBeVisible();
  await page.evaluate(() => {
    window.__qa.outlook.failNext = true;
    window.__qa.outlook.failureMessage = "AADSTS50020: User account does not exist in tenant Schule (Microsoft Office)";
  });
  await dialog.getByRole("button", { name: "Outlook verbinden", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Konto sowie Organisation direkt im klassischen Outlook prüfen");
  await page.evaluate(() => {
    window.__qa.outlook.failNext = true;
    window.__qa.outlook.failureMessage = "Bitte klassisches Outlook selbst oeffnen und danach erneut verbinden.";
  });
  await dialog.getByRole("button", { name: "Outlook verbinden", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Bitte klassisches Outlook selbst oeffnen");
  expect(await page.evaluate(() => localStorage.getItem("betterjira:calendar:outlook:v1"))).toBeNull();
});
