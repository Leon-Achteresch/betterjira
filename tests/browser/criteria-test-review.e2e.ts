import { expect, test, type Page } from "@playwright/test";

const ENTRY = "/tests/browser/fixture.html?route=/issue/DEMO-1";
const TITLE = "Kriterium und Testbezug prüfen";
const ORIGIN_FIELDS = "description,issuelinks";
const TARGET_FIELDS = "summary,issuetype,issuelinks";
const trigger = (page: Page) => page.getByRole("button", { name: TITLE, exact: true });
const dialog = (page: Page) => page.getByRole("dialog", { name: TITLE });
const criterion = (page: Page) => dialog(page).getByLabel("Kriterium aus der Beschreibung");
const link = (page: Page) => dialog(page).getByLabel("Vorhandene Testverknüpfung");
const check = (page: Page) => dialog(page).getByRole("button", { name: "Auswahl prüfen" });
const result = (page: Page) => dialog(page).getByRole("region", { name: "Lokale Vorschau der Auswahl" });

type Read = { path: string; fields: string | null; account: string };
type Seed = "normal" | "missing-criterion" | "ambiguous-links" | "absent-links";
type State = { reads: Read[]; accounts: string[]; failure?: "denied" | "not-test" | "changed-criterion"; hold?: boolean; release?: () => void; resolved?: boolean };
type Fixture = {
  __n18: State;
  __qa: { accountId?: string; writes: unknown[]; issues: { id: string; key: string; fields: { description: unknown } }[] };
  __qaInitialDescription: unknown;
  __qaIssueLinksRule: (key: string) => { issuelinks: unknown[] };
  __qaReadRule: (path: string, params: URLSearchParams) => Promise<unknown>;
};

