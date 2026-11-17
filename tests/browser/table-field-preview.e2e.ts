import { expect, test, type Page } from "@playwright/test";

type JiraFixture = {
  __qa: { writes: unknown[]; accountId?: string };
  __qaReadRule?: (path: string, params: URLSearchParams) => Promise<{ status?: number; body: unknown } | undefined>;
  n02: { reads: string[]; hold?: string; release?: () => void };
};

const fixture = "/tests/browser/fixture.html?scenario=multi-links&route=" + encodeURIComponent("/suche?projekt=DEMO");
const dialog = (page: Page) => page.getByRole("dialog", { name: "Sammelbearbeitung" });
const input = (page: Page) => dialog(page).getByRole("textbox", { name: "Tabellenwerte (TSV)" });
const check = (page: Page) => dialog(page).getByRole("button", { name: "Vorschau prüfen" });
const openButton = (page: Page) => page.getByRole("button", { name: "Bearbeiten", exact: true });
const row = (page: Page, key: string) => page.getByRole("row").filter({ has: page.getByRole("cell", { name: key, exact: true }) });
const results = (page: Page) => dialog(page).getByRole("list", { name: "Prüfung je Tabellenzeile" });
const reads = (page: Page) => page.evaluate(() => (window as unknown as JiraFixture).n02.reads);
const writes = (page: Page) => page.evaluate(() => (window as unknown as JiraFixture).__qa.writes);
const select = async (page: Page, ...keys: string[]) => {
  for (const key of keys) await row(page, key).getByRole("checkbox").press("Space");
};
const enterPreview = async (page: Page) => {
  await openButton(page).press("Enter");
  const operation = dialog(page).getByLabel("Änderung", { exact: true });
  if (!(await input(page).isVisible())) {
    await operation.press("Enter");
    const option = page.getByRole("option", { name: "Tabellenwerte prüfen" });
    await expect(option).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.activeElement?.getAttribute("role"))).toBe("option");
    await page.keyboard.press("End");
    await expect(option).toBeFocused();
    await page.keyboard.press("Enter");
  }
  await expect(input(page)).toBeVisible();
};

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  await page.addInitScript(() => {
    const qa = window as unknown as JiraFixture;
    qa.n02 = { reads: [] };
    qa.__qaReadRule = async (path, params) => {
      if (path.startsWith("/issue/") && params.get("fields") === "duedate,project,issuetype") {
        const key = path.split("/").at(-1)!;
        qa.n02.reads.push(key);
        if (qa.n02.hold === key) {
          qa.n02.hold = undefined;
          await new Promise<void>((resolve) => { qa.n02.release = resolve; });
        }
        if (key === "DEMO-3") return { status: 404, body: { errorMessages: ["Test: Ticket nicht sichtbar"] } };
        return { body: { id: key.split("-")[1], key, fields: {
          duedate: key === "DEMO-4" ? null : "2026-12-12", project: { id: "1" }, issuetype: { id: "task" },
        } } };
      }
      if (path === "/mypermissions" && params.get("permissions") === "EDIT_ISSUES,SCHEDULE_ISSUES") {
        return { body: { permissions: {
          EDIT_ISSUES: { havePermission: true },
          SCHEDULE_ISSUES: { havePermission: params.get("issueKey") !== "DEMO-5" },
        } } };
      }
      if (/^\/issue\/DEMO-[1-6]\/editmeta$/.test(path)) {
        return { body: { fields: {
          assignee: { operations: ["set"] },
          ...(path !== "/issue/DEMO-2/editmeta" && { duedate: { operations: ["set"] } }),
        } } };
      }
    };
  });
});

