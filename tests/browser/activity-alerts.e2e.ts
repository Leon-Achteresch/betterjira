import { expect, test, type Page } from "@playwright/test";

type QaNotificationState = {
  permission: "granted" | "denied" | "default";
  answer: string;
  checkDelayMs: number;
  failCheck: boolean;
  requestDelayMs: number;
  failRequest: boolean;
  checks: number;
  requests: number;
  sent: { title: string; body?: string }[];
};

type QaWindow = Window & {
  __qa: { notification: QaNotificationState };
  __qaActivity: string[];
  __qaActivityDelayMs: number;
  __qaFocused: boolean;
};

const STORAGE_KEY = "betterjira-activity-alerts";
const shots = process.env.ACTIVITY_ALERTS_SHOTS;

const open = (page: Page, route: string, scenario = "notifications") =>
  page.goto(`/tests/browser/fixture.html?${new URLSearchParams({ route, scenario })}`);

const inAppSwitch = (page: Page) => page.getByRole("switch", { name: "Popups in der App" });
const systemSwitch = (page: Page) => page.getByRole("switch", { name: "Systemhinweise" });
const watchingSwitch = (page: Page) => page.getByRole("switch", { name: "Auch beobachtete Tickets" });
const inAppToast = (page: Page) => page.getByText("DEMO-1 · Kim Probe", { exact: true });
const permissionStatus = (page: Page) => page.getByRole("region", { name: "Status der Systemhinweise" });
const bell = (page: Page) => page.getByRole("button", { name: /^Benachrichtigungen(, \d+ ungelesen)?$/ });
const qa = (page: Page) => page.evaluate(() => (window as unknown as QaWindow).__qa.notification);

const setNative = (page: Page, patch: Partial<QaNotificationState>) =>
  page.evaluate((values) => Object.assign((window as unknown as QaWindow).__qa.notification, values), patch);

const storePrefs = (page: Page, value: string) =>
  page.addInitScript(
    ([key, raw]) => {
      if (!sessionStorage.getItem("qa-prefs-seeded")) {
        localStorage.setItem(key, raw);
        sessionStorage.setItem("qa-prefs-seeded", "1");
      }
    },
    [STORAGE_KEY, value],
  );

const withActivity = (page: Page, { focused = true, delayMs = 0, native = {}, ids = ["qa-neu-1"] }: { focused?: boolean; delayMs?: number; native?: Partial<QaNotificationState>; ids?: string[] } = {}) =>
  page.addInitScript(
    ({ focused, delayMs, native, ids }) => {
      const qaWindow = window as unknown as QaWindow & { __qaSearchRule: (jql: string) => object; __qaNotificationInit: Partial<QaNotificationState> };
      qaWindow.__qaNotificationInit = native;
      qaWindow.__qaActivity = ids;
      qaWindow.__qaActivityDelayMs = delayMs;
      qaWindow.__qaFocused = focused;
      document.hasFocus = () => qaWindow.__qaFocused;
      const person = (accountId: string, displayName: string) => ({ accountId, displayName, avatarUrls: { "48x48": "/logo.svg" } });
      qaWindow.__qaSearchRule = (jql) =>
        jql.includes("updated >=")
          ? {
              delayMs: qaWindow.__qaActivityDelayMs,
              issues: [
                {
                  id: "1",
                  key: "DEMO-1",
                  fields: {
                    summary: "Suche für den Arbeitsalltag vereinfachen",
                    created: "2026-01-01T00:00:00.000Z",
                    reporter: person("qa-user", "Alex Beispiel"),
                    comment: {
                      comments: qaWindow.__qaActivity.map((id) => ({
                        id,
                        created: new Date().toISOString(),
                        author: person("qa-kim", "Kim Probe"),
                        body: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: `Neue Rückfrage ${id}` }] }] },
                      })),
                    },
                  },
                },
              ],
            }
          : {};
    },
    { focused, delayMs, native, ids },
  );

