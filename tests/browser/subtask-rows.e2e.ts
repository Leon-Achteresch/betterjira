import { expect, test, type Page } from "@playwright/test";

type Write = { path: string; method: string; input: { fields: { summary: string } }; failed?: number };
type Fault = "account" | "permission" | "type" | "fields" | "parent" | "project";
type Fixture = {
  __qa: { writes: Write[]; accountId?: string; myselfCalls: number; issues: { id: string; key: string; fields: unknown }[] };
  __qaReadRule?: (path: string, params: URLSearchParams) => Promise<{ body: unknown } | undefined>;
  __qaBulkWriteRule?: (path: string, input: Write["input"]) => { status: number; body: unknown } | undefined;
  __qaSubtaskRows?: () => boolean;
  rowsQA: { fault?: Fault; hold?: number; parents: number; checks: string[]; reached?: boolean; released?: boolean; release?: () => void };
};

const fixture = (scenario: string, key = "DEMO-1") => `/tests/browser/fixture.html?scenario=${scenario}&route=/issue/${key}`;
const opener = (page: Page) => page.getByRole("button", { name: "Mehrere Unteraufgaben vorbereiten" });
const draft = (page: Page) => page.getByRole("region", { name: "Mehrere Unteraufgaben" });
const input = (page: Page) => draft(page).getByRole("textbox", { name: "Titel der Unteraufgaben" });
const selected = (page: Page) => draft(page).getByRole("button", { name: /verbindlich erstellen/ });
const results = (page: Page) => draft(page).getByRole("list", { name: "Ergebnisse je Unteraufgabenzeile" }).getByRole("listitem");
const writes = (page: Page) => page.evaluate(() => (window as unknown as Fixture).__qa.writes);
const enterCreate = (page: Page) => page.getByRole("link", { name: "Unteraufgabe erstellen", exact: true }).press("Enter");

const open = async (page: Page, scenario = "subtask-rows", origin = "") => {
  await page.goto(`${origin}${fixture(scenario)}`);
  await enterCreate(page);
  await expect(page).toHaveURL(/\/neu\?parent=DEMO-1$/);
  await opener(page).press("Enter");
  await page.keyboard.press("Tab");
  await expect(input(page)).toBeFocused();
  await expect(draft(page)).toContainText(/DEMO-1.*Produktentwicklung.*Unteraufgabe/);
};

const preview = async (page: Page, text: string) => {
  await input(page).fill(text);
  await draft(page).getByRole("button", { name: "Vorschau prüfen" }).press("Enter");
  await expect(draft(page).getByRole("list", { name: "Vorschau je Unteraufgabenzeile" })).toBeVisible();
};

const choose = (page: Page, line: number) => draft(page).getByRole("checkbox", { name: new RegExp(`^${line}\\. `) }).press("Space");

const post = (summary: string, failed?: number) => ({ path: "/issue", method: "POST", input: { fields: {
  summary, project: { id: "1" }, issuetype: { id: "10003" }, parent: { id: "1" },
} }, ...(failed && { failed }) });

test.beforeEach(async ({ page }, info) => {
  if (info.project.name === "narrow-dark-reduced") await page.setViewportSize({ width: 390, height: 720 });
  await page.route("**/*", (route) => new URL(route.request().url()).hostname === "127.0.0.1" ? route.continue() : route.abort());
  page.on("pageerror", (error) => { throw error; });
  await page.addInitScript(() => {
    const qa = window as unknown as Fixture;
    qa.rowsQA = { parents: 0, checks: [] };
    qa.__qaReadRule = async (path, params) => {
      const { fault } = qa.rowsQA;
      if (path === "/myself") {
        qa.rowsQA.checks.push("account");
        if (fault === "account") return { body: { accountId: "qa-other-account" } };
      }
      if (path === "/mypermissions" && params.get("permissions") === "CREATE_ISSUES") {
        qa.rowsQA.checks.push("permission");
        if (fault === "permission") return { body: { permissions: { CREATE_ISSUES: { havePermission: false } } } };
      }
      if (path === "/issue/createmeta/1/issuetypes") {
        qa.rowsQA.checks.push("type");
        if (fault === "type") return { body: { total: 1, issueTypes: [{ id: "10003", name: "Unteraufgabe", subtask: false }] } };
      }
      if (path === "/issue/createmeta/1/issuetypes/10003") {
        qa.rowsQA.checks.push("fields");
        if (fault === "fields") return { body: { total: 2, fields: [
          { fieldId: "summary", name: "Titel", required: true, schema: { type: "string" } },
          { fieldId: "description", name: "Beschreibung", required: true, schema: { type: "string" } },
        ] } };
      }
      if (path === "/issue/DEMO-1" && params.get("fields") === "summary,project,issuetype") {
        qa.rowsQA.checks.push("parent");
        const reached = ++qa.rowsQA.parents;
        if (reached === qa.rowsQA.hold) {
          await new Promise<void>((resolve) => {
            qa.rowsQA.reached = true;
            qa.rowsQA.release = resolve;
          });
          qa.rowsQA.released = true;
        }
        if (fault === "parent") return { body: { ...qa.__qa.issues[0], id: "929" } };
        if (fault === "project") return { body: { id: "1", key: "DEMO-1", fields: {
          summary: "Übergeordnetes Ticket", project: { id: "2", key: "OPS", name: "Betrieb" }, issuetype: { subtask: false },
        } } };
      }
    };
  });
});

