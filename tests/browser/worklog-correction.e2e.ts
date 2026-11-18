import { expect, test, type Page } from "@playwright/test";

type Reply = { status?: number; body: unknown };
type Fixture = {
  __qa: { accountId?: string; writes: unknown[]; issues: { id: string; key: string; fields: { worklog: { worklogs: { id: string; author: { accountId: string }; timeSpentSeconds: number }[] } } }[] };
  __qaReadRule: (path: string, params: URLSearchParams) => Promise<Reply | undefined>;
  n07: {
    reads: { path: string; params: string; account: string }[];
    fault?: "author" | "source-id" | "source-edited" | "visibility" | "target-project" | "target-rights" | "source-rights";
    hold?: string;
    reached?: string;
    released?: string;
    release?: () => void;
  };
};

const url = "/tests/browser/fixture.html?scenario=time-tracking&route=/zeiterfassung";
const atTime = new Date("2026-11-06T15:00:00+01:00");
const sourcePath = "/issue/1/worklog/tt-1";
const trigger = (page: Page) => page.getByRole("button", { name: "Korrekturvorschau für DEMO-1 um 09:00", exact: true });
const dialog = (page: Page) => page.getByRole("dialog", { name: "Korrekturvorschau", exact: true });
const field = (page: Page) => dialog(page).getByRole("textbox", { name: "Schlüssel des Zielvorgangs" });
const lookup = (page: Page) => dialog(page).getByRole("button", { name: "Ziel prüfen", exact: true });
const confirm = (page: Page) => dialog(page).getByRole("button", { name: "Ziel bestätigen", exact: true });
const preview = (page: Page) => dialog(page).getByRole("region", { name: "Geprüfte Korrekturwerte", exact: true });
const ledger = (page: Page) => page.evaluate(() => {
  const { __qa, n07 } = window as unknown as Fixture;
  return { reads: n07.reads, writes: __qa.writes };
});
const changeFault = (page: Page, fault: Fixture["n07"]["fault"]) => page.evaluate((value) => { (window as unknown as Fixture).n07.fault = value; }, fault);
const hold = (page: Page, path: string) => page.evaluate((value) => { (window as unknown as Fixture).n07.hold = value; }, path);
const release = (page: Page) => page.evaluate(() => (window as unknown as Fixture).n07.release?.());
const open = async (page: Page) => {
  await page.goto(url);
  await expect(trigger(page)).toBeVisible();
  await trigger(page).press("Enter");
  await expect(field(page)).toBeFocused();
};
const find = async (page: Page, text: string) => {
  await field(page).fill(text);
  await field(page).press("Enter");
};
const choose = async (page: Page, text = "DEMO-2") => {
  await find(page, text);
  await expect(confirm(page)).toBeEnabled();
  await confirm(page).press("Enter");
};

test.beforeEach(async ({ page }, info) => {
  if (info.project.name === "narrow-dark-reduced") await page.setViewportSize({ width: 390, height: 720 });
  await page.clock.setFixedTime(atTime);
  page.on("pageerror", (error) => { throw error; });
  await page.route("**/*", (request) => new URL(request.request().url()).hostname === "127.0.0.1" ? request.continue() : request.abort());
  await page.addInitScript(() => {
    const qa = window as unknown as Fixture;
    qa.n07 = { reads: [] };
    qa.__qaReadRule = async (path, params) => {
      const fieldList = params.get("fields");
      const lookup = fieldList === "summary,project" && path.startsWith("/issue/");
      const source = path === "/issue/1/worklog/tt-1";
      const permission = path === "/mypermissions" && !!params.get("issueId");
      if (!lookup && !source && !permission && path !== "/myself") return;
      qa.n07.reads.push({ path, params: params.toString(), account: qa.__qa.accountId ?? "qa-user" });
      const fault = qa.n07.fault;
      if (qa.n07.hold === path) {
        qa.n07.hold = undefined;
        await new Promise<void>((release) => { qa.n07.reached = path; qa.n07.release = release; });
        qa.n07.released = path;
      }
      if (lookup) {
        const key = path.split("/").at(-1);
        if (key === "DEMO-99") return { status: 404, body: {} };
        if (key === "ALT-1") return { body: { id: "1", key: "DEMO-1", fields: { summary: "Alter Schlüssel", project: { id: "1", key: "DEMO" } } } };
        if (key === "DEMO-3") return { body: { id: "3", key, fields: { summary: "Anderes bewusst gewähltes Ziel", project: { id: "1", key: "DEMO" } } } };
        return { body: { id: "2", key, fields: { summary: "Geprüfter Zielvorgang", project: { id: fault === "target-project" ? "23" : "1", key: "DEMO" } } } };
      }
      if (permission) {
        const id = params.get("issueId");
        if (id === "1") return { body: { permissions: {
          BROWSE_PROJECTS: { havePermission: true },
          ...(fault !== "source-rights" ? { DELETE_OWN_WORKLOGS: { havePermission: true } } : {}),
          DELETE_ALL_WORKLOGS: { havePermission: false },
        } } };
        return { body: { permissions: { BROWSE_PROJECTS: { havePermission: true }, WORK_ON_ISSUES: { havePermission: fault !== "target-rights" } } } };
      }
      if (!source) return;
      const entry = qa.__qa.issues[0]!.fields.worklog.worklogs.find(({ id }) => id === "tt-1")!;
      return { body: {
        ...entry, issueId: fault === "source-id" ? "8" : "1",
        ...(fault === "author" && { author: { accountId: "qa-other" } }),
        ...(fault === "source-edited" && { timeSpentSeconds: 3660 }),
        ...(fault === "visibility" && { visibility: { type: "role", value: "Privat" } }),
      } };
    };
  });
});

