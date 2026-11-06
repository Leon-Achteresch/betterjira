import { expect, test, type Page, type TestInfo } from "@playwright/test";

type HistoryRead = { key: string; startAt: number; maxResults: number; account: string };
type HistoryRule = { delayMs?: number; status?: number; html?: boolean; values?: unknown[] };

declare global {
  interface Window {
    __qaHistory: { reads: HistoryRead[] };
    __qaHistoryRule?: (key: string, startAt: number, account: string) => HistoryRule;
    __qaHistoryStatus?: number;
    __qaHistoryFailBelow?: number;
    __qaHistoryXss?: boolean;
  }
}

const NOW = new Date("2026-11-06T12:00:00.000Z");
const ISSUE = (key: string, account?: string) =>
  `/tests/browser/fixture.html?${new URLSearchParams({ route: `/issue/${key}`, ...(account && { account }) })}`;

const panel = (page: Page) => page.locator("section").filter({ has: page.getByRole("heading", { name: /^Änderungsverlauf/ }) });
const toggle = (page: Page) => panel(page).getByRole("button", { name: /^Änderungsverlauf/ });
const entries = (page: Page) => panel(page).getByRole("listitem");
const reads = (page: Page) => page.evaluate(() => window.__qaHistory.reads.map(({ key, startAt, maxResults }) => ({ key, startAt, maxResults })));

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  const dir = process.env.ISSUE_HISTORY_SHOTS;
  if (!dir) return;
  await page.evaluate(() => document.fonts.ready);
  await toggle(page).evaluate((element) => {
    element.scrollIntoView({ block: "start" });
    document.getElementById("app-scroll")?.scrollBy(0, -96);
  });
  await page.screenshot({ path: `${dir}/${testInfo.project.name}-${name}.png` });
};

const openIssue = async (page: Page, key = "DEMO-1", account?: string) => {
  await page.goto(ISSUE(key, account));
  await expect(page.getByRole("heading", { name: /^Kommentare/ })).toBeVisible();
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
};

const navigateInApp = (page: Page, key: string) =>
  page.evaluate((target) => {
    window.history.pushState({}, "", `/issue/${target}`);
    window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
  }, key);

const switchableFailure = (page: Page) =>
  page.addInitScript(() => {
    window.__qaHistoryRule = (_key, startAt) =>
      window.__qaHistoryStatus || (window.__qaHistoryFailBelow !== undefined && startAt < window.__qaHistoryFailBelow)
        ? { status: window.__qaHistoryStatus ?? 503, html: !window.__qaHistoryStatus }
        : {};
  });

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.clock.setFixedTime(NOW);
});

test("lädt geschlossen nichts und zeigt nach dem Öffnen per Tastatur die neuesten Änderungen zuerst", async ({ page }, testInfo) => {
  await openIssue(page);
  await page.waitForTimeout(400);
  expect(await reads(page)).toEqual([]);

  await toggle(page).focus();
  await page.keyboard.press("Enter");
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
  await expect(entries(page)).toHaveCount(20);
  expect(await reads(page)).toEqual([
    { key: "DEMO-1", startAt: 0, maxResults: 20 },
    { key: "DEMO-1", startAt: 28, maxResults: 20 },
  ]);

  const newest = entries(page).first();
  await expect(newest).toContainText("Sam Muster");
  for (const text of ["Status", "Review", "In Arbeit", "Bearbeiter", "Alex Beispiel", "Priorität", "Restschätzung", "4h", "1h 30m"]) {
    await expect(newest).toContainText(text);
  }
  await expect(toggle(page)).toContainText("· 48");
  await expect(panel(page)).toContainText("Die neuesten 20 von 48 Änderungen");
  await shot(page, testInfo, "geoeffnet");

  await page.keyboard.press("Enter");
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
  await expect(entries(page)).toHaveCount(0);
  await expect(toggle(page)).toBeFocused();
});

test("zeigt unbekannte Personen, Felder und Markup neutral als Text", async ({ page }) => {
  await openIssue(page);
  await toggle(page).click();
  const former = entries(page).nth(1);
  await expect(former).toContainText("Ehemaliger Nutzer");
  await expect(former).toContainText('<img src=x onerror="window.__qaHistoryXss=true">');
  await expect(former.getByText("Arbeitsprotokoll")).toBeVisible();
  await expect(former).toContainText("ohne Anzeigetext");
  await expect(former).not.toContainText("20077");
  await expect(panel(page).locator("img[src='x']")).toHaveCount(0);
  expect(await page.evaluate(() => window.__qaHistoryXss)).toBeUndefined();

  const expand = former.getByRole("button", { name: "Vollständig anzeigen" });
  await expect(expand).toHaveAttribute("aria-expanded", "false");
  await expand.focus();
  await page.keyboard.press("Enter");
  await expect(former.getByRole("button", { name: "Weniger anzeigen" })).toHaveAttribute("aria-expanded", "true");

  const anonymous = entries(page).nth(2);
  await expect(anonymous).toContainText("Unbekannte Person");
  await expect(anonymous).toContainText("Unbekanntes Feld");
  await expect(anonymous).not.toContainText("customfield_10099");
  await expect(anonymous).not.toContainText("10045");
  await expect(anonymous).toContainText("Labels");
  await expect(anonymous).toContainText("leer");
});

