import { expect, test, type Page } from "@playwright/test";
import type { HistoryQa } from "./history-hook-fixture";

type Qa = { reads: { key: string; startAt: number }[]; history: Record<string, unknown[]> };
type StatusWindow = { __qaHistory: Qa; __qaHistoryRule?: (key: string, startAt: number) => { status?: number; values?: unknown[]; delayMs?: number } };
const history = (page: Page) => page.locator("section").filter({ has: page.getByRole("heading", { name: /^Änderungsverlauf/ }) });
const toggle = (page: Page) => page.getByRole("button", { name: /^Änderungsverlauf/ });
const summary = (page: Page) => page.getByRole("region", { name: "Statusaufenthalte" });
const open = async (page: Page, query = "") => {
  await page.clock.setFixedTime(new Date("2026-11-07T00:00:00Z"));
  await page.goto(`/tests/browser/fixture.html?scenario=status-intervals&route=/issue/DEMO-1${query}`);
  await toggle(page).click();
  await expect(summary(page)).toBeVisible();
};
const select = async (page: Page, id: string) => {
  await summary(page).getByRole("combobox").click();
  await page.getByRole("option", { name: new RegExp(`ID ${id}$`) }).click();
};
const closed = (page: Page) => summary(page).locator("dl > div").filter({ has: page.getByText("Bestätigte abgeschlossene Aufenthalte", { exact: true }) });

test("explizite Statusauswahl per Tastatur summiert beobachtete Aufenthalte und laedt nur bewusst nach", async ({ page }) => {
  await open(page);
  await expect(summary(page)).toContainText("20 / 46");
  await expect(summary(page)).toContainText("Teilansicht");
  await expect(summary(page).locator("dl")).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as StatusWindow).__qaHistory.reads.length)).toBe(2);
  await summary(page).getByRole("combobox").focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Home");
  await page.keyboard.press("Enter");
  await expect(closed(page)).toContainText("2 T");
  await expect(summary(page)).toContainText("Laufend bis zum Berechnungsstand (separat)");
  await expect(summary(page).getByRole("listitem")).toHaveCount(3);
  await expect(summary(page)).toContainText("Weitere beobachtete Namen");
  expect(await page.evaluate(() => (window as unknown as StatusWindow).__qaHistory.reads.length)).toBe(2);
  await history(page).getByRole("button", { name: "Ältere laden" }).click();
  await expect(summary(page)).toContainText("40 / 46");
  await history(page).getByRole("button", { name: "Ältere laden" }).click();
  await expect(summary(page)).toContainText("46 / 46");
  await expect(summary(page)).toContainText("vollständig und konsistent");
  await select(page, "3");
  await expect(closed(page)).toContainText("3 T");
  await expect(summary(page)).toContainText("ab Erstellung");
});

test("Fehler beim Nachladen behaelt Snapshot und Auswahl mit sichtbarer Teilabdeckung", async ({ page }) => {
  await open(page);
  await select(page, "7");
  await page.evaluate(() => { (window as unknown as StatusWindow).__qaHistoryRule = (_key, startAt) => startAt < 26 ? { status: 503 } : {}; });
  await history(page).getByRole("button", { name: "Ältere laden" }).click();
  await expect(history(page).getByRole("alert")).toContainText("Ältere Änderungen konnten nicht geladen");
  await expect(summary(page)).toContainText("Historienabruf fehlgeschlagen");
  await expect(closed(page)).toContainText("2 T");
  await expect(summary(page)).toContainText("20 / 46");
  await page.evaluate(() => { (window as unknown as StatusWindow).__qaHistoryRule = undefined; });
  await history(page).getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(summary(page)).toContainText("40 / 46");
  await expect(summary(page)).not.toContainText("Historienabruf fehlgeschlagen");
});

test("spaeter Verlauf nach Ticketwechsel zeigt weder falsche Dauer noch alte Auswahl", async ({ page }) => {
  await open(page);
  await select(page, "7");
  await page.evaluate(() => { (window as unknown as StatusWindow).__qaHistoryRule = (key) => ({ delayMs: key === "DEMO-1" ? 1500 : 0 }); });
  await history(page).getByRole("button", { name: "Ältere laden" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as StatusWindow).__qaHistory.reads.length)).toBe(3);
  await page.evaluate(() => {
    window.history.pushState({}, "", "/issue/DEMO-2");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
  await toggle(page).click();
  await expect(summary(page)).toBeVisible();
  await expect(summary(page).locator("dl")).toHaveCount(0);
  await expect(summary(page)).toContainText("0 / 0");
  await expect(summary(page)).not.toContainText("Partnerorganisation");
  await select(page, "3");
  await expect(summary(page)).not.toContainText("Weitere beobachtete Namen");
});

test("390px: langer Status, Tastatur und englische Paneltexte ohne Seitenueberlauf", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await select(page, "7");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  expect(await page.evaluate(() => {
    const scroller = document.getElementById("app-scroll")!;
    return scroller.scrollWidth - scroller.clientWidth;
  })).toBeLessThanOrEqual(0);
  expect(await summary(page).evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(0);
  await summary(page).evaluate((node) => {
    const scroller = document.getElementById("app-scroll");
    if (scroller) scroller.scrollTop += node.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 16;
  });
  await page.waitForTimeout(450);
  await expect(summary(page).locator("dl")).toBeVisible();
  const trigger = summary(page).getByRole("combobox");
  expect((await trigger.boundingBox())?.height).toBe(32);
  await page.screenshot({ path: `/tmp/betterjira-n22-${testInfo.project.name}-390.png`, animations: "disabled" });
  await toggle(page).click();
  await page.evaluate(() => { document.documentElement.lang = "en"; });
  await toggle(page).click();
  const english = page.getByRole("region", { name: "Time in status" });
  await expect(english).toContainText("Calendar duration");
  await expect(english).toContainText("Confirmed completed stays");
});

test("200er-Deckel bleibt Teilansicht und verhindert heimlichen Vollscan", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Pagination-Vertrag einmal genügt");
  await open(page, "&historyPrefix=240");
  await select(page, "7");
  for (let loaded = 40; loaded <= 200; loaded += 20) {
    await history(page).getByRole("button", { name: "Ältere laden" }).click();
    await expect(summary(page)).toContainText(`${loaded} / 246`);
  }
  await expect(history(page).getByRole("button", { name: "Ältere laden" })).toHaveCount(0);
  await expect(summary(page)).toContainText("Teilansicht");
  await expect(history(page)).toContainText("höchstens die neuesten 200");
  expect(await page.evaluate(() => (window as unknown as StatusWindow).__qaHistory.reads.length)).toBe(11);
});

