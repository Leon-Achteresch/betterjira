import { expect, test, type Page } from "@playwright/test";
import hintFixture from "../jira/fixtures/creation-hints.json" with { type: "json" };

const route = "/tests/browser/fixture.html?scenario=create&route=/neu";
const summary = "Gateway Fehler";
const draftText = "Details bleiben im Entwurf.";
const draftCustomer = "Nur für den Entwurf";
const myWorkJql = "assignee = currentUser() AND (statusCategory != Done OR resolved >= -7d) ORDER BY updated DESC";
const mixed = {
  ...hintFixture,
  issues: hintFixture.issues.map((issue) => issue.fields.project?.id === "101"
    ? { ...issue, fields: { ...issue.fields, project: { ...issue.fields.project, id: "1" } } } : issue),
};
const otherProject = {
  issues: [
    { id: "20", key: "OPS-20", fields: { summary: "Betrieb prüft Gateway", project: { id: "2", key: "OPS" } } },
    mixed.issues[0],
  ],
  isLast: true,
};
type Answer = { status?: number; hold?: boolean; page?: { issues: unknown[]; isLast?: boolean; nextPageToken?: string } };
type HintRead = { method: string; account: string; params: Record<string, string> };
type HintFixture = {
  __qa: { accountId?: string; issueReads: string[]; searches: string[]; writes: unknown[] };
  __qaSearchRule: (jql: string, token: string | null, params: URLSearchParams, method: string) => Answer & { waitFor?: Promise<void> } | undefined;
  __qaCreateFieldsRule: (projectId: string, typeId: string, fields: { fieldId: string }[]) => { fieldId: string }[] | undefined;
  __n09: { reads: HintRead[]; released: number[]; release?: () => void };
};

const main = (page: Page) => page.getByRole("main");
const field = (page: Page, name: string) => main(page).getByRole("textbox", { name, exact: true });
const combo = (page: Page, name: string) => main(page).getByRole("combobox", { name, exact: true });
const trigger = (page: Page) => main(page).getByRole("button", { name: "Ähnliche Anliegen suchen", exact: true });
const popup = (page: Page) => page.getByRole("dialog", { name: "Hinweise auf ähnliche Anliegen" });
const retry = (page: Page) => popup(page).getByRole("button", { name: "Erneut bewusst suchen" });
const submit = (page: Page) => main(page).getByRole("button", { name: "Erstellen", exact: true });
const reads = (page: Page) => page.evaluate(() => (window as unknown as HintFixture).__n09.reads);
const writes = (page: Page) => page.evaluate(() => (window as unknown as HintFixture).__qa.writes);
const formSearches = async (page: Page) => (await page.evaluate(
  () => (window as unknown as HintFixture).__qa.searches,
)).filter((jql) => jql !== myWorkJql);
const release = async (page: Page, index: number) => {
  await page.evaluate(() => (window as unknown as HintFixture).__n09.release?.());
  await expect.poll(() => page.evaluate(() => (window as unknown as HintFixture).__n09.released)).toContain(index);
};
const request = (project: "1" | "2", account = "qa-user", terms = ["Gateway", "Fehler"]): HintRead => ({
  method: "GET",
  account,
  params: {
    jql: `project = "${project}" AND (${terms.map((term) => `summary ~ "${term}*"`).join(" OR ")}) ORDER BY updated DESC`,
    fields: "summary,project,status,issuetype",
    maxResults: "10",
  },
});

async function open(page: Page, answers: Answer[]) {
  await page.addInitScript((plan) => {
    const windowFixture = window as unknown as HintFixture;
    const fixture: HintFixture["__n09"] = { reads: [], released: [] };
    windowFixture.__n09 = fixture;
    windowFixture.__qaCreateFieldsRule = (projectId, _typeId, fields) => projectId === "2"
      ? fields.filter(({ fieldId }) => fieldId !== "customfield_team") : undefined;
    windowFixture.__qaSearchRule = (jql, _token, params, method) => {
      if (!jql.includes(" AND (summary ~ ")) return;
      const index = fixture.reads.length;
      fixture.reads.push({ method, account: windowFixture.__qa.accountId ?? "qa-user", params: Object.fromEntries(params) });
      const answer = plan[index] ?? { status: 400 };
      const waitFor = answer.hold ? new Promise<void>((resolve) => {
        fixture.release = () => {
          delete fixture.release;
          fixture.released.push(index);
          resolve();
        };
      }) : undefined;
      return { ...answer, waitFor };
    };
  }, answers);
  await page.goto(route);
  await expect(main(page).getByRole("heading", { name: "Ticket erstellen", exact: true })).toBeVisible();
}

async function choose(page: Page, name: string, value: RegExp) {
  await combo(page, name).press("Enter");
  const option = page.getByRole("option", { name: value });
  await expect(option).toBeVisible();
  await option.press("Enter");
  await expect(combo(page, name)).toContainText(value);
}