const poll = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("Standardwerte, eigener Tab und Persistenz pro Gerät", async ({ page }) => {
  await open(page, "/settings/benachrichtigungen");
  const tabs = page.getByRole("navigation", { name: "Einstellungen" });
  for (const name of ["Darstellung", "Benachrichtigungen", "Bereiche", "Code-Hosting", "KI-Briefing", "Verbindungen"])
    await expect(tabs.getByRole("link", { name, exact: true })).toBeVisible();
  await expect(page.getByText("Gilt nur auf diesem Gerät.", { exact: false })).toBeVisible();
  await expect(inAppSwitch(page)).toBeChecked();
  await expect(systemSwitch(page)).toBeChecked();
  await expect(permissionStatus(page).getByText("Vom System blockiert", { exact: true })).toBeVisible();
  expect((await qa(page)).requests).toBe(0);

  await inAppSwitch(page).click();
  await expect(inAppSwitch(page)).not.toBeChecked();
  expect(JSON.parse((await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)) ?? "null")).toEqual({
    state: { inApp: false, system: true, watching: false },
    version: 2,
  });

  await open(page, "/settings/benachrichtigungen");
  await expect(inAppSwitch(page)).not.toBeChecked();
  await expect(systemSwitch(page)).toBeChecked();

  await open(page, "/settings");
  await expect(page).toHaveURL(/\/settings\/darstellung$/);
});

test.describe("beschädigter Speicher", () => {
  for (const [label, raw, expected] of [
    ["kein JSON", "{kaputt", [true, true]],
    ["falsche Typen", JSON.stringify({ state: { inApp: "ja", system: false }, version: 1 }), [true, false]],
    ["alte Version", JSON.stringify({ state: { system: false }, version: 0 }), [true, false]],
  ] as const) {
    test(`fällt bei ${label} robust auf Standardwerte zurück`, async ({ page }) => {
      await storePrefs(page, raw);
      await open(page, "/settings/benachrichtigungen");
      await expect(inAppSwitch(page)).toBeChecked({ checked: expected[0] });
      await expect(systemSwitch(page)).toBeChecked({ checked: expected[1] });
    });
  }
});

test("Berechtigung wird nur nach Klick genau einmal angefragt", async ({ page }) => {
  await open(page, "/settings/benachrichtigungen");
  await setNative(page, { permission: "default", requestDelayMs: 500 });
  await systemSwitch(page).click();
  await systemSwitch(page).click();
  await expect(permissionStatus(page).getByText("Noch nicht erlaubt", { exact: true })).toBeVisible();
  const request = page.getByRole("button", { name: "Systemhinweise erlauben" });
  await expect(request).toBeVisible();
  expect((await qa(page)).requests).toBe(0);

  await request.click();
  await request.click({ force: true }).catch(() => undefined);
  await expect(permissionStatus(page).getByText("Erlaubt", { exact: true })).toBeVisible();
  expect((await qa(page)).requests).toBe(1);
});

test("Fehler beim Anfragen und Lesen lassen sich gezielt wiederholen", async ({ page }) => {
  await open(page, "/settings/benachrichtigungen");
  await setNative(page, { permission: "default", failRequest: true });
  await systemSwitch(page).click();
  await systemSwitch(page).click();
  await page.getByRole("button", { name: "Systemhinweise erlauben" }).click();
  await expect(page.getByRole("alert")).toContainText("Die Anfrage an das System ist fehlgeschlagen.");
  await expect(permissionStatus(page).getByText("Noch nicht erlaubt", { exact: true })).toBeVisible();
  await setNative(page, { failRequest: false });
  await page.getByRole("button", { name: "Erneut anfragen" }).click();
  await expect(permissionStatus(page).getByText("Erlaubt", { exact: true })).toBeVisible();

  await setNative(page, { failCheck: true });
  await systemSwitch(page).click();
  await systemSwitch(page).click();
  await expect(permissionStatus(page).getByText("Prüfung fehlgeschlagen", { exact: true })).toBeVisible();
  await expect(permissionStatus(page).getByText(/Der Berechtigungsstatus konnte nicht gelesen werden.*erscheinen keine Systemhinweise/)).toBeVisible();
  await setNative(page, { failCheck: false });
  await page.getByRole("button", { name: "Erneut prüfen" }).click();
  await expect(permissionStatus(page).getByText("Erlaubt", { exact: true })).toBeVisible();
  expect((await qa(page)).requests).toBe(2);
});

test("Ausgeschaltete Systemhinweise lesen und fordern keine Berechtigung an", async ({ page }) => {
  await storePrefs(page, JSON.stringify({ state: { inApp: true, system: false }, version: 1 }));
  await open(page, "/settings/benachrichtigungen");
  await expect(systemSwitch(page)).not.toBeChecked();
  await expect(permissionStatus(page)).toHaveCount(0);
  await poll(page);
  await page.waitForTimeout(300);
  expect(await qa(page)).toMatchObject({ checks: 0, requests: 0 });
});