test.afterEach(async ({ page }, info) => {
  if (!page.isClosed() && await page.evaluate(() => Reflect.has(window, "__qa")))
    await info.attach("n07-ledger", { body: JSON.stringify(await ledger(page)), contentType: "application/json" });
});

test("Eigene Buchung und ausdrücklich bestätigtes Ziel ergeben eine lesende Vorschau", async ({ page }, info) => {
  await open(page);
  await expect(page.getByRole("button", { name: /Korrekturvorschau für DEMO-1 um 10:00/ })).toHaveCount(0);
  await expect(dialog(page)).toContainText("DEMO-1 · 09:00 · 1 h");
  const initial = (await ledger(page)).reads.length;
  await field(page).fill("https://example.atlassian.net/browse/DEMO-2");
  await expect(lookup(page)).toBeDisabled();
  await field(page).fill("demo-2");
  await expect(lookup(page)).toBeEnabled();
  expect((await ledger(page)).reads.slice(initial).filter(({ path }) => path !== "/myself")).toEqual([]);
  await field(page).press("Enter");
  await expect(dialog(page)).toContainText("Geprüfter Zielvorgang");
  await expect(preview(page)).toHaveCount(0);
  expect((await ledger(page)).reads.slice(initial).map(({ path }) => path)).toEqual(["/myself", "/issue/DEMO-2"]);
  await confirm(page).press("Enter");
  await expect(preview(page)).toBeFocused();
  await expect(preview(page)).toContainText("1 h (3600 s)");
  await expect(preview(page)).toContainText("2026-11-02T09:00:00.000+0100");
  await expect(preview(page)).toContainText("Anforderungen mit dem Team abgestimmt");
  await expect(preview(page)).toContainText("DEMO-2 · DEMO");
  await expect(dialog(page).getByRole("button", { name: /kopieren|löschen|verschieben/i })).toHaveCount(0);
  expect(await dialog(page).evaluate((panel) => panel.scrollWidth <= panel.clientWidth && panel.getBoundingClientRect().right <= innerWidth)).toBe(true);
  const data = await ledger(page);
  expect(data.reads.slice(initial).filter(({ path }) => path === "/issue/DEMO-2").map(({ params }) => new URLSearchParams(params).get("fields")))
    .toEqual(["summary,project", "summary,project"]);
  expect(data.reads.slice(initial).filter(({ path }) => path === sourcePath)).toHaveLength(1);
  expect(data.reads.slice(initial).filter(({ path }) => path === "/mypermissions").map(({ params }) => [...new URLSearchParams(params)].flat().join(" ")).sort())
    .toEqual(["issueId 1 permissions BROWSE_PROJECTS,DELETE_OWN_WORKLOGS,DELETE_ALL_WORKLOGS", "issueId 2 permissions BROWSE_PROJECTS,WORK_ON_ISSUES"]);
  expect(data.writes).toEqual([]);
  await dialog(page).screenshot({ path: info.outputPath("korrekturvorschau.png"), animations: "disabled" });
  await page.keyboard.press("Escape");
  await expect(trigger(page)).toBeFocused();
  await expect(dialog(page)).toHaveCount(0);
  expect((await ledger(page)).writes).toEqual([]);
});