async function fillDraft(page: Page) {
  await choose(page, "Projekt", /Produktentwicklung/);
  await expect(combo(page, "Vorgangstyp")).toContainText("Aufgabe");
  await field(page, "Titel").fill("ab");
  await expect(trigger(page)).toBeDisabled();
  await field(page, "Titel").fill(summary);
  await field(page, "Beschreibung").fill(draftText);
  await choose(page, "Priorität", /^Hoch$/);
  await field(page, "Kunde").fill(draftCustomer);
  await expect(trigger(page)).toBeEnabled();
  expect(await reads(page)).toEqual([]);
  expect(await formSearches(page)).toEqual([]);
  expect(await writes(page)).toEqual([]);
}

async function expectDraft(page: Page) {
  await expect(combo(page, "Projekt")).toContainText("Produktentwicklung");
  await expect(combo(page, "Vorgangstyp")).toContainText("Aufgabe");
  await expect(field(page, "Titel")).toHaveValue(summary);
  await expect(field(page, "Beschreibung")).toHaveText(draftText);
  await expect(combo(page, "Priorität")).toContainText("Hoch");
  await expect(field(page, "Kunde")).toHaveValue(draftCustomer);
}

test.beforeEach(async ({ page }, info) => {
  page.on("pageerror", (error) => { throw error; });
  if (info.project.name === "narrow-dark-reduced") await page.setViewportSize({ width: 390, height: 720 });
});

test.afterEach(async ({ page }, info) => {
  if (page.isClosed()) return;
  const ledger = await page.evaluate(() => {
    const { __qa, __n09 } = window as unknown as HintFixture;
    return __qa && __n09 && { hintReads: __n09.reads, released: __n09.released, allSearches: __qa.searches, writes: __qa.writes };
  });
  if (ledger) await info.attach("jira-ledger", { body: JSON.stringify(ledger), contentType: "application/json" });
});

test("explizite Suche, Teilabdeckung, Ticketdetail und unveränderter Entwurf bis zum absichtlichen Erstellen", async ({ page }, info) => {
  await open(page, [{ page: mixed }]);
  await fillDraft(page);
  await field(page, "Titel").focus();
  await page.keyboard.press("Tab");
  await expect(trigger(page)).toBeFocused();
  await page.keyboard.press("Enter");
  const result = popup(page);
  await expect(result.getByRole("status")).toContainText("3 prüfbare Hinweise aus 6 gelieferten Treffern");
  await expect(result).toContainText("Quelle:");
  await expect(result).toContainText("Lokale UI-Testdaten");
  await expect(result).toContainText("Zielprojekt DEMO");
  await expect(result).toContainText("Gateway* · Fehler*");
  await expect(result).toContainText("2 Treffer ohne bestätigtes Zielprojekt oder lesbaren Titel ausgelassen");
  await expect(result).toContainText("1 doppelt gelieferte Treffer nur einmal gezeigt");
  await expect(result).toContainText("Weitere Suchtreffer möglich; sie werden hier nicht nachgeladen.");
  const rows = result.getByRole("listitem");
  await expect(rows).toHaveCount(3);
  await expect(rows.first()).toContainText("Bug · Offen");
  await expect(rows.last()).toContainText("Typ nicht geliefert · Status nicht geliefert");
  await expect(result.getByText("Fremdes Anliegen")).toHaveCount(0);
  await expect(retry(page)).toBeVisible();
  await expect(result).toBeInViewport({ ratio: 0.99 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await result.screenshot({ path: info.outputPath("creation-hints.png") });
  expect(await reads(page)).toEqual([request("1")]);
  expect(await formSearches(page)).toEqual([request("1").params.jql]);
  expect(await writes(page)).toEqual([]);

  await result.getByRole("button", { name: /DEMO-1 Gateway meldet Fehler/ }).press("Enter");
  await expect(page).toHaveURL(/\/issue\/DEMO-1$/);
  await expect.poll(() => page.evaluate(() => (window as unknown as HintFixture).__qa.issueReads)).toContain("/issue/DEMO-1?fields=*all");
  expect(await writes(page)).toEqual([]);
  await page.goBack();
  await expect(page).toHaveURL(/\/neu$/);
  await expectDraft(page);
  await expect(popup(page)).toHaveCount(0);
  expect(await reads(page)).toEqual([request("1")]);
  expect(await writes(page)).toEqual([]);

  await submit(page).press("Enter");
  await expect(page).toHaveURL(/\/issue\/DEMO-4$/);
  await expect(main(page).getByRole("heading", { name: summary, exact: true })).toBeVisible();
  expect(await writes(page)).toEqual([{
    method: "POST", path: "/issue", input: { fields: {
      project: { id: "1" }, issuetype: { id: "10001" }, summary,
      description: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: draftText }] }] },
      priority: { id: "2" }, customfield_kunde: draftCustomer,
    } },
  }]);
  expect(await reads(page)).toEqual([request("1")]);
});