async function seed(page: Page, mode: Seed = "normal") {
  await page.addInitScript(({ mode, originFields, targetFields }) => {
    const app = window as unknown as Fixture;
    const state: State = { reads: [], accounts: [] };
    app.__n18 = state;
    const paragraph = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
    const row = (text: string) => ({ type: "listItem", content: [paragraph(text)] });
    const heading = { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Akzeptanzkriterien" }] };
    const doc = (first: string) => ({ type: "doc", version: 1, content: [heading, { type: "bulletList", content: [
      row(first), row("Die Historie bleibt sichtbar"), row("Doppelte Zeile"), row("doppelte zeile"),
      { type: "listItem", content: [paragraph("Mit Unterliste"), { type: "bulletList", content: [row("Kein eigenes Kriterium")] }] },
    ] }] });
    app.__qaInitialDescription = mode === "missing-criterion" ? { type: "doc", version: 1, content: [paragraph("Akzeptanzkriterien: Beleg herunterladen")] } : doc("Beleg kann heruntergeladen werden");

    const type = { id: "23", name: "Tests", inward: "is tested by", outward: "tests" };
    const edge = { id: "test-edge", type, inwardIssue: { key: "DEMO-2" } };
    const unrelated = { id: "unrelated", type: { id: "9", name: "Relates", inward: "relates to", outward: "relates to" }, outwardIssue: { key: "DEMO-3", fields: { summary: "Test im Titel" } } };
    const links = mode === "absent-links" ? [unrelated] : mode === "ambiguous-links" ? [edge, { ...edge, id: "parallel-edge" }, unrelated] : [edge, unrelated];
    app.__qaIssueLinksRule = (key) => ({ issuelinks: key === "DEMO-1" ? links : [] });
    app.__qaReadRule = async (path, params) => {
      const fields = params.get("fields");
      const account = app.__qa.accountId ?? "qa-user";
      if (path === "/myself") state.accounts.push(account);
      if (fields !== originFields && fields !== targetFields) return;
      state.reads.push({ path, fields, account });
      const issue = app.__qa.issues.find(({ key }) => path === `/issue/${key}`);
      if (fields === originFields && issue?.key === "DEMO-1") return { body: {
        id: issue.id, key: issue.key, fields: { description: state.failure === "changed-criterion" ? doc("Ein anderes Kriterium") : issue.fields.description, issuelinks: links },
      } };
      if (fields !== targetFields || issue?.key !== "DEMO-2") return;
      if (state.failure === "denied") return { status: 403, body: { errorMessages: ["Fixture-Detail bleibt intern"] } };
      if (state.hold) {
        state.hold = false;
        await new Promise<void>((resolve) => { state.release = resolve; });
        state.resolved = true;
      }
      return { body: { id: issue.id, key: issue.key, fields: {
        summary: "Belegdownload im Browser",
        issuetype: { id: "5001", name: state.failure === "not-test" ? "Test Set" : "Test" },
        issuelinks: [{ id: edge.id, type, outwardIssue: { key: "DEMO-1" } }],
      } } };
    };
  }, { mode, originFields: ORIGIN_FIELDS, targetFields: TARGET_FIELDS });
}

const ledger = (page: Page) => page.evaluate(() => {
  const app = window as unknown as Fixture;
  return { reads: app.__n18.reads, accountReads: app.__n18.accounts, writes: app.__qa.writes };
});
const fixture = (page: Page, patch: Partial<State>) => page.evaluate((values) => {
  Object.assign((window as unknown as Fixture).__n18, values);
}, patch);
async function open(page: Page) {
  await expect(trigger(page)).toBeEnabled();
  await trigger(page).press("Enter");
  await expect(dialog(page).getByRole("heading", { name: TITLE })).toBeFocused();
}
async function choose(page: Page) {
  await criterion(page).selectOption("1");
  await link(page).selectOption("test-edge");
}
async function assertReadOnly(page: Page) {
  const evidence = await ledger(page);
  expect(evidence.writes).toEqual([]);
  await test.info().attach("n18-ledger", { body: JSON.stringify(evidence), contentType: "application/json" });
}

test("N18 prüft die ausdrückliche Auswahl lokal und gibt den Fokus beim Schließen zurück", async ({ page }, info) => {
  await seed(page);
  if (info.project.name === "narrow-dark-reduced") await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(ENTRY);
  await open(page);
  await expect(criterion(page)).toHaveValue("");
  await expect(link(page)).toHaveValue("");
  await expect(check(page)).toBeDisabled();
  await expect(criterion(page).locator("option")).toHaveCount(3);
  await expect(dialog(page)).toContainText("3 mehrdeutige oder nicht unterstützte Listeneinträge");
  await expect(link(page).locator("option")).toHaveCount(2);
  await criterion(page).selectOption("1");
  await expect(check(page)).toBeDisabled();
  await link(page).selectOption("test-edge");
  expect((await ledger(page)).reads).toEqual([]);
  await expect(result(page)).toHaveCount(0);
  await check(page).press("Enter");
  await expect(result(page)).toContainText("DEMO-1 · Kriterium 1");
  await expect(result(page)).toContainText("Beleg kann heruntergeladen werden");
  await expect(result(page)).toContainText("DEMO-2 · Test · Belegdownload im Browser");
  await expect(result(page)).toContainText("is tested by");
  await expect(dialog(page)).toContainText("Testabdeckung und Testergebnis bleiben ungeprüft");
  expect((await ledger(page)).reads).toEqual([
    { path: "/issue/DEMO-1", fields: ORIGIN_FIELDS, account: "qa-user" },
    { path: "/issue/DEMO-2", fields: TARGET_FIELDS, account: "qa-user" },
  ]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  const shots = process.env.CRITERIA_TEST_REVIEW_SHOTS;
  if (shots) await dialog(page).screenshot({ path: `${shots}/${info.project.name}-n18.png` });
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  await expect(trigger(page)).toBeFocused();
  await open(page);
  await expect(result(page)).toHaveCount(0);
  await expect(criterion(page)).toHaveValue("");
  await expect(link(page)).toHaveValue("");
  expect((await ledger(page)).reads).toHaveLength(2);
  await assertReadOnly(page);
});

for (const mode of ["missing-criterion", "ambiguous-links", "absent-links"] as const) {
  test(`N18 sperrt ohne eindeutige Voraussetzungen (${mode})`, async ({ page }) => {
    await seed(page, mode);
    await page.goto(ENTRY);
    await open(page);
    if (mode === "missing-criterion") {
      await expect(criterion(page)).toBeDisabled();
      await expect(dialog(page)).toContainText("Keine Kriterienliste gefunden");
    } else {
      await expect(link(page)).toBeDisabled();
      await expect(dialog(page)).toContainText("Keine eindeutige Testverknüpfung");
    }
    await expect(check(page)).toBeDisabled();
    await expect(result(page)).toHaveCount(0);
    expect((await ledger(page)).reads).toEqual([]);
    await assertReadOnly(page);
  });
}

test("N18 zeigt geänderte Kriterien, fehlende Leserechte und unklaren Testtyp ohne Vorschau", async ({ page }) => {
  await seed(page);
  await page.goto(ENTRY);
  await open(page);
  await choose(page);
  for (const [failure, message, expectedReads] of [
    ["changed-criterion", /nicht mehr eindeutig/, 1],
    ["denied", /nicht lesbar/, 3],
    ["not-test", /bestätigt das Ziel nicht/, 5],
  ] as const) {
    await fixture(page, { failure });
    await check(page).click();
    await expect(dialog(page).getByRole("alert")).toHaveText(message);
    await expect(result(page)).toHaveCount(0);
    expect((await ledger(page)).reads).toHaveLength(expectedReads);
  }
  await assertReadOnly(page);
});

for (const change of ["ticket", "account"] as const) {
  test(`N18 verwirft eine späte Antwort nach Kontextwechsel (${change})`, async ({ page }) => {
    await seed(page);
    await page.goto(ENTRY);
    await open(page);
    await choose(page);
    await fixture(page, { hold: true });
    await check(page).click();
    await expect(dialog(page).getByRole("status", { name: "Kriterium und verknüpftes Ticket werden geprüft" })).toBeVisible();
    await expect.poll(async () => (await ledger(page)).reads.length).toBe(2);
    if (change === "ticket") {
      const linkPanel = page.locator("section").filter({ has: page.getByRole("heading", { name: /^Verknüpfungen/ }) });
      await linkPanel.getByRole("link", { name: /DEMO-2/ }).click();
      await expect(page).toHaveURL(/\/issue\/DEMO-2$/);
    } else {
      const time = await page.evaluate(() => {
        (window as unknown as Fixture).__qa.accountId = "qa-other-account";
        return Date.now();
      });
      await page.clock.setFixedTime(new Date(time + 120_000));
      await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
      await expect.poll(async () => (await ledger(page)).accountReads.includes("qa-other-account")).toBe(true);
    }
    await expect(dialog(page)).toHaveCount(0);
    await page.evaluate(() => (window as unknown as Fixture).__n18.release?.());
    await expect.poll(() => page.evaluate(() => (window as unknown as Fixture).__n18.resolved)).toBe(true);
    await open(page);
    await expect(result(page)).toHaveCount(0);
    await expect(link(page)).toHaveValue("");
    expect((await ledger(page)).reads).toHaveLength(2);
    await assertReadOnly(page);
  });
}
