import { expect, test, type Page, type TestInfo } from "@playwright/test";

type ActivityIssue = { id: string; key: string; fields: Record<string, unknown> };
type SearchRule = { delayMs?: number; status?: number; issues?: ActivityIssue[]; waitFor?: Promise<void> };

declare global {
  interface Window {
    __qaSearchRule?: (jql: string, pageToken: string | null) => SearchRule;
    __qa: { searches: string[] };
    __qaActivity?: { issues?: ActivityIssue[]; delayMs?: number; status?: number };
    __qaActivityGate?: Promise<void>;
    __qaReleaseActivity?: () => void;
  }
}

const open = (page: Page, route: string, scenario = "notifications") =>
  page.goto(`/tests/browser/fixture.html?${new URLSearchParams({ route, scenario })}`);

const inbox = (page: Page) => page.locator("#app-scroll");
const inboxRows = (page: Page) => inbox(page).getByRole("button", { name: /^DEMO-\d+ öffnen$/ });
const row = (page: Page, key: string) => inbox(page).getByRole("listitem").filter({ has: page.getByRole("button", { name: `${key} öffnen` }) });
const checkNow = (page: Page) => page.getByRole("button", { name: "Jetzt prüfen", exact: true });
const syncStatus = (page: Page) => page.getByRole("status").filter({ hasText: /Prüft|Offline|Sitzung/ });
const failure = (page: Page) => page.getByText("Jira konnte zuletzt nicht geprüft werden", { exact: true });
const lastChecked = (page: Page) => page.getByText(/zuletzt erfolgreich geprüft/).locator("time").getAttribute("datetime");
const activityCalls = (page: Page) => page.evaluate(() => window.__qa.searches.filter((jql) => jql.includes("updated >=")).length);
const scrollTop = (page: Page) => inbox(page).evaluate((element) => element.scrollTop);

const setActivity = (page: Page, activity: Window["__qaActivity"]) => page.evaluate((value) => (window.__qaActivity = value), activity);

const comment = (page: Page, key: string, id: string, text: string, involved = true) =>
  page.evaluate(
    ({ key, id, text, involved }) => {
      const avatarUrls = { "48x48": "/logo.svg" };
      const me = { accountId: "qa-user", displayName: "Alex Beispiel", avatarUrls };
      const kim = { accountId: "qa-kim", displayName: "Kim Probe", avatarUrls };
      return {
        id: `qa-activity-${id}`,
        key,
        fields: {
          summary: `QA-Testticket ${key}`,
          created: "2026-01-01T08:00:00.000+0000",
          reporter: involved ? me : kim,
          assignee: null,
          comment: {
            comments: [
              {
                id,
                created: new Date().toISOString(),
                author: kim,
                body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] },
              },
            ],
          },
        },
      };
    },
    { key, id, text, involved },
  );

const setDeviceOnline = (page: Page, online: boolean) =>
  page.evaluate((value) => {
    Object.defineProperty(Navigator.prototype, "onLine", { configurable: true, get: () => value });
    window.dispatchEvent(new Event(value ? "online" : "offline"));
  }, online);