test("403 bleibt ein Fehler und neue Versuche unterscheiden unbekanntes und bestätigtes Suchende", async ({ page }) => {
  await open(page, [{ status: 403 }, { page: { issues: [] } }, { page: { issues: [], isLast: true } }]);
  await fillDraft(page);
  await trigger(page).press("Enter");
  await expect(popup(page).getByRole("alert")).toContainText("Hinweise konnten nicht gelesen werden");
  await expect(popup(page).getByRole("list")).toHaveCount(0);
  expect(await reads(page)).toEqual([request("1")]);
  await retry(page).press("Enter");
  await expect(popup(page)).toContainText("Jira liefert keine bestätigte Angabe zum Suchende.");
  await expect(popup(page)).toContainText("Keine prüfbaren Hinweise in dieser Suchseite.");
  await retry(page).press("Enter");
  await expect(popup(page)).toContainText("Jira bestätigt das Ende dieser Suchabfrage.");
  expect(await reads(page)).toEqual([request("1"), request("1"), request("1")]);
  await page.keyboard.press("Escape");
  await expect(popup(page)).toHaveCount(0);
  await expect(trigger(page)).toBeFocused();
  await expectDraft(page);
  expect(await writes(page)).toEqual([]);
});

test("Abbruch verwirft die verspätete Antwort und lässt den Entwurf für eine neue Suche stehen", async ({ page }) => {
  await open(page, [{ page: mixed, hold: true }, { page: { issues: [], isLast: true } }]);
  await fillDraft(page);
  await trigger(page).press("Enter");
  await expect.poll(() => reads(page)).toEqual([request("1")]);
  await expect(popup(page).getByRole("status")).toContainText("Suche läuft");
  await expect(trigger(page)).toBeDisabled();
  await popup(page).getByRole("button", { name: "Suche abbrechen" }).press("Enter");
  await expect(popup(page).getByRole("status")).toContainText("Keine Treffer dieses Laufs übernommen.");
  await release(page, 0);
  await expect(popup(page).getByRole("list")).toHaveCount(0);
  await retry(page).press("Enter");
  await expect(popup(page)).toContainText("0 prüfbare Hinweise aus 0 gelieferten Treffern");
  expect(await reads(page)).toEqual([request("1"), request("1")]);
  await page.keyboard.press("Escape");
  await expect(popup(page)).toHaveCount(0);
  await expectDraft(page);
  expect(await writes(page)).toEqual([]);
});

test("Projektwechsel bei gehaltenem Request bindet die nächste Suche ausschließlich an das neue Ziel", async ({ page }) => {
  await open(page, [{ page: mixed, hold: true }, { page: otherProject }]);
  await fillDraft(page);
  await trigger(page).press("Enter");
  await expect.poll(() => reads(page)).toEqual([request("1")]);
  await choose(page, "Projekt", /Betrieb/);
  await expect(popup(page)).toHaveCount(0);
  await expect(field(page, "Titel")).toHaveValue(summary);
  await expect(trigger(page)).toBeEnabled();
  await release(page, 0);
  expect(await reads(page)).toEqual([request("1")]);
  await trigger(page).press("Enter");
  await expect(popup(page)).toContainText("Zielprojekt OPS");
  await expect(popup(page).getByRole("listitem")).toHaveCount(1);
  await expect(popup(page).getByRole("listitem")).toContainText("OPS-20");
  await expect(popup(page)).toContainText("1 Treffer ohne bestätigtes Zielprojekt oder lesbaren Titel ausgelassen");
  expect(await reads(page)).toEqual([request("1"), request("2")]);
  expect(await writes(page)).toEqual([]);
});

test("Kontowechsel verwirft eine gehaltene Seite und stellt beim Zurückwechseln nur den Entwurf wieder her", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-17T12:00:00Z"));
  await open(page, [{ page: mixed, hold: true }, { page: { issues: [], isLast: true } }]);
  await fillDraft(page);
  await trigger(page).press("Enter");
  await expect.poll(() => reads(page)).toEqual([request("1")]);
  await page.evaluate(() => { (window as unknown as HintFixture).__qa.accountId = "qa-other-account"; });
  await page.clock.setFixedTime(new Date("2026-11-17T12:05:00Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
  await expect(popup(page)).toHaveCount(0);
  await expect(field(page, "Titel")).toHaveValue("");
  await expect(trigger(page)).toBeDisabled();
  await release(page, 0);
  expect(await reads(page)).toEqual([request("1")]);
  await choose(page, "Projekt", /Produktentwicklung/);
  await field(page, "Titel").fill("Neues Konto");
  await expect(trigger(page)).toBeEnabled();
  await trigger(page).press("Enter");
  await expect(popup(page)).toContainText("0 prüfbare Hinweise aus 0 gelieferten Treffern");
  expect(await reads(page)).toEqual([request("1"), request("1", "qa-other-account", ["Neues", "Konto"])]);

  await page.evaluate(() => { delete (window as unknown as HintFixture).__qa.accountId; });
  await page.clock.setFixedTime(new Date("2026-11-17T12:10:00Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
  await expect(popup(page)).toHaveCount(0);
  await expectDraft(page);
  expect(await reads(page)).toHaveLength(2);
  expect(await writes(page)).toEqual([]);
});