test.describe("Unteraufgabenabgabe im Loopback-Fixture", () => {
  test.skip(process.env.N03_ROWS_QA !== "1", "Requires the isolated Vite browser-QA build");

  test("bestätigt die exakte Auswahl, zeigt Teilerfolg und hält nach unklarer Antwort an", async ({ page }, info) => {
    await open(page);
    const titles = "  Login prüfen\nAntwort abgelehnt\nAusgelassen\n\nDoppelt\ndoppelt\nUnklare Antwort\nDanach nicht senden";
    await preview(page, titles);
    await expect(selected(page)).toBeDisabled();
    await choose(page, 1);
    await input(page).fill(`${titles}!`);
    await expect(selected(page)).toHaveCount(0);
    await preview(page, titles);
    await expect(selected(page)).toBeDisabled();
    for (const line of [1, 2, 7, 8]) await choose(page, line);
    await expect(selected(page)).toHaveText("4 Unteraufgaben verbindlich erstellen");
    await expect(draft(page).getByText("Titel fehlt.", { exact: true })).toBeVisible();
    await expect(draft(page).getByText("Titel ist im Entwurf doppelt.", { exact: true })).toHaveCount(2);
    expect(await draft(page).evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await writes(page)).toEqual([]);
    const shots = process.env.N03_ROWS_SHOTS;
    if (shots) await draft(page).screenshot({ path: `${shots}/${info.project.name}-preview.png` });
    await page.evaluate(() => {
      const qa = window as unknown as Fixture;
      qa.rowsQA.checks = [];
      qa.__qaBulkWriteRule = (path, { fields }) => {
        if (path !== "/issue") return;
        if (fields.summary === "Antwort abgelehnt") return { status: 401, body: { errorMessages: ["Synthetische Ablehnung"] } };
        if (fields.summary === "Unklare Antwort") return { status: 503, body: { errorMessages: ["Synthetische unklare Rückmeldung"] } };
      };
    });
    await selected(page).press("Enter");
    await expect(results(page)).toHaveCount(8);
    await expect(draft(page).getByRole("heading", { name: "Ergebnisse der Abgabe" })).toBeFocused();
    await expect(results(page).nth(0).getByRole("link", { name: "DEMO-4" })).toHaveAttribute("href", "/issue/DEMO-4");
    await expect(results(page).nth(1)).toContainText("Abgelehnt");
    await expect(results(page).nth(2)).toContainText("Übersprungen");
    for (const index of [3, 4, 5]) await expect(results(page).nth(index)).toContainText("Gesperrt");
    await expect(results(page).nth(6)).toContainText("Unklar");
    await expect(results(page).nth(7)).toContainText("Nach unklarer Rückmeldung angehalten.");
    await expect(selected(page)).toHaveCount(0);
    await expect(input(page)).toHaveAttribute("readonly", "");
    expect(await writes(page)).toEqual([post("Login prüfen"), post("Antwort abgelehnt", 401), post("Unklare Antwort", 503)]);
    expect(await page.evaluate(() => (window as unknown as Fixture).rowsQA.checks.slice(0, 15))).toEqual(
      Array.from({ length: 3 }, () => ["account", "permission", "type", "fields", "parent"]).flat(),
    );
    await expect(page.getByRole("button", { name: "Erstellen", exact: true })).toBeEnabled();
    if (shots) await draft(page).getByRole("list", { name: "Ergebnisse je Unteraufgabenzeile" }).screenshot({ path: `${shots}/${info.project.name}-results.png` });
  });

  for (const [fault, message] of [
    ["account", "Konto oder Zielkontext hat sich geändert."],
    ["permission", "Die Berechtigung zum Erstellen fehlt."],
    ["type", "Der gewählte Unteraufgabentyp ist nicht mehr eindeutig verfügbar."],
    ["fields", "Weitere Pflichtangaben im Einzelformular ausfüllen: Beschreibung."],
    ["parent", "Das übergeordnete Ticket oder sein Projekt konnte nicht mehr bestätigt werden."],
    ["project", "Das übergeordnete Ticket oder sein Projekt konnte nicht mehr bestätigt werden."],
  ] as const) {
    test(`frische ${fault}-Abweichung sperrt beide bestätigten Zeilen`, async ({ page }) => {
      await open(page);
      await preview(page, "Erstes Ticket\nZweites Ticket");
      await choose(page, 1);
      await choose(page, 2);
      await page.evaluate((value) => { (window as unknown as Fixture).rowsQA.fault = value; }, fault);
      await selected(page).press("Enter");
      await expect(results(page)).toHaveCount(2);
      for (const index of [0, 1]) await expect(results(page).nth(index)).toContainText(message);
      expect(await writes(page)).toEqual([]);
    });
  }

  test("eine 201-Antwort mit fremdem Projektschlüssel bleibt unklar", async ({ page }) => {
    await open(page);
    await preview(page, "Erstes Ticket\nZweites Ticket");
    await choose(page, 1);
    await choose(page, 2);
    await page.evaluate(() => {
      (window as unknown as Fixture).__qaBulkWriteRule = (path) => path === "/issue" ? {
        status: 201, body: { id: "10004", key: "OPS-4", self: "https://example.atlassian.net/rest/api/3/issue/10004" },
      } : undefined;
    });
    await selected(page).press("Enter");
    await expect(results(page).nth(0)).toContainText("Unklar");
    await expect(results(page).nth(1)).toContainText("Nach unklarer Rückmeldung angehalten.");
    await expect(results(page).getByRole("link")).toHaveCount(0);
    expect(await writes(page)).toEqual([post("Erstes Ticket", 201)]);
  });

  for (const change of ["Konto", "Parent"] as const) {
    test(`${change}-Wechsel beim abschließenden Parent-GET stoppt weitere Abgaben`, async ({ page }) => {
      await page.clock.setFixedTime(new Date("2026-11-17T12:00:00Z"));
      await open(page);
      await preview(page, "Erstes Ticket\nZweites Ticket");
      await choose(page, 1);
      await choose(page, 2);
      await page.evaluate((afterFirst) => {
        const state = (window as unknown as Fixture).rowsQA;
        state.hold = state.parents + (afterFirst ? 2 : 1);
      }, change === "Parent");
      await selected(page).press("Enter");
      await expect.poll(() => page.evaluate(() => (window as unknown as Fixture).rowsQA.reached)).toBe(true);
      if (change === "Konto") {
        const accountReads = await page.evaluate(() => (window as unknown as Fixture).__qa.myselfCalls);
        await page.evaluate(() => { (window as unknown as Fixture).__qa.accountId = "qa-other-account"; });
        await page.clock.setFixedTime(new Date("2026-11-17T12:05:00Z"));
        await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
        await expect.poll(() => page.evaluate(() => (window as unknown as Fixture).__qa.myselfCalls)).toBeGreaterThan(accountReads);
      } else {
        await page.getByRole("main").getByRole("link", { name: /^DEMO-1 · / }).press("Enter");
        await expect(page).toHaveURL(/\/issue\/DEMO-1$/);
        await page.getByRole("group", { name: "blocks", exact: true }).getByRole("link", { name: /DEMO-2/ }).press("Enter");
        await expect(page).toHaveURL(/\/issue\/DEMO-2$/);
        await enterCreate(page);
        await expect(page).toHaveURL(/\/neu\?parent=DEMO-2$/);
        await expect(opener(page)).toBeEnabled();
      }
      await expect(input(page)).toHaveCount(0);
      await page.evaluate(() => (window as unknown as Fixture).rowsQA.release?.());
      await expect.poll(() => page.evaluate(() => (window as unknown as Fixture).rowsQA.released)).toBe(true);
      await opener(page).press("Enter");
      await expect(input(page)).toHaveValue("");
      if (change === "Parent") await expect(draft(page)).toContainText("DEMO-2");
      await expect(selected(page)).toHaveCount(0);
      expect(await writes(page)).toEqual(change === "Parent" ? [post("Erstes Ticket")] : []);
    });
  }

  test("QA-Build bleibt außerhalb des freigegebenen Szenarios lesend", async ({ page }) => {
    await open(page, "create");
    await preview(page, "Vorschau ohne Abgabe");
    await expect(draft(page)).toContainText("Diese Ansicht erstellt keine Tickets.");
    await expect(selected(page)).toHaveCount(0);
    expect(await writes(page)).toEqual([]);
  });
});

test("Produktionsbuild bleibt auch mit Fixture-Marker lesend und erhält den Einzelentwurf", async ({ page }) => {
  const origin = process.env.N03_ROWS_PRODUCTION_URL;
  test.skip(!origin, "Requires the separately served production build");
  await open(page, "subtask-rows", origin);
  expect(await page.evaluate(() => (window as unknown as Fixture).__qaSubtaskRows?.())).toBe(true);
  const singleTitle = page.getByRole("textbox", { name: "Titel", exact: true });
  await singleTitle.fill("Unabhängiger Einzelentwurf");
  await preview(page, "Nur prüfen\nVorbereiten");
  await expect(draft(page)).toContainText("Diese Ansicht erstellt keine Tickets.");
  await expect(selected(page)).toHaveCount(0);
  await input(page).press("Control+Enter");
  await draft(page).getByRole("button", { name: "Entwurf schließen" }).press("Enter");
  await expect(opener(page)).toBeFocused();
  await expect(singleTitle).toHaveValue("Unabhängiger Einzelentwurf");
  await expect(page.getByRole("button", { name: "Erstellen", exact: true })).toBeEnabled();
  expect(await writes(page)).toEqual([]);
});