test("lädt ältere Seiten explizit, lückenlos und ohne Duplikate bis zum Anfang", async ({ page }) => {
  await openIssue(page);
  await toggle(page).click();
  await expect(entries(page)).toHaveCount(20);

  const more = panel(page).getByRole("button", { name: "Ältere laden" });
  await more.focus();
  await page.keyboard.press("Enter");
  await expect(entries(page)).toHaveCount(40);
  await expect(panel(page)).toContainText("Die neuesten 40 von 48 Änderungen");
  await expect(more).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(entries(page)).toHaveCount(48);
  await expect(panel(page)).toContainText("Alle 48 Änderungen");
  await expect(more).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
  expect((await reads(page)).slice(2)).toEqual([
    { key: "DEMO-1", startAt: 8, maxResults: 20 },
    { key: "DEMO-1", startAt: 0, maxResults: 8 },
  ]);
  const times = await entries(page).locator("time").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("datetime") ?? ""));
  expect(times).toEqual([...times].sort().reverse());
  await expect(entries(page).last()).toContainText("Zu erledigen");
});

test("nennt die Obergrenze, statt einen vollständigen Verlauf zu behaupten", async ({ page }) => {
  await page.addInitScript(() => {
    const values = Array.from({ length: 230 }, (_, index) => ({
      id: String(5000 + index),
      created: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
      items: [{ field: "labels", fromString: null, toString: `L${index}` }],
    }));
    window.__qaHistoryRule = () => ({ values });
  });
  await openIssue(page);
  await toggle(page).click();
  const more = panel(page).getByRole("button", { name: "Ältere laden" });
  for (let loaded = 1; loaded < 10; loaded++) {
    await expect(entries(page)).toHaveCount(loaded * 20);
    await more.click();
  }
  await expect(entries(page)).toHaveCount(200);
  await expect(more).toHaveCount(0);
  await expect(panel(page)).toContainText("Die neuesten 200 von 230 Änderungen");
  await expect(panel(page)).toContainText("höchstens die neuesten 200 Änderungen");
});

test("Erstfehler zeigt Jira-Meldung, Retry per Tastatur lädt und hält den Fokus im Bereich", async ({ page }, testInfo) => {
  await switchableFailure(page);
  await page.addInitScript(() => {
    window.__qaHistoryStatus = 403;
  });
  await openIssue(page);
  await toggle(page).click();
  const alert = panel(page).getByRole("alert");
  await expect(alert).toContainText("Änderungsverlauf konnte nicht geladen werden.");
  await expect(alert).toContainText("Test: Jira antwortet mit 403");
  await shot(page, testInfo, "fehler");

  const retry = alert.getByRole("button", { name: "Erneut versuchen" });
  await retry.focus();
  await page.evaluate(() => {
    window.__qaHistoryStatus = 0;
  });
  await page.keyboard.press("Enter");
  await expect(entries(page)).toHaveCount(20);
  await expect(alert).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.closest("section")?.querySelector("h2")?.textContent ?? ""))
    .toContain("Änderungsverlauf");
});

test("Fehler beim Nachladen behält geladene Einträge und lässt sich wiederholen", async ({ page }, testInfo) => {
  await switchableFailure(page);
  await openIssue(page);
  await toggle(page).click();
  await expect(entries(page)).toHaveCount(20);
  await page.evaluate(() => {
    window.__qaHistoryFailBelow = 28;
  });
  await panel(page).getByRole("button", { name: "Ältere laden" }).click();
  const warning = panel(page).getByRole("alert").filter({ hasText: "Ältere Änderungen konnten nicht geladen werden" });
  await expect(warning).toBeVisible();
  await expect(warning).toContainText("Jira antwortet mit Status 503.");
  await expect(warning).not.toContainText("<html");
  await expect(entries(page)).toHaveCount(20);
  await shot(page, testInfo, "nachladen-fehler");

  await page.evaluate(() => {
    window.__qaHistoryFailBelow = undefined;
  });
  await warning.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(entries(page)).toHaveCount(40);
  await expect(warning).toHaveCount(0);
});