test("TSV prüft exakte Auswahl, Alt- und Neuwerte und Zeilenfehler über die Suche", async ({ page }, info) => {
  if (info.project.name === "narrow-dark-reduced") await page.setViewportSize({ width: 390, height: 720 });
  await page.goto(fixture);
  await select(page, "DEMO-1", "DEMO-2", "DEMO-3", "DEMO-4", "DEMO-5", "DEMO-6");
  await enterPreview(page);
  await page.keyboard.press("Tab");
  await expect(input(page)).toBeFocused();
  await input(page).fill([
    "DEMO-1\t2026-12-18", "DEMO-2\t2026-12-19", "DEMO-3\t2026-12-20", "DEMO-4\t",
    "DEMO-5\t2026-12-12", "DEMO-7\t2026-12-21", "DEMO-8\t2026-12-21\tmehr",
    "DEMO-9\t2026-12-22", "DEMO-9\t2026-12-23", "\t2026-12-22", "demo-1\t2026-12-22",
  ].join("\n"));
  expect(await reads(page)).toEqual([]);
  await page.keyboard.press("Tab");
  await expect(check(page)).toBeFocused();
  await page.keyboard.press("Enter");
  const items = results(page).getByRole("listitem");
  await expect(items).toHaveCount(11);
  await expect(items.nth(0)).toContainText(/DEMO-1.*2026-12-12.*2026-12-18.*Änderung möglich/);
  await expect(items.nth(1)).toContainText("nicht bearbeitbar");
  await expect(items.nth(2)).toContainText("fehlt oder ist für dieses Konto nicht sichtbar");
  await expect(items.nth(3)).toContainText("Leerwerte ändern nichts");
  await expect(items.nth(4)).toContainText("Rechte zum Bearbeiten oder Planen fehlen");
  await expect(items.nth(5)).toContainText("nicht ausgewählt");
  await expect(items.nth(6)).toContainText("Mehrdeutig");
  await expect(items.nth(7)).toContainText("mehrfach");
  await expect(items.nth(8)).toContainText("mehrfach");
  await expect(items.nth(9)).toContainText("Ticketschlüssel fehlt");
  await expect(items.nth(10)).toContainText("Ungültiger Ticketschlüssel");
  await expect(dialog(page).getByRole("status")).toContainText("1 ohne Tabellenzeile");
  await expect(dialog(page).getByRole("status")).toBeFocused();
  await expect(dialog(page).getByRole("button", { name: "Änderung anwenden" })).toHaveCount(0);
  expect((await reads(page)).sort()).toEqual(["DEMO-1", "DEMO-2", "DEMO-3", "DEMO-5"]);
  expect(await writes(page)).toEqual([]);
  await expect.poll(() => dialog(page).evaluate((element) => {
    const box = element.getBoundingClientRect();
    return box.left >= 7 && box.right <= innerWidth - 7 && box.top >= 7 && box.bottom <= innerHeight - 7;
  })).toBe(true);
  const shots = process.env.N02_SHOTS;
  if (shots) await page.screenshot({ path: `${shots}/${info.project.name}-preview.png` });
  await page.keyboard.press("Escape");
  await expect(openButton(page)).toBeFocused();
});

test("neuer Eingabestand verwirft eine laufende Prüfung und erhält echte Leerwerte", async ({ page }) => {
  await page.goto(fixture);
  await select(page, "DEMO-1", "DEMO-4");
  await enterPreview(page);
  await page.evaluate(() => { (window as unknown as JiraFixture).n02.hold = "DEMO-1"; });
  await input(page).fill("DEMO-1\t2026-12-18");
  await check(page).click();
  await expect.poll(() => reads(page)).toEqual(["DEMO-1"]);
  await input(page).fill("DEMO-4\t2026-12-22");
  await check(page).click();
  await expect(results(page)).toContainText("Ohne Fälligkeit");
  await expect(results(page)).toContainText("2026-12-22");
  await page.evaluate(() => (window as unknown as JiraFixture).n02.release?.());
  await expect(results(page)).not.toContainText("2026-12-18");
  await input(page).fill("DEMO-4\t18.12.2026");
  await expect(results(page)).toHaveCount(0);
  await check(page).click();
  await expect(results(page)).toContainText("Ungültige Fälligkeit");
  await input(page).fill(Array(21).fill("DEMO-4\t2026-12-22").join("\n"));
  await check(page).click();
  await expect(dialog(page).getByRole("alert")).toContainText("20 Zeilen");
  await expect(results(page)).toHaveCount(0);
  await input(page).fill("X".repeat(12_001));
  await expect(input(page)).toHaveValue("");
  await expect(dialog(page).getByRole("alert")).toContainText("12.000 Zeichen");
  await expect(check(page)).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(openButton(page)).toBeFocused();
  await select(page, "DEMO-1", "DEMO-2");
  await enterPreview(page);
  await expect(input(page)).toHaveValue("");
  await input(page).fill("DEMO-1\t2026-12-18");
  await check(page).click();
  await expect(results(page)).toContainText("Ticket ist nicht ausgewählt");
  expect(await reads(page)).toEqual(["DEMO-1", "DEMO-4"]);
  expect(await writes(page)).toEqual([]);
});

test("Kontowechsel während Prüfung trennt Eingabe, Auswahl und verspätete Antwort", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-17T12:00:00Z"));
  await page.goto(fixture);
  await select(page, "DEMO-1");
  await enterPreview(page);
  await page.evaluate(() => { (window as unknown as JiraFixture).n02.hold = "DEMO-1"; });
  await input(page).fill("DEMO-1\t2026-12-18");
  await check(page).click();
  await expect.poll(() => reads(page)).toEqual(["DEMO-1"]);
  await page.evaluate(() => { (window as unknown as JiraFixture).__qa.accountId = "qa-other-account"; });
  await page.clock.setFixedTime(new Date("2026-11-17T12:05:00Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
  await expect(openButton(page)).toHaveCount(0);
  await page.evaluate(() => (window as unknown as JiraFixture).n02.release?.());
  await select(page, "DEMO-1");
  if (!(await input(page).isVisible())) await enterPreview(page);
  await expect(input(page)).toHaveValue("");
  await expect(results(page)).toHaveCount(0);
  expect(await reads(page)).toEqual(["DEMO-1"]);
  expect(await writes(page)).toEqual([]);
});