test("Popups in der App: an zeigt den Hinweis, aus bleibt still, Inbox und Glocke bleiben aktuell", async ({ page }) => {
  await withActivity(page);
  await open(page, "/benachrichtigungen");
  await expect(inAppToast(page)).toBeVisible();
  await expect(bell(page)).toHaveAccessibleName("Benachrichtigungen, 10 ungelesen");
  expect(await qa(page)).toMatchObject({ checks: 0, requests: 0, sent: [] });
});

test("Popups in der App aus: keine Zustellung, Inbox und Glocke trotzdem aktuell", async ({ page }) => {
  await storePrefs(page, JSON.stringify({ state: { inApp: false, system: true }, version: 1 }));
  await withActivity(page);
  await open(page, "/benachrichtigungen");
  await expect(bell(page)).toHaveAccessibleName("Benachrichtigungen, 10 ungelesen");
  await expect(page.getByRole("button", { name: "DEMO-1 öffnen" }).first()).toBeVisible();
  await page.waitForTimeout(500);
  await expect(inAppToast(page)).toHaveCount(0);
  expect(await qa(page)).toMatchObject({ checks: 0, requests: 0, sent: [] });
});

test("Systemhinweise im Hintergrund: an stellt zu, aus ruft nichts Natives auf", async ({ page }) => {
  await withActivity(page, { focused: false, native: { permission: "granted" } });
  await open(page, "/benachrichtigungen");
  await expect(bell(page)).toHaveAccessibleName("Benachrichtigungen, 10 ungelesen");
  await expect(inAppToast(page)).toHaveCount(0);
  await expect.poll(async () => (await qa(page)).sent).toEqual([{ title: "DEMO-1 · Kim Probe", body: "hat einen Kommentar hinzugefügt: Neue Rückfrage qa-neu-1" }]);
  expect((await qa(page)).requests).toBe(0);
});

test("Systemhinweise aus: keine Prüfung und kein Senden, Glocke trotzdem aktuell", async ({ page }) => {
  await storePrefs(page, JSON.stringify({ state: { inApp: true, system: false }, version: 1 }));
  await withActivity(page, { focused: false });
  await open(page, "/benachrichtigungen");
  await expect(bell(page)).toHaveAccessibleName("Benachrichtigungen, 10 ungelesen");
  await page.waitForTimeout(500);
  expect(await qa(page)).toMatchObject({ checks: 0, requests: 0, sent: [] });
});

test("Ausschalten während Abruf und Berechtigungsprüfung verhindert die Zustellung", async ({ page }) => {
  await withActivity(page, { focused: false, delayMs: 800, native: { permission: "granted", checkDelayMs: 1500 } });
  await open(page, "/settings/benachrichtigungen");
  await expect(bell(page)).toHaveAccessibleName("Benachrichtigungen, 10 ungelesen");
  await systemSwitch(page).click();
  expect((await qa(page)).checks).toBeGreaterThanOrEqual(2);
  await expect(systemSwitch(page)).not.toBeChecked();
  await page.waitForTimeout(2000);
  expect((await qa(page)).sent).toEqual([]);
});

test("Wiedereinschalten stellt keine Hinweise aus der stummen Zeit nach", async ({ page }) => {
  await storePrefs(page, JSON.stringify({ state: { inApp: true, system: false }, version: 1 }));
  await withActivity(page, { focused: false, native: { permission: "granted" } });
  await open(page, "/settings/benachrichtigungen");
  await expect(bell(page)).toHaveAccessibleName("Benachrichtigungen, 10 ungelesen");
  await systemSwitch(page).click();
  await expect(permissionStatus(page).getByText("Erlaubt", { exact: true })).toBeVisible();
  await poll(page);
  await page.waitForTimeout(500);
  expect((await qa(page)).sent).toEqual([]);

  await page.evaluate(() => (window as unknown as QaWindow).__qaActivity.push("qa-neu-2"));
  await poll(page);
  await expect.poll(async () => (await qa(page)).sent.map((entry) => entry.body)).toEqual(["hat einen Kommentar hinzugefügt: Neue Rückfrage qa-neu-2"]);
  await expect(bell(page)).toHaveAccessibleName("Benachrichtigungen, 11 ungelesen");
});