test("Identische, umbenannte und unerreichbare Ziele bleiben gesperrt", async ({ page }) => {
  await open(page);
  await find(page, "DEMO-1");
  await expect(dialog(page).getByRole("alert")).toContainText("anderen Vorgang");
  await find(page, "ALT-1");
  await expect(dialog(page).getByRole("alert")).toContainText("anderen Vorgang");
  await find(page, "DEMO-99");
  await expect(dialog(page).getByRole("alert")).toContainText("nicht erreichbar");
  await find(page, "DEMO-2");
  await expect(confirm(page)).toBeEnabled();
  await changeFault(page, "target-project");
  await confirm(page).press("Enter");
  await expect(dialog(page).getByRole("alert")).toContainText("Zielvorgang hat sich geändert");
  await expect(preview(page)).toHaveCount(0);
  expect((await ledger(page)).reads.filter(({ path }) => path === sourcePath)).toEqual([]);
  expect((await ledger(page)).writes).toEqual([]);
});

test("Frische Quellidentität, Eigentümer und explizit bekannte Rechte sind erforderlich", async ({ page }) => {
  await open(page);
  for (const [fault, message] of [
    ["author", "gehört nicht zum aktuellen Jira-Konto"],
    ["source-id", "Quellbuchung hat sich geändert"],
    ["source-edited", "Quellbuchung hat sich geändert"],
    ["visibility", "Sichtbarkeit der Quellbuchung ist eingeschränkt"],
    ["source-rights", "erforderlichen Jira-Rechte konnten nicht bestätigt werden"],
    ["target-rights", "erforderlichen Jira-Rechte konnten nicht bestätigt werden"],
  ] as const) {
    await field(page).fill("");
    await expect(dialog(page).getByRole("alert")).toHaveCount(0);
    await changeFault(page, fault);
    const previousReads = (await ledger(page)).reads.filter(({ path }) => path === sourcePath).length;
    await choose(page);
    await expect(dialog(page).getByRole("alert")).toContainText(message);
    expect((await ledger(page)).reads.filter(({ path }) => path === sourcePath)).toHaveLength(previousReads + 1);
    await expect(preview(page)).toHaveCount(0);
  }
  expect((await ledger(page)).reads.filter(({ path }) => path === sourcePath)).toHaveLength(6);
  expect((await ledger(page)).writes).toEqual([]);
});

test("Späte Zielantwort wird nach Änderung des Schlüssels verworfen", async ({ page }) => {
  await open(page);
  await hold(page, "/issue/DEMO-2");
  await find(page, "DEMO-2");
  await expect.poll(() => page.evaluate(() => (window as unknown as Fixture).n07.reached)).toBe("/issue/DEMO-2");
  await find(page, "DEMO-3");
  await expect(dialog(page)).toContainText("Anderes bewusst gewähltes Ziel");
  await release(page);
  await expect.poll(() => page.evaluate(() => (window as unknown as Fixture).n07.released)).toBe("/issue/DEMO-2");
  await expect(dialog(page).getByText("Geprüfter Zielvorgang", { exact: true })).toHaveCount(0);
  await confirm(page).press("Enter");
  await expect(preview(page)).toContainText("DEMO-3 · DEMO");
  expect((await ledger(page)).writes).toEqual([]);
});

for (const context of ["Zeitraum", "Konto"] as const) {
  test(`${context} verwirft eine gehaltene Quellantwort`, async ({ page }) => {
    await open(page);
    await hold(page, sourcePath);
    await choose(page);
    await expect.poll(() => page.evaluate(() => (window as unknown as Fixture).n07.reached)).toBe(sourcePath);
    if (context === "Zeitraum") {
      await page.getByRole("link", { name: "Letzte Woche" }).click();
      await expect(page.getByText("Übergabe dokumentiert")).toBeVisible();
    } else {
      await page.evaluate(() => { (window as unknown as Fixture).__qa.accountId = "qa-other"; });
      await page.clock.setFixedTime(new Date(atTime.getTime() + 5 * 60_000));
      await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
      await expect(trigger(page)).toHaveCount(0);
    }
    await expect(dialog(page)).toHaveCount(0);
    await release(page);
    await expect.poll(() => page.evaluate(() => (window as unknown as Fixture).n07.released)).toBe(sourcePath);
    const data = await ledger(page);
    expect(data.reads.filter(({ path }) => path === "/mypermissions")).toEqual([]);
    expect(data.writes).toEqual([]);
    await expect(preview(page)).toHaveCount(0);
  });
}