const pollAutomatically = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  const dir = process.env.NOTIFICATION_REFRESH_SHOTS;
  if (!dir || testInfo.project.name !== "desktop") return;
  expect(await page.evaluate(() => document.fonts.ready.then(() => document.fonts.check('14px "Geist Variable"')))).toBe(true);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dir}/${name}.png` });
};

const ready = async (page: Page) => {
  await expect(checkNow(page)).toHaveAttribute("aria-disabled", "false");
  await expect(lastChecked(page)).resolves.toBeTruthy();
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.addInitScript(() => {
    window.__qaSearchRule = (jql) => {
      const activity = window.__qaActivity;
      if (!jql.includes("updated >=") || !activity) return {};
      return { delayMs: activity.delayMs, status: activity.status, issues: activity.issues, waitFor: window.__qaActivityGate };
    };
  });
});

test("Jetzt prüfen holt neue Aktivität und aktualisiert den letzten erfolgreichen Stand", async ({ page }, testInfo) => {
  await open(page, "/benachrichtigungen");
  await ready(page);
  await expect(inboxRows(page)).toHaveCount(3);
  await expect(page.getByText(/keine vollständige Jira-Inbox/)).toBeVisible();
  const before = await lastChecked(page);
  await shot(page, testInfo, "01-bereit");

  await setActivity(page, { issues: [await comment(page, "DEMO-2", "new-1", "Neue Testaktivität nach manueller Prüfung")], delayMs: 900 });
  await checkNow(page).click();
  await expect(checkNow(page)).toHaveAttribute("aria-busy", "true");
  await expect(syncStatus(page)).toHaveText("Prüft auf neue Aktivität …");
  await expect(inboxRows(page)).toHaveCount(3);
  await shot(page, testInfo, "02-pruefung-laeuft");

  await expect(row(page, "DEMO-2")).toContainText("Neue Testaktivität nach manueller Prüfung");
  await expect(checkNow(page)).toHaveAttribute("aria-busy", "false");
  await expect(syncStatus(page)).toHaveCount(0);
  const after = await lastChecked(page);
  expect(Date.parse(after!)).toBeGreaterThan(Date.parse(before!));
  await expect(page.getByText(/zuletzt erfolgreich geprüft/)).toBeVisible();
});

test("Doppelklick, Tastatur und automatischer Poll während der Prüfung starten keinen zweiten Abruf", async ({ page }) => {
  await open(page, "/benachrichtigungen");
  await ready(page);
  const calls = await activityCalls(page);

  await setActivity(page, { issues: [await comment(page, "DEMO-2", "new-2", "Genau einmal erfasst")] });
  await page.evaluate(() => {
    window.__qaActivityGate = new Promise<void>((resolve) => { window.__qaReleaseActivity = resolve; });
  });
  await pollAutomatically(page);
  await expect(checkNow(page)).toHaveAttribute("aria-busy", "true");
  await checkNow(page).dblclick({ force: true });
  await checkNow(page).focus();
  await page.keyboard.press("Enter");
  await pollAutomatically(page);

  expect(await activityCalls(page)).toBe(calls + 1);
  await expect(checkNow(page)).toHaveAttribute("aria-busy", "true");
  await page.evaluate(() => {
    window.__qaReleaseActivity?.();
    delete window.__qaActivityGate;
    delete window.__qaReleaseActivity;
  });

  await expect(row(page, "DEMO-2")).toContainText("Genau einmal erfasst");
  await expect(checkNow(page)).toHaveAttribute("aria-busy", "false");
  expect(await activityCalls(page)).toBe(calls + 2);
  await expect(inbox(page).getByText("Genau einmal erfasst")).toHaveCount(1);

  await checkNow(page).click();
  await expect(checkNow(page)).toHaveAttribute("aria-busy", "false");
  await expect.poll(() => activityCalls(page)).toBe(calls + 4);
  await expect(inbox(page).getByText("Genau einmal erfasst")).toHaveCount(1);
});

test("Fehlgeschlagener Abruf behält Daten, Filter, Suche, Lesestatus und Scrollposition, Retry holt nach", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1100, height: 560 });
  await open(page, "/benachrichtigungen?ansicht=beobachtet&suche=Priorit%C3%A4t");
  await ready(page);
  await inbox(page).getByRole("button", { name: "2 weitere Tickets anzeigen", exact: true }).click();
  await expect(inboxRows(page)).toHaveCount(9);
  await row(page, "DEMO-5").getByRole("button", { name: "Als gelesen markieren" }).click();
  await expect(row(page, "DEMO-5").getByRole("button", { name: "Als ungelesen markieren" })).toBeVisible();
  await inbox(page).evaluate((element) => element.scrollTo({ top: 120 }));
  await expect.poll(() => scrollTop(page)).toBeGreaterThan(60);
  await expect(checkNow(page)).toBeInViewport();
  const scrolled = await scrollTop(page);
  const before = await lastChecked(page);
  const url = page.url();

  await setActivity(page, { status: 503 });
  await checkNow(page).click();
  await expect(failure(page)).toBeVisible();
  await expect(page.getByText(/Test: Jira antwortet mit 503/)).toBeVisible();
  await expect(page.getByText(/errorMessages|\{"/)).toHaveCount(0);
  await expect(checkNow(page)).toHaveAttribute("aria-disabled", "false");
  expect(page.url()).toBe(url);
  await expect(page.getByRole("searchbox", { name: "Benachrichtigungen durchsuchen" })).toHaveValue("Priorität");
  await expect(inboxRows(page)).toHaveCount(9);
  await expect(row(page, "DEMO-5").getByRole("button", { name: "Als ungelesen markieren" })).toBeVisible();
  expect(Math.abs((await scrollTop(page)) - scrolled)).toBeLessThanOrEqual(2);
  expect(await lastChecked(page)).toBe(before);
  await inbox(page).evaluate((element) => element.scrollTo({ top: 0 }));
  await shot(page, testInfo, "03-fehler-mit-daten");

  await setActivity(page, { issues: [await comment(page, "DEMO-12", "new-3", "Priorität nach Retry erfasst", false)] });
  await page.getByRole("button", { name: "Erneut prüfen" }).click();
  await expect(failure(page)).toHaveCount(0);
  await expect(row(page, "DEMO-12")).toContainText("Priorität nach Retry erfasst");
  await expect(inboxRows(page)).toHaveCount(9);
  await expect(row(page, "DEMO-5").getByRole("button", { name: "Als ungelesen markieren" })).toBeVisible();
  expect(page.url()).toBe(url);
  expect(Date.parse((await lastChecked(page))!)).toBeGreaterThan(Date.parse(before!));
});

test("Offline und pausiert prüft nicht scheinbar, setzt nach Verbindung fort", async ({ page }, testInfo) => {
  await open(page, "/benachrichtigungen");
  await ready(page);
  const before = await lastChecked(page);
  await setActivity(page, { issues: [await comment(page, "DEMO-1", "new-4", "Nach Verbindung erfasst")] });

  await setDeviceOnline(page, false);
  await expect(syncStatus(page)).toHaveText("Offline, Prüfung wartet auf Verbindung");
  await expect(checkNow(page)).toHaveAttribute("aria-disabled", "true");
  const calls = await activityCalls(page);
  await checkNow(page).click({ force: true });
  await pollAutomatically(page);
  await page.waitForTimeout(300);
  await expect(checkNow(page)).toHaveAttribute("aria-busy", "false");
  await expect(syncStatus(page)).toHaveText("Offline, Prüfung wartet auf Verbindung");
  expect(await activityCalls(page)).toBe(calls);
  expect(await lastChecked(page)).toBe(before);
  await expect(inboxRows(page)).toHaveCount(3);
  await shot(page, testInfo, "04-offline");

  await setDeviceOnline(page, true);
  await expect(row(page, "DEMO-1")).toContainText("Nach Verbindung erfasst");
  await expect(syncStatus(page)).toHaveCount(0);
  await expect(checkNow(page)).toHaveAttribute("aria-disabled", "false");
  expect(Date.parse((await lastChecked(page))!)).toBeGreaterThan(Date.parse(before!));
});

test("Abgemeldet gibt es keine Prüfung", async ({ page }) => {
  await open(page, "/benachrichtigungen", "calendar-offline");
  await expect(page.getByText("Nicht angemeldet", { exact: true })).toBeVisible();
  await expect(checkNow(page)).toHaveCount(0);
  await expect(inboxRows(page)).toHaveCount(0);
});

test("Per Tastatur erreichbar, Fokus bleibt auf der Aktion", async ({ page }) => {
  await open(page, "/benachrichtigungen");
  await ready(page);
  await page.getByRole("button", { name: "3 ungelesene in „Direkt“ als gelesen markieren" }).focus();
  await page.keyboard.press("Tab");
  await expect(checkNow(page)).toBeFocused();

  await setActivity(page, { issues: [await comment(page, "DEMO-3", "new-5", "Per Tastatur geprüft")] });
  await page.keyboard.press("Enter");
  await expect(row(page, "DEMO-3")).toContainText("Per Tastatur geprüft");
  await expect(checkNow(page)).toBeFocused();

  await setActivity(page, { issues: [await comment(page, "DEMO-3", "new-6", "Mit Leertaste geprüft")] });
  await page.keyboard.press("Space");
  await expect(row(page, "DEMO-3")).toContainText("Mit Leertaste geprüft");
  await expect(checkNow(page)).toBeFocused();
});

test("390 px dunkel und reduziert: Aktion groß genug, nichts überdeckt, kein Seitenüberlauf", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await open(page, "/benachrichtigungen");
  await ready(page);

  await setActivity(page, { issues: [await comment(page, "DEMO-2", "new-7", "Schmal geprüft")], delayMs: 900 });
  await checkNow(page).click();
  await expect(syncStatus(page)).toBeVisible();

  const box = (await checkNow(page).boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(32);
  expect(box.width).toBeGreaterThanOrEqual(32);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  for (const other of [syncStatus(page), page.getByText(/keine vollständige Jira-Inbox/), page.getByRole("searchbox", { name: "Benachrichtigungen durchsuchen" })]) {
    const rect = (await other.boundingBox())!;
    const overlaps = rect.x < box.x + box.width && box.x < rect.x + rect.width && rect.y < box.y + box.height && box.y < rect.y + rect.height;
    expect(overlaps).toBe(false);
  }
  expect(await inbox(page).evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(true);
  await shot(page, test.info(), "05-390-dunkel-pruefung");

  await expect(row(page, "DEMO-2")).toContainText("Schmal geprüft");
});
