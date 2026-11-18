import { expect, test, type Page } from "@playwright/test";
import { mixedShiftWrites, shiftDates, staleDate } from "../jira/fixtures/due-date-shift-acceptance";

type Write = { path: string; method: string; input: { fields?: { duedate?: string } }; failed?: number };
type Fixture = {
  __qa: { accountId?: string; writes: Write[]; issues: { id: string; key: string; fields: { duedate?: string | null } }[] };
  __qaReadRule?: (path: string, params: URLSearchParams) => Promise<{ body: unknown } | undefined>;
  __qaBulkWriteRule?: (path: string, input: Write["input"]) => { status: number; body: unknown } | undefined;
  n04: { dates: Record<string, string | null>; accountReads: string[]; held?: string; reached?: string; released?: string; release?: () => void };
};

const fixture = `/tests/browser/fixture.html?scenario=multi-links&route=${encodeURIComponent("/suche?projekt=DEMO")}`;
const dialog = (page: Page) => page.getByRole("dialog", { name: "Sammelbearbeitung" });
const editor = (page: Page) => dialog(page).getByLabel("Versatz in Kalendertagen");
const openButton = (page: Page) => page.getByRole("button", { name: "Bearbeiten", exact: true });
const previewButton = (page: Page) => dialog(page).getByRole("button", { name: "Vorschau frisch prüfen" });
const confirm = (page: Page) => dialog(page).getByRole("button", { name: "Verschiebung bestätigen" });
const previewRows = (page: Page) => dialog(page).getByRole("list", { name: "Vorschau der Fälligkeiten" }).getByRole("listitem");
const results = (page: Page) => dialog(page).getByRole("list", { name: "Ergebnisse der Fälligkeitsverschiebung" });
const toggle = (page: Page, key: string) => page.getByRole("checkbox", { name: `${key} auswählen`, exact: true }).press("Space");
const writes = (page: Page) => page.evaluate(() => (window as unknown as Fixture).__qa.writes);

const open = async (page: Page) => {
  if (!(await dialog(page).isVisible())) await openButton(page).press("Enter");
  if (await editor(page).isVisible()) return;
  await dialog(page).getByLabel("Änderung", { exact: true }).press("Enter");
  const option = page.getByRole("option", { name: "Fälligkeiten verschieben" });
  const last = page.getByRole("option", { name: "Tabellenwerte prüfen" });
  await expect(option).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute("role"))).toBe("option");
  await page.keyboard.press("End");
  await expect(last).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(option).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(editor(page)).toBeVisible();
};

const select = async (page: Page, keys: string[]) => {
  await page.goto(fixture);
  for (const key of keys) await toggle(page, key);
  await open(page);
};