test("Tastatur, 390 px, dunkel und reduzierte Bewegung", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await open(page, "/settings/benachrichtigungen");
  await setNative(page, { permission: "default" });
  await inAppSwitch(page).focus();
  await page.keyboard.press("Space");
  await expect(inAppSwitch(page)).not.toBeChecked();
  await page.keyboard.press("Tab");
  await expect(systemSwitch(page)).toBeFocused();
  await page.keyboard.press("Space");
  await expect(permissionStatus(page)).toHaveCount(0);
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: "Systemhinweise erlauben" })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(watchingSwitch(page)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Systemhinweise erlauben" })).toBeFocused();
  for (const target of [inAppSwitch(page), systemSwitch(page), watchingSwitch(page), page.getByRole("button", { name: "Systemhinweise erlauben" })]) {
    const box = await target.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const after = getComputedStyle(element, "::after");
      return { height: rect.height, hit: after.content !== "none" ? rect.height + 2 * Math.abs(parseFloat(after.top) || 0) : rect.height };
    });
    expect(box.hit).toBeGreaterThanOrEqual(32);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  expect((await qa(page)).requests).toBe(0);
});

test("Screenshots Desktop hell und 390 px dunkel", async ({ page }) => {
  test.skip(!shots, "Nur mit ACTIVITY_ALERTS_SHOTS");
  const geist = async () => {
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.fonts.check('16px "Geist Variable"') && [...document.fonts].some((face) => face.family.includes("Geist") && face.status === "loaded"))).toBe(true);
  };
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
  await open(page, "/settings/benachrichtigungen");
  await setNative(page, { permission: "default" });
  await systemSwitch(page).click();
  await systemSwitch(page).click();
  await expect(page.getByRole("button", { name: "Systemhinweise erlauben" })).toBeVisible();
  await page.waitForTimeout(400);
  await geist();
  await page.screenshot({ path: `${shots}/desktop-hell.png` });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await open(page, "/settings/benachrichtigungen");
  await setNative(page, { permission: "granted" });
  await systemSwitch(page).click();
  await systemSwitch(page).click();
  await expect(permissionStatus(page).getByText("Erlaubt", { exact: true })).toBeVisible();
  await page.waitForTimeout(400);
  await geist();
  await page.screenshot({ path: `${shots}/schmal-dunkel-390.png` });
});

test("Doppelte Ereignisse zählen und melden nur einmal, auch nach Neustart", async ({ page }) => {
  await withActivity(page, { focused: false, native: { permission: "granted" }, ids: ["duplicate", "duplicate"] });
  await open(page, "/benachrichtigungen");
  await expect(bell(page)).toHaveAccessibleName("Benachrichtigungen, 10 ungelesen");
  await expect.poll(async () => (await qa(page)).sent.length).toBe(1);
  await page.getByRole("button", { name: "4 ungelesene in „Direkt“ als gelesen markieren" }).click();
  await open(page, "/benachrichtigungen");
  await expect(page.getByRole("button", { name: "Jetzt prüfen", exact: true })).toHaveAttribute("aria-disabled", "false");
  await expect(bell(page)).toHaveAccessibleName("Benachrichtigungen, 6 ungelesen");
  expect((await qa(page)).sent).toEqual([]);
});

test("Mehr als 200 Ereignisse werden nach erneuter Prüfung und Neustart nicht wieder gemeldet", async ({ page }) => {
  await withActivity(page, { focused: false, native: { permission: "granted" }, ids: Array.from({ length: 250 }, (_, id) => `burst-${id}`) });
  await open(page, "/benachrichtigungen");
  await expect(bell(page)).toHaveAccessibleName("Benachrichtigungen, 200 ungelesen");
  await expect.poll(async () => (await qa(page)).sent.length).toBe(1);
  await page.getByRole("button", { name: "200 ungelesene in „Direkt“ als gelesen markieren" }).click();
  const checked = () => page.locator("time").first().getAttribute("datetime");
  const before = await checked();
  await page.getByRole("button", { name: "Jetzt prüfen", exact: true }).click();
  await expect.poll(checked).not.toBe(before);
  await expect(bell(page)).toHaveAccessibleName("Benachrichtigungen");
  expect((await qa(page)).sent).toHaveLength(1);
  await open(page, "/benachrichtigungen");
  await expect(page.getByRole("button", { name: "Jetzt prüfen", exact: true })).toHaveAttribute("aria-disabled", "false");
  await expect(bell(page)).toHaveAccessibleName("Benachrichtigungen");
  expect((await qa(page)).sent).toEqual([]);
});

test("Fokuswechsel während OS-Prüfung zeigt nur das Popup in der App", async ({ page }) => {
  await withActivity(page, { focused: false, native: { permission: "granted", checkDelayMs: 1500 } });
  await open(page, "/benachrichtigungen");
  await expect(bell(page)).toHaveAccessibleName("Benachrichtigungen, 10 ungelesen");
  await page.evaluate(() => { (window as unknown as QaWindow).__qaFocused = true; });
  await expect(inAppToast(page)).toBeVisible();
  expect((await qa(page)).sent).toEqual([]);
});
