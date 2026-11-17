import { expect, test, type Page } from "@playwright/test";

type Write = { path: string; method: string; input: { fields: { duedate: string } }; failed?: number };
type Fixture = {
  __qa: { writes: Write[]; accountId?: string; issues: { key: string; fields: { duedate?: string } }[] };
  __qaReadRule?: (path: string, params: URLSearchParams) => Promise<{ body: unknown } | undefined>;
  __qaBulkWriteRule?: (path: string, input: Write["input"]) => { status: number; body: unknown } | undefined;
  __qaTableFieldApply?: () => boolean;
  applyQA: { accountReads: string[]; denied?: string; hold?: string; reached?: string; release?: () => void; released?: string };
};

const fixture = "/tests/browser/fixture.html?scenario=table-field-apply&route=" + encodeURIComponent("/suche?projekt=DEMO");
const dialog = (page: Page) => page.getByRole("dialog", { name: "Sammelbearbeitung" });
const input = (page: Page) => dialog(page).getByRole("textbox", { name: "Tabellenwerte (TSV)" });
const result = (page: Page) => dialog(page).getByRole("list", { name: "Ergebnisse der Fälligkeitsänderung" });
const row = (page: Page, key: string) => page.getByRole("row").filter({ has: page.getByRole("cell", { name: key, exact: true }) });
const toggle = (page: Page, key: string) => row(page, key).getByRole("checkbox").press("Space");
const apply = (page: Page) => dialog(page).getByRole("button", { name: "Fälligkeiten anwenden" });
const acknowledge = (page: Page) => dialog(page).getByRole("checkbox", { name: "Ich habe die Änderungen geprüft" });
const writes = (page: Page) => page.evaluate(() => (window as unknown as Fixture).__qa.writes);

const open = async (page: Page, keys: string[], url = fixture) => {
  await page.goto(url);
  for (const key of keys) await toggle(page, key);
  await page.getByRole("button", { name: "Bearbeiten", exact: true }).press("Enter");
  await dialog(page).getByLabel("Änderung", { exact: true }).press("Enter");
  const choice = page.getByRole("option", { name: "Tabellenwerte prüfen" });
  await expect(choice).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute("role"))).toBe("option");
  await page.keyboard.press("End");
  await expect(choice).toBeFocused();
  await page.keyboard.press("Enter");
};
const preview = async (page: Page, value: string) => {
  await input(page).fill(value);
  await dialog(page).getByRole("button", { name: "Vorschau prüfen" }).press("Enter");
  await expect(dialog(page).getByRole("list", { name: "Prüfung je Tabellenzeile" })).toBeVisible();
};
const confirm = async (page: Page) => {
  await acknowledge(page).press("Space");
  await expect(apply(page)).toBeEnabled();
  await apply(page).press("Enter");
};

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  await page.addInitScript(() => {
    const qa = window as unknown as Fixture;
    qa.applyQA = { accountReads: [] };
    qa.__qaReadRule = async (path, params) => {
      if (path === "/myself") qa.applyQA.accountReads.push(qa.__qa.accountId ?? "qa-user");
      if (path.startsWith("/issue/") && params.get("fields") === "duedate,project,issuetype") {
        const key = path.split("/").at(-1)!;
        const issue = qa.__qa.issues.find((candidate) => candidate.key === key)!;
        const fields = { duedate: issue.fields.duedate ?? null, project: { id: "1" }, issuetype: { id: "task" } };
        if (qa.applyQA.hold === key) {
          qa.applyQA.hold = undefined;
          await new Promise<void>((resolve) => {
            qa.applyQA.reached = key;
            qa.applyQA.release = resolve;
          });
          qa.applyQA.released = key;
        }
        return { body: { id: key.split("-")[1], key, fields } };
      }
      if (path === "/mypermissions" && params.get("permissions") === "EDIT_ISSUES,SCHEDULE_ISSUES") {
        return { body: { permissions: {
          EDIT_ISSUES: { havePermission: true },
          SCHEDULE_ISSUES: { havePermission: params.get("issueKey") !== qa.applyQA.denied },
        } } };
      }
      if (/^\/issue\/DEMO-\d+\/editmeta$/.test(path)) return { body: { fields: {
        assignee: { operations: ["set"] },
        duedate: { operations: ["set"] },
      } } };
    };
  });
});

