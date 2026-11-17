import { expect, test, type Page } from "@playwright/test";
import type { HistoryQa } from "./history-hook-fixture";

type HookWindow = { __historyQa: HistoryQa; __qaHistory: { reads: unknown[] }; __qaHistoryRule?: () => { status?: number; delayMs?: number } };
const open = async (page: Page) => {
  await page.clock.setFixedTime(new Date("2026-11-07T00:00:00Z"));
  await page.goto("/tests/browser/history-hook-fixture.html?scenario=status-intervals");
  await expect(page.getByTestId("hook")).toBeVisible();
  await page.evaluate(() => (window as unknown as HookWindow).__historyQa.state!.onOpenChange(true));
  await expect(page.getByTestId("hook")).toContainText('"total":46');
};
const selected = (page: Page, key: string) => page.evaluate((key) => (window as unknown as HookWindow).__historyQa.state!.statusIntervals!.onSelect(key), key);
const model = (page: Page) => page.evaluate(() => {
  const state = (window as unknown as HookWindow).__historyQa.state!;
  const data = state.statusIntervals;
  return { open: state.open, covered: state.history?.covered, selected: data?.selected, complete: data?.complete, total: data?.total, closed: data?.closed, running: data?.open, rows: data?.rows, aliases: data?.aliases, asOf: data?.asOf, warnings: data?.warnings, choices: data?.choices };
});

test("Anzeigefelder folgen realer History: IDs, Auswahl, Grenzen, Creation, Snapshot und Fehler", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Datenvertrag einmal genügt");
  await open(page);
  const initial = await model(page);
  expect(initial.selected).toBeUndefined();
  expect(initial.choices?.find((choice) => choice.key === "id:7")).toMatchObject({ id: "ID 7", name: expect.stringContaining("Warten") });
  await selected(page, "id:7");
  await expect(page.getByTestId("hook")).toContainText('"selected":"id:7"');
  const waiting = await model(page);
  expect(waiting).toMatchObject({ selected: { key: "id:7", id: "ID 7" }, complete: false, total: 3, closed: "2 T", running: "1 T" });
  expect(waiting.rows?.map((row) => row.kind)).toEqual(["closed", "closed", "open"]);
  expect(waiting.rows?.every((row) => row.origin === undefined)).toBe(true);
  expect(waiting.selected?.name).toBe("Warten auf Partner");
  expect(waiting.aliases).toBe("Warten");
  expect(waiting.asOf).toContain("GMT+1");
  await selected(page, "id:3");
  await expect(page.getByTestId("hook")).toContainText('"selected":"id:3"');
  expect((await model(page)).rows?.[0]).toMatchObject({ kind: "cut", start: "Beginn unbekannt" });
  for (const covered of [40, 46]) {
    await page.evaluate(() => (window as unknown as HookWindow).__historyQa.state!.onLoadMore());
    await expect.poll(() => page.evaluate(() => (window as unknown as HookWindow).__historyQa.state!.history?.covered)).toBe(covered);
  }
  const complete = await model(page);
  expect(complete).toMatchObject({ complete: true, selected: { key: "id:3" }, closed: "3 T", total: 3 });
  expect(complete.rows?.[0]).toMatchObject({ kind: "closed", origin: "ab Erstellung" });
  expect(complete.rows?.slice(1).every((row) => row.origin === undefined)).toBe(true);
  await page.evaluate(() => {
    const w = window as unknown as HookWindow;
    w.__qaHistoryRule = () => ({ status: 503 });
    w.__historyQa.state!.onRetry();
  });
  await expect.poll(() => page.evaluate(() => !!(window as unknown as HookWindow).__historyQa.state!.refreshError)).toBe(true);
  expect(await model(page)).toMatchObject({ complete: false, selected: { key: "id:3" }, closed: "3 T", asOf: complete.asOf, warnings: expect.arrayContaining([expect.stringContaining("fehlgeschlagen")]) });
});

for (const change of ["account", "site", "issue"] as const) {
  test(`A→B→A ${change}: alte Auswahl und Aktionen leben nicht wieder auf`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Lifecyclevertrag einmal genügt");
    await open(page);
    await selected(page, "id:7");
    await expect(page.getByTestId("hook")).toContainText('"selected":"id:7"');
    await page.evaluate((change) => {
      const qa = (window as unknown as HookWindow).__historyQa;
      qa.previous = qa.state;
      if (change === "account") qa.scope("qa-cloud", "qa-other");
      if (change === "site") qa.scope("qa-other-cloud", "qa-user");
      if (change === "issue") qa.change!("DEMO-2");
    }, change);
    await expect(page.getByTestId("hook")).toContainText('"open":false');
    await page.evaluate((change) => {
      const qa = (window as unknown as HookWindow).__historyQa;
      if (change === "issue") qa.change!("DEMO-1");
      else qa.scope("qa-cloud", "qa-user");
    }, change);
    await expect.poll(async () => (await model(page)).open).toBe(false);
    expect((await model(page)).selected).toBeUndefined();
    const reads = await page.evaluate(() => (window as unknown as HookWindow).__qaHistory.reads.length);
    await page.evaluate(() => {
      const old = (window as unknown as HookWindow).__historyQa.previous!;
      old.onOpenChange(true); old.onLoadMore(); old.onRetry();
      old.statusIntervals!.onSelect("id:7"); old.statusIntervals!.onToggle();
    });
    await page.waitForTimeout(100);
    expect((await model(page)).open).toBe(false);
    expect((await model(page)).selected).toBeUndefined();
    expect(await page.evaluate(() => (window as unknown as HookWindow).__qaHistory.reads.length)).toBe(reads);
    await page.evaluate(() => (window as unknown as HookWindow).__historyQa.state!.onOpenChange(true));
    await selected(page, "id:3");
    await expect(page.getByTestId("hook")).toContainText('"selected":"id:3"');
  });
}