for (const change of ["account", "site", "issue", "unmount"] as const) {
  test(`echter Hook: laufende Historyantwort nach ${change} zeigt keine fremden Zeitdaten`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Daten-/Lifecycle-Vertrag einmal genügt");
    await page.goto("/tests/browser/history-hook-fixture.html?scenario=status-intervals");
    await expect(page.getByTestId("hook")).toBeVisible();
    await page.evaluate(() => (window as unknown as { __historyQa: HistoryQa }).__historyQa.state!.onOpenChange(true));
    await expect(page.getByTestId("hook")).toContainText('"total":46');
    await page.evaluate(() => {
      const qa = (window as unknown as { __historyQa: HistoryQa }).__historyQa;
      qa.state!.statusIntervals!.onSelect("id:7");
      (window as unknown as StatusWindow).__qaHistoryRule = () => ({ delayMs: 1200 });
      qa.state!.onLoadMore();
    });
    await expect.poll(() => page.evaluate(() => (window as unknown as StatusWindow).__qaHistory.reads.length)).toBe(3);
    await page.evaluate((change) => {
      const qa = (window as unknown as { __historyQa: HistoryQa }).__historyQa;
      qa.previous = qa.state;
      if (change === "account") qa.scope("qa-cloud", "qa-other");
      if (change === "site") qa.scope("qa-other-cloud", "qa-user");
      if (change === "issue") qa.change!("DEMO-2");
      if (change === "unmount") qa.change!("DEMO-1", false);
    }, change);
    if (change === "unmount") await expect(page.getByTestId("unmounted")).toBeVisible();
    else {
      await expect(page.getByTestId("hook")).toHaveText('{"open":false}');
      await page.evaluate(() => {
        const old = (window as unknown as { __historyQa: HistoryQa }).__historyQa.previous!;
        old.statusIntervals!.onSelect("id:7"); old.onLoadMore();
      });
    }
    await page.waitForTimeout(1400);
    expect(await page.evaluate(() => (window as unknown as StatusWindow).__qaHistory.reads.length)).toBe(3);
    if (change !== "unmount") await expect(page.getByTestId("hook")).toHaveText('{"open":false}');
  });
}

test("viele Aufenthalte: zuerst fuenf, alle nur bewusst per Tastatur und ohne Zusatzabruf", async ({ page }) => {
  await page.addInitScript(() => {
    const values = Array.from({ length: 15 }, (_, index) => {
      const into = index % 2 === 0;
      return { id: `cycle-${index}`, created: new Date(Date.UTC(2026, 10, 1, index + 1)).toISOString(), author: { displayName: "QA" }, items: [{ field: "status", fieldtype: "jira", fieldId: "status", from: into ? "3" : "7", to: into ? "7" : "3", fromString: into ? "In Arbeit" : "Warten", toString: into ? "Warten" : "In Arbeit" }] };
    });
    (window as unknown as StatusWindow).__qaHistoryRule = (key) => (key === "DEMO-1" ? { values } : {});
  });
  await open(page);
  await select(page, "7");
  const stays = summary(page).getByRole("list", { name: "Aufenthalte" });
  await expect(stays.getByRole("listitem")).toHaveCount(5);
  await expect(summary(page)).toContainText("Aufenthalte · 5 / 8");
  const more = summary(page).getByRole("button", { name: "Alle Aufenthalte zeigen (8)" });
  await expect(more).toHaveAttribute("aria-expanded", "false");
  const reads = await page.evaluate(() => (window as unknown as StatusWindow).__qaHistory.reads.length);
  await more.focus();
  await page.keyboard.press("Enter");
  await expect(stays.getByRole("listitem")).toHaveCount(8);
  const less = summary(page).getByRole("button", { name: "Weniger zeigen" });
  await expect(less).toBeFocused();
  await expect(less).toHaveAttribute("aria-expanded", "true");
  await expect(stays.getByRole("listitem").last()).toContainText("laufend · separat");
  await expect(closed(page)).toContainText("7 h");
  expect(await summary(page).evaluate((node) => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(0);
  await page.keyboard.press("Enter");
  await expect(stays.getByRole("listitem")).toHaveCount(5);
  expect(await page.evaluate(() => (window as unknown as StatusWindow).__qaHistory.reads.length)).toBe(reads);
});