test.describe("freigegebenes Loopback-Fixture", () => {
  test.skip(process.env.N02_APPLY_QA !== "1", "Requires the isolated Vite browser-QA build");

  test("Bestätigung ergibt exakten PUT, Sperrgründe und unklaren Teilerfolg ohne Wiederholung", async ({ page }, info) => {
    if (info.project.name === "narrow-dark-reduced") await page.setViewportSize({ width: 390, height: 720 });
    await open(page, ["DEMO-1", "DEMO-2", "DEMO-3", "DEMO-4", "DEMO-5", "DEMO-6", "DEMO-7", "DEMO-8"]);
    const rows = ["DEMO-1\t2026-12-18", "DEMO-2\t2026-12-19", "DEMO-3\t2026-12-20", "DEMO-4\t",
      "DEMO-5\t2026-12-22", "DEMO-5\t2026-12-23", "DEMO-6\t2026-12-24\tmehr", "DEMO-7\t2026-12-25",
      "DEMO-8\t2026-12-26", "DEMO-9\t2026-12-27"].join("\n");
    await preview(page, rows);
    await expect(apply(page)).toBeDisabled();
    expect(await writes(page)).toEqual([]);
    await acknowledge(page).press("Space");
    await input(page).fill(rows.replace("2026-12-18", "2026-12-17"));
    await expect(apply(page)).toHaveCount(0);
    await preview(page, rows);
    await expect(apply(page)).toBeDisabled();
    await page.evaluate(() => {
      const qa = window as unknown as Fixture;
      qa.__qa.issues.find(({ key }) => key === "DEMO-2")!.fields.duedate = "2026-12-28";
      qa.applyQA.denied = "DEMO-3";
      qa.__qaBulkWriteRule = (path, input) => {
        if (path !== "/issue/7") return undefined;
        qa.__qa.issues.find(({ key }) => key === "DEMO-7")!.fields.duedate = input.fields.duedate;
        return { status: 503, body: { errorMessages: ["Unklare Rückmeldung nach synthetischem Write"] } };
      };
    });
    expect(await writes(page)).toEqual([]);
    await confirm(page);
    const items = result(page).getByRole("listitem");
    await expect(items).toHaveCount(10);
    await expect(items.nth(0)).toContainText("DEMO-1 · Bestätigt");
    await expect(items.nth(1)).toContainText("Fälligkeit hat sich seit der Vorschau geändert");
    await expect(items.nth(2)).toContainText("Rechte zum Bearbeiten oder Planen fehlen");
    for (const index of [3, 4, 5, 6, 9]) await expect(items.nth(index)).toContainText("Gesperrt");
    await expect(items.nth(7)).toContainText("DEMO-7 · Unklar");
    await expect(items.nth(8)).toContainText("Nach unklarem Ergebnis angehalten");
    await expect(apply(page)).toHaveCount(0);
    await expect(dialog(page).getByRole("list", { name: "Prüfung je Tabellenzeile" })).toHaveCount(0);
    expect(await writes(page)).toEqual([
      { path: "/issue/1", method: "PUT", input: { fields: { duedate: "2026-12-18" } } },
      { path: "/issue/7", method: "PUT", input: { fields: { duedate: "2026-12-25" } }, failed: 503 },
    ]);
    const shots = process.env.N02_APPLY_SHOTS;
    if (shots) await page.screenshot({ path: `${shots}/${info.project.name}-apply.png` });
  });

  for (const change of ["Auswahl", "Konto"] as const) {
    test(`${change} während des abschließenden GETs sperrt alle PUTs`, async ({ page }) => {
      await page.clock.setFixedTime(new Date("2026-11-17T12:00:00Z"));
      await open(page, ["DEMO-1", "DEMO-2"]);
      await preview(page, "DEMO-1\t2026-12-18\nDEMO-2\t2026-12-19");
      await page.evaluate(() => { (window as unknown as Fixture).applyQA.hold = "DEMO-1"; });
      await confirm(page);
      await expect.poll(() => page.evaluate(() => (window as unknown as Fixture).applyQA.reached)).toBe("DEMO-1");
      if (change === "Auswahl") {
        await toggle(page, "DEMO-1");
        await expect(page.getByRole("region", { name: "Ausgewählte Vorgänge" })).toContainText("1 von");
      } else {
        await page.evaluate(() => { (window as unknown as Fixture).__qa.accountId = "qa-other-account"; });
        await page.clock.setFixedTime(new Date("2026-11-17T12:05:00Z"));
        await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
        await expect(page.getByRole("region", { name: "Ausgewählte Vorgänge" })).toHaveCount(0);
      }
      await page.evaluate(() => (window as unknown as Fixture).applyQA.release?.());
      await expect.poll(() => page.evaluate(() => (window as unknown as Fixture).applyQA.released)).toBe("DEMO-1");
      if (change === "Konto") {
        const accountReads = await page.evaluate(() => (window as unknown as Fixture).applyQA.accountReads.length);
        await page.evaluate(() => { (window as unknown as Fixture).__qa.accountId = undefined; });
        await page.clock.setFixedTime(new Date("2026-11-17T12:10:00Z"));
        await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
        await expect.poll(() => page.evaluate((offset) =>
          (window as unknown as Fixture).applyQA.accountReads.slice(offset).includes("qa-user"), accountReads)).toBe(true);
        await toggle(page, "DEMO-2");
      }
      if (!(await input(page).isVisible())) await page.getByRole("button", { name: "Bearbeiten", exact: true }).press("Enter");
      await expect(input(page)).toBeEnabled();
      await expect(apply(page)).toHaveCount(0);
      await expect(input(page)).toHaveValue("");
      expect(await writes(page)).toEqual([]);
    });
  }

  test("QA-Build bleibt außerhalb des freigegebenen Szenarios lesend", async ({ page }) => {
    await open(page, ["DEMO-1"], fixture.replace("table-field-apply", "multi-links"));
    await preview(page, "DEMO-1\t2026-12-18");
    await expect(apply(page)).toHaveCount(0);
    expect(await writes(page)).toEqual([]);
  });
});

test("normaler Build bleibt trotz Fixture-Markierung lesend", async ({ page }) => {
  test.skip(!process.env.N02_APPLY_PRODUCTION_URL, "Requires the isolated normal production build");
  await open(page, ["DEMO-1"], new URL(fixture, process.env.N02_APPLY_PRODUCTION_URL).href);
  await preview(page, "DEMO-1\t2026-12-18");
  expect(await page.evaluate(() => (window as unknown as Fixture).__qaTableFieldApply?.())).toBe(true);
  await expect(apply(page)).toHaveCount(0);
  expect(await writes(page)).toEqual([]);
});