test("fehlgeschlagene Aktualisierung zeigt den zuletzt geladenen Stand mit Retry", async ({ page }) => {
  await switchableFailure(page);
  await openIssue(page);
  await toggle(page).click();
  await expect(entries(page)).toHaveCount(20);
  await toggle(page).click();
  await page.clock.setFixedTime(new Date(NOW.getTime() + 60_000));
  await page.evaluate(() => {
    window.__qaHistoryStatus = 503;
  });
  await toggle(page).click();
  await expect(entries(page)).toHaveCount(20);
  const warning = panel(page).getByRole("alert").filter({ hasText: "Aktualisierung fehlgeschlagen" });
  await expect(warning).toBeVisible();
  await expect(entries(page)).toHaveCount(20);

  await page.evaluate(() => {
    window.__qaHistoryStatus = 0;
  });
  await warning.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(warning).toHaveCount(0);
  await expect(entries(page)).toHaveCount(20);
});

test("Ticketwechsel startet eingeklappt und zeigt keinen fremden Verlauf", async ({ page }) => {
  await openIssue(page);
  await toggle(page).click();
  await expect(entries(page)).toHaveCount(20);

  await navigateInApp(page, "DEMO-3");
  await expect(page).toHaveURL(/\/issue\/DEMO-3$/);
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
  await toggle(page).click();
  await expect(entries(page)).toHaveCount(3);
  await expect(panel(page)).not.toContainText("Ehemaliger Nutzer");
  await expect(panel(page)).toContainText("Alle 3 Änderungen");

  await navigateInApp(page, "DEMO-2");
  await toggle(page).click();
  await expect(panel(page)).toContainText("Noch keine Änderungen erfasst.");
  await expect(entries(page)).toHaveCount(0);

  const before = (await reads(page)).length;
  await navigateInApp(page, "DEMO-1");
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
  await toggle(page).click();
  await expect(entries(page)).toHaveCount(20);
  await expect(entries(page).first()).toContainText("Sam Muster");
  expect((await reads(page)).length).toBe(before);
});

test("anderes Konto bekommt eigenen Verlauf statt fremder Einträge", async ({ page }) => {
  await page.addInitScript(() => {
    window.__qaHistoryRule = (_key, _startAt, account) => ({
      values: [{ id: "1", created: "2026-11-05T10:00:00.000Z", items: [{ field: "summary", fromString: "Alt", toString: `Sicht von ${account}` }] }],
    });
  });
  await openIssue(page);
  await toggle(page).click();
  await expect(entries(page)).toHaveCount(1);
  await expect(panel(page)).toContainText("Sicht von qa-user");

  await openIssue(page, "DEMO-1", "qa-colleague");
  await toggle(page).click();
  await expect(panel(page)).toContainText("Sicht von qa-colleague");
  await expect(panel(page)).not.toContainText("Sicht von qa-user");
  expect(await page.evaluate(() => window.__qaHistory.reads.map((read) => read.account))).toEqual(["qa-colleague"]);
});

test.describe("schmal, dunkel, reduzierte Bewegung", () => {
  test.use({ viewport: { width: 390, height: 844 }, colorScheme: "dark", reducedMotion: "reduce" });

  test("bleibt bei 390 px ohne Seitenüberlauf bedienbar", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "eigene Ansicht, einmal genügt");
    await openIssue(page);
    await toggle(page).click();
    await expect(entries(page)).toHaveCount(20);
    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].filter((font) => font.family.includes("Geist")).map((font) => font.status);
    });
    expect(fonts).toContain("loaded");
    const overflow = await page.evaluate(() => {
      const scroller = document.getElementById("app-scroll") ?? document.documentElement;
      return { page: document.documentElement.scrollWidth - window.innerWidth, scroller: scroller.scrollWidth - scroller.clientWidth };
    });
    expect(overflow.page).toBeLessThanOrEqual(0);
    expect(overflow.scroller).toBeLessThanOrEqual(0);
    const box = await panel(page).boundingBox();
    expect(box && box.x + box.width).toBeLessThanOrEqual(390);
    const target = await toggle(page).boundingBox();
    expect(target?.height).toBeGreaterThanOrEqual(32);
    await shot(page, testInfo, "schmal-390");
    await entries(page).nth(1).getByRole("button", { name: "Vollständig anzeigen" }).click();
    await expect(entries(page).nth(1).getByRole("button", { name: "Weniger anzeigen" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});