const preview = async (page: Page, days: string, rowCount: number) => {
  await editor(page).fill(days);
  await editor(page).press("Tab");
  await expect(previewButton(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(previewRows(page)).toHaveCount(rowCount);
  await expect(confirm(page)).toBeEnabled();
};

test.beforeEach(async ({ page }, info) => {
  if (info.project.name === "narrow-dark-reduced") await page.setViewportSize({ width: 390, height: 720 });
  await page.route("**/*", (route) => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  await page.addInitScript(({ dates, outcomes }) => {
    const qa = window as unknown as Fixture;
    qa.n04 = { dates, accountReads: [] };
    qa.__qaReadRule = async (path, params) => {
      if (path === "/myself") qa.n04.accountReads.push(qa.__qa.accountId ?? "qa-user");
      if (path === "/mypermissions" && params.get("permissions") === "EDIT_ISSUES,SCHEDULE_ISSUES") return { body: { permissions: {
        EDIT_ISSUES: { havePermission: true }, SCHEDULE_ISSUES: { havePermission: true },
      } } };
      if (/^\/issue\/DEMO-\d+\/editmeta$/.test(path)) return { body: { fields: { duedate: { operations: ["set"] } } } };
      if (params.get("fields") !== "duedate,project,issuetype") return;
      const key = path.split("/").at(-1)!;
      const info = qa.__qa.issues.find((issue) => issue.key === key)!;
      const fields = { duedate: qa.n04.dates[key], project: { id: "1" }, issuetype: { id: "task" } };
      if (qa.n04.held === key) {
        qa.n04.held = undefined;
        await new Promise<void>((release) => { qa.n04.reached = key; qa.n04.release = release; });
        qa.n04.released = key;
      }
      return { body: { id: info.id, key, fields } };
    };
    qa.__qaBulkWriteRule = (path, input) => {
      const key = path.split("/").at(-1)!;
      const intended = outcomes.find((item) => item.key === key);
      const date = input.fields?.duedate;
      if (typeof date !== "string" || !intended) return;
      if (intended.status !== 403) qa.n04.dates[key] = date;
      if (intended.status !== 204) return { status: intended.status, body: { errorMessages: ["Synthetischer Teilausgang"] } };
    };
  }, { dates: shiftDates, outcomes: mixedShiftWrites });
});

test("Tastaturvorschau und Escape bleiben schreibfrei, Bestätigung sendet absolute Daten und zeigt einzelne Teilausgänge", async ({ page }) => {
  await select(page, Object.keys(shiftDates).slice(0, 7));
  await editor(page).fill("0");
  await expect(dialog(page).getByRole("alert")).toContainText("Ganze Anzahl Tage ungleich 0");
  await expect(previewButton(page)).toBeDisabled();
  await preview(page, "+1", 7);
  await expect(previewRows(page).nth(0)).toContainText("2026-03-28 → 2026-03-29");
  await expect(previewRows(page).nth(1)).toContainText("2026-10-24 → 2026-10-25");
  await expect(previewRows(page).nth(2)).toContainText("Keine vorhandene Fälligkeit");
  await expect(previewRows(page).nth(3)).toContainText("Ungültiges Kalenderdatum");
  await expect(previewRows(page).nth(6)).toContainText("2026-12-31 → 2027-01-01");
  expect(await dialog(page).evaluate((panel) => {
    const rect = panel.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= innerWidth && panel.scrollWidth <= panel.clientWidth;
  })).toBe(true);
  expect(await writes(page)).toEqual([]);
  await editor(page).press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  await expect(openButton(page)).toBeFocused();
  expect(await writes(page)).toEqual([]);

  await open(page);
  await expect(confirm(page)).toHaveCount(0);
  await preview(page, "1", 7);
  await page.evaluate((date) => { (window as unknown as Fixture).n04.dates["DEMO-7"] = date; }, staleDate);
  expect(await writes(page)).toEqual([]);
  await confirm(page).press("Enter");
  const rows = results(page).getByRole("listitem");
  await expect(rows).toHaveCount(7);
  for (const [index, label] of ["Geändert", "Abgelehnt", "Nicht gesendet", "Nicht gesendet", "Ergebnis unklar", "Geändert", "Nicht gesendet"].entries())
    await expect(rows.nth(index)).toContainText(`DEMO-${index + 1} · ${label}`);
  await expect(rows.nth(1)).toContainText("HTTP 403");
  await expect(rows.nth(6)).toContainText("seit der Vorschau geändert");
  await expect(confirm(page)).toHaveCount(0);
  expect((await writes(page)).map(({ path, method, input, failed }) => ({ path, method, input, status: failed ?? 204 }))).toEqual(
    mixedShiftWrites.map(({ key, date, status }) => ({ path: `/issue/${key}`, method: "PUT", input: { fields: { duedate: date } }, status })),
  );
});

for (const action of ["Stoppen", "Kontowechsel"] as const) {
  test(`${action} während der letzten Prüfung verwirft alle noch ungesendeten Daten`, async ({ page }) => {
    if (action === "Kontowechsel") await page.clock.setFixedTime(new Date("2026-11-17T12:00:00Z"));
    await select(page, ["DEMO-1", "DEMO-2"]);
    await preview(page, "-1", 2);
    await expect(previewRows(page).nth(0)).toContainText("2026-03-28 → 2026-03-27");
    await page.evaluate(() => { (window as unknown as Fixture).n04.held = "DEMO-1"; });
    await confirm(page).press("Enter");
    await expect.poll(() => page.evaluate(() => (window as unknown as Fixture).n04.reached)).toBe("DEMO-1");
    await expect(page.getByRole("checkbox", { name: "DEMO-1 auswählen", exact: true })).toBeDisabled();
    if (action === "Stoppen") await dialog(page).getByRole("button", { name: "Weitere Änderungen stoppen" }).press("Enter");
    else {
      await page.evaluate(() => { (window as unknown as Fixture).__qa.accountId = "qa-other-account"; });
      await page.clock.setFixedTime(new Date("2026-11-17T12:05:00Z"));
      await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
      await expect(page.getByRole("region", { name: "Ausgewählte Vorgänge" })).toHaveCount(0);
    }
    expect(await writes(page)).toEqual([]);
    await page.evaluate(() => (window as unknown as Fixture).n04.release?.());
    await expect.poll(() => page.evaluate(() => (window as unknown as Fixture).n04.released)).toBe("DEMO-1");
    if (action === "Kontowechsel") {
      const before = await page.evaluate(() => (window as unknown as Fixture).n04.accountReads.length);
      await page.evaluate(() => { (window as unknown as Fixture).__qa.accountId = undefined; });
      await page.clock.setFixedTime(new Date("2026-11-17T12:10:00Z"));
      await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
      await expect.poll(() => page.evaluate((offset) => (window as unknown as Fixture).n04.accountReads.slice(offset).includes("qa-user"), before)).toBe(true);
      await expect(page.getByRole("checkbox", { name: "DEMO-2 auswählen", exact: true })).toBeEnabled();
      await toggle(page, "DEMO-2");
      await open(page);
      await expect(editor(page)).toHaveValue("");
    }
    await expect(editor(page)).toBeEnabled();
    await expect(confirm(page)).toHaveCount(0);
    if (action === "Stoppen") {
      await expect(results(page).getByRole("listitem")).toHaveCount(2);
      await expect(results(page).getByRole("listitem").nth(0)).toContainText("DEMO-1 · Nicht gesendet");
      await expect(results(page).getByRole("listitem").nth(1)).toContainText("DEMO-2 · Nicht gesendet");
    } else await expect(results(page)).toHaveCount(0);
    expect(await writes(page)).toEqual([]);
  });
}