test("Unmount: alte Historyaktionen starten keine Abrufe und verändern eine neue Instanz nicht", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Lifecyclevertrag einmal genügt");
  await open(page);
  await selected(page, "id:7");
  await expect(page.getByTestId("hook")).toContainText('"selected":"id:7"');
  await page.evaluate(() => {
    const qa = (window as unknown as HookWindow).__historyQa;
    qa.previous = qa.state; qa.change!("DEMO-1", false);
  });
  await expect(page.getByTestId("unmounted")).toBeVisible();
  const reads = await page.evaluate(() => (window as unknown as HookWindow).__qaHistory.reads.length);
  await page.evaluate(() => {
    const old = (window as unknown as HookWindow).__historyQa.previous!;
    old.onOpenChange(true); old.onLoadMore(); old.onRetry(); old.statusIntervals!.onSelect("id:3");
  });
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => (window as unknown as HookWindow).__qaHistory.reads.length)).toBe(reads);
  await page.evaluate(() => (window as unknown as HookWindow).__historyQa.change!("DEMO-1"));
  await expect(page.getByTestId("hook")).toBeVisible();
  expect((await model(page)).selected).toBeUndefined();
  expect((await model(page)).open).toBe(false);
});

test("veraltetes Alle-anzeigen darf eine neuere Statuswahl nicht überschreiben", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Callbackvertrag einmal genügt");
  await open(page);
  await selected(page, "id:7");
  await expect(page.getByTestId("hook")).toContainText('"selected":"id:7"');
  await page.evaluate(() => { const qa = (window as unknown as HookWindow).__historyQa; qa.previous = qa.state; });
  await selected(page, "id:3");
  await expect(page.getByTestId("hook")).toContainText('"selected":"id:3"');
  await page.evaluate(() => (window as unknown as HookWindow).__historyQa.previous!.statusIntervals!.onToggle());
  await page.waitForTimeout(100);
  expect((await model(page)).selected?.key).toBe("id:3");
});

test("laufender alter Abruf nach A→B→A ersetzt den erhaltenen Snapshot nicht", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Lifecyclevertrag einmal genügt");
  await open(page);
  await selected(page, "id:7");
  await page.evaluate(() => {
    const w = window as unknown as HookWindow;
    w.__qaHistoryRule = () => ({ delayMs: 1200 });
    w.__historyQa.state!.onLoadMore();
  });
  await expect.poll(() => page.evaluate(() => (window as unknown as HookWindow).__qaHistory.reads.length)).toBe(3);
  await page.evaluate(() => (window as unknown as HookWindow).__historyQa.change!("DEMO-2"));
  await expect(page.getByTestId("hook")).toHaveText('{"open":false}');
  await page.evaluate(() => (window as unknown as HookWindow).__historyQa.change!("DEMO-1"));
  await expect.poll(async () => (await model(page)).open).toBe(false);
  await page.waitForTimeout(1400);
  expect(await model(page)).toMatchObject({ open: false, covered: 20 });
  expect((await model(page)).selected).toBeUndefined();
  expect(await page.evaluate(() => (window as unknown as HookWindow).__qaHistory.reads.length)).toBe(3);
});

test("EN-Pfad: Stays und not summed bleiben mit abgeschnittenem Beginn sichtbar und korrekt", async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-11-07T00:00:00Z"));
  await page.goto("/tests/browser/fixture.html?scenario=status-intervals&route=/issue/DEMO-1");
  const toggle = page.getByRole("button", { name: /^Änderungsverlauf/ });
  await expect(toggle).toBeVisible();
  await page.evaluate(() => { document.documentElement.lang = "en"; });
  await toggle.click();
  const panel = page.getByRole("region", { name: "Time in status" });
  await expect(panel).toBeVisible();
  await panel.getByRole("combobox").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("option", { name: /ID 7$/ })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("option", { name: /ID 3$/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(panel.getByRole("list", { name: "Stays" })).toBeVisible();
  await expect(panel).toContainText("Unknown start");
  await expect(panel).toContainText("not summed");
  await expect(panel).toContainText("2 d");
  await expect(panel).toContainText("not a complete lifetime total");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await panel.evaluate((node) => {
      const scroller = document.getElementById("app-scroll")!;
      scroller.scrollTop += node.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 80;
    });
    await page.waitForTimeout(350);
    await expect(panel.getByText("not summed", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => { const scroller = document.getElementById("app-scroll")!; return scroller.scrollWidth - scroller.clientWidth; })).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `/tmp/betterjira-n22-sol-${testInfo.project.name}-en-${width}.png`, animations: "disabled" });
  }
});
