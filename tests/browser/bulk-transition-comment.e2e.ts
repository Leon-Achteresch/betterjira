import { expect, test, type Page } from "@playwright/test";

type Write = { path: string; method: string; input: unknown; failed?: number };
type Reply = { body: unknown; status?: number };
type Fixture = {
  __qa: { accountId?: string; writes: Write[]; issues: { id: string; key: string; fields: { status: { id: string }; comment: { comments: { body: unknown }[] } } }[] };
  __qaBulkTransitionComment?: () => boolean;
  __qaReadRule: (path: string, params: URLSearchParams) => Promise<Reply | undefined>;
  __qaBulkWriteRule: (path: string) => Reply | undefined;
  n06: {
    mode: "mixed" | "apply";
    reads: { key: string; kind: string; account: string }[];
    stale?: boolean;
    hold?: string;
    reached?: string;
    released?: string;
    release?: () => void;
    responseAccount?: string;
  };
};

const url = "/tests/browser/fixture.html?scenario=multi-links&route=/bereiche/DEMO";
const dialog = (page: Page) => page.getByRole("dialog", { name: "Sammelbearbeitung" });
const editor = (page: Page) => dialog(page).getByRole("textbox", { name: "Gemeinsame Begründung" });
const openButton = (page: Page) => page.getByRole("button", { name: "Bearbeiten", exact: true });
const check = (page: Page) => dialog(page).getByRole("button", { name: "Übergänge prüfen", exact: true });
const approve = (page: Page) => dialog(page).getByRole("checkbox", { name: "Geeignete Vorgänge und Kommentar bestätigen" });
const submit = (page: Page) => dialog(page).getByRole("button", { name: "Geeignete Vorgänge abschließen", exact: true });
const rows = (page: Page) => dialog(page).getByRole("list", { name: /^Ausgewählt:/ }).getByRole("listitem");
const row = (page: Page, key: string) => rows(page).filter({ has: page.getByText(key, { exact: true }) });
const select = (page: Page, key: string) => page.getByRole("checkbox", { name: `${key} auswählen`, exact: true }).press("Space");
const ledger = (page: Page) => page.evaluate(() => {
  const { __qa, n06 } = window as unknown as Fixture;
  return { reads: n06.reads, writes: __qa.writes };
});

const open = async (page: Page) => {
  await expect(openButton(page)).toBeEnabled();
  if (await openButton(page).getAttribute("aria-expanded") !== "true") await openButton(page).press("Enter");
  await expect(dialog(page)).toBeVisible();
  if (await editor(page).isVisible()) return;
  await dialog(page).getByLabel("Änderung", { exact: true }).press("Enter");
  await page.getByRole("option", { name: "Abschluss mit Begründung", exact: true }).press("Enter");
  await expect(editor(page)).toBeVisible();
};

const enter = async (page: Page, keys: string[]) => {
  await page.goto(url);
  for (const key of keys) await select(page, key);
  await open(page);
};

const choose = async (page: Page) => {
  const status = dialog(page).getByRole("combobox", { name: "Zielstatus" });
  await status.press("Enter");
  await expect(page.getByRole("option", { name: "In Arbeit", exact: true })).toHaveCount(0);
  await page.getByRole("option", { name: "Erledigt", exact: true }).press("Enter");
  await expect(status).toHaveText("Erledigt");
};

const release = (page: Page) => page.evaluate(() => (window as unknown as Fixture).n06.release?.());
const configureApply = (page: Page) => page.addInitScript(() => { (window as unknown as Fixture).__qaBulkTransitionComment = () => true; });
const fixedTime = new Date("2026-11-18T08:00:00Z");
const switchAccount = async (page: Page) => {
  await page.evaluate(() => { (window as unknown as Fixture).__qa.accountId = "qa-n06-other"; });
  await page.clock.setFixedTime(new Date(fixedTime.getTime() + 5 * 60_000));
  await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
  await expect(page.getByRole("region", { name: "Ausgewählte Vorgänge" })).toHaveCount(0);
  await expect(dialog(page)).toHaveCount(0);
};

test.beforeEach(async ({ page }, info) => {
  if (info.project.name === "narrow-dark-reduced") await page.setViewportSize({ width: 390, height: 720 });
  page.on("pageerror", (error) => { throw error; });
  await page.route("**/*", (request) => new URL(request.request().url()).hostname === "127.0.0.1" ? request.continue() : request.abort());
  await page.addInitScript(() => {
    const qa = window as unknown as Fixture;
    const done = { id: "4", name: "Erledigt", statusCategory: { key: "done", colorName: "green" } };
    const working = { id: "3", name: "In Arbeit", statusCategory: { key: "indeterminate", colorName: "yellow" } };
    qa.n06 = { mode: "mixed", reads: [] };
    qa.__qaReadRule = async (path, params) => {
      const { mode, stale, responseAccount } = qa.n06;
      const account = responseAccount ?? qa.__qa.accountId ?? "qa-user";
      if (path === "/myself") {
        qa.n06.reads.push({ key: "", kind: "account", account });
        if (responseAccount) return { body: { accountId: responseAccount } };
      }
      const match = path.match(/^\/issue\/(DEMO-\d+)(\/transitions)?$/);
      const isPermission = path === "/mypermissions" && params.get("permissions") === "TRANSITION_ISSUES,ADD_COMMENTS";
      const kind = isPermission ? "permissions" : match?.[2] && params.get("expand") === "transitions.fields" ? "transitions"
        : match && params.get("fields") === "status" ? "status" : undefined;
      const key = isPermission ? params.get("issueKey") : match?.[1];
      if (!kind || !key) return;
      qa.n06.reads.push({ key, kind, account });
      const number = Number(key.slice(5));
      const transition = { id: number === 1 ? "31" : `31${number}`, name: "Abschließen", to: done, fields: {}, isAvailable: true, isConditional: false };
      const resolution = { ...transition, fields: { resolution: { name: "Erledigungsgrund", required: true, schema: { type: "resolution" } } } };
      if (kind === "permissions") return { body: { permissions: {
        TRANSITION_ISSUES: { havePermission: true },
        ...(mode !== "mixed" || number !== 6 ? { ADD_COMMENTS: { havePermission: mode !== "mixed" || number !== 3 } } : {}),
      } } };
      if (kind === "status") {
        const issue = qa.__qa.issues.find((item) => item.key === key)!;
        return { body: { key, id: mode === "mixed" && number === 10 ? "foreign-id" : issue.id, fields: { status: working } } };
      }

      if (qa.n06.hold === key) {
        qa.n06.hold = undefined;
        await new Promise<void>((resolve) => { qa.n06.reached = key; qa.n06.release = resolve; });
        qa.n06.released = key;
        return { body: { transitions: [{ ...transition, name: "Veraltete Antwort" }] } };
      }
      if (mode === "apply") {
        const candidate = number === 6 ? resolution : number === 3 && stale ? { ...transition, id: "veraltet-ersetzt" } : transition;
        return { body: { transitions: [candidate] } };
      }
      if (number === 5) return { status: 403, body: {} };
      if (number === 2) return { body: { transitions: [resolution] } };
      if (number === 4) return { body: { transitions: [{ ...transition, fields: undefined }] } };
      if (number === 7) return { body: { transitions: [transition, { ...resolution, name: "Alternativer Abschluss", id: "37b" }] } };
      if (number === 8) return { body: { transitions: [{ ...transition, to: working }] } };
      if (number === 9) return { body: { transitions: [{ ...transition, isConditional: true }] } };
      return { body: { transitions: [transition] } };
    };
    qa.__qaBulkWriteRule = (path) => {
      if (qa.n06.mode !== "apply") return;
      const status = path === "/issue/DEMO-2/transitions" ? 403 : path === "/issue/DEMO-4/transitions" ? 503 : undefined;
      if (status) return { status, body: { errorMessages: ["Synthetische Antwort"] } };
    };
  });
});

test.afterEach(async ({ page }, info) => {
  if (!page.isClosed() && await page.evaluate(() => Reflect.has(window, "__qa")))
    await info.attach("n06-ledger", { body: JSON.stringify(await ledger(page)), contentType: "application/json" });
});

test("Abschlussvorschau zeigt die gewählten Vorgänge, fehlende Rechte und Pflichtfelder ohne Writes", async ({ page }, info) => {
  if (process.env.N06_TRANSITION_PRODUCTION === "1") await configureApply(page);
  await enter(page, Array.from({ length: 10 }, (_, index) => `DEMO-${index + 1}`));
  await expect(rows(page)).toHaveCount(10);
  await expect(row(page, "DEMO-11")).toHaveCount(0);
  await expect(editor(page)).toHaveValue("");
  await editor(page).fill("Abnahme durch das Testteam erfolgt.\nDer Nachweis liegt vor.");
  const before = await ledger(page);
  expect(before.reads.filter(({ kind }) => kind === "permissions")).toEqual([]);
  await check(page).press("Enter");
  await choose(page);
  for (const [index, reason] of [
    "Geeignet · Abschließen", "Erledigungsgrund", "Recht zum Kommentieren fehlt",
    "Übergangsmetadaten sind unvollständig", "Jira verweigert den Zugriff", "Rechte zum Übergang oder Kommentieren sind unbekannt",
    "Mehrere Übergänge", "Kein verfügbarer Übergang", "Bedingter Übergang", "Vorgangszuordnung hat sich geändert",
  ].entries()) await expect(row(page, `DEMO-${index + 1}`)).toContainText(reason);
  await expect(row(page, "DEMO-7")).toContainText("Alternativer Abschluss: Erledigungsgrund");
  await expect(dialog(page).getByText("1 von 10 für Abschluss mit Kommentar geeignet")).toBeInViewport({ ratio: 0.9 });
  await expect(row(page, "DEMO-1")).toBeInViewport({ ratio: 0.9 });
  await expect(row(page, "DEMO-2").getByText(/Pflichtfelder für/)).toBeInViewport({ ratio: 0.9 });
  await expect(submit(page)).toHaveCount(0);
  await expect(dialog(page).getByRole("button", { name: "Änderung anwenden" })).toHaveCount(0);
  expect(await dialog(page).evaluate((panel) => panel.scrollWidth <= panel.clientWidth && panel.getBoundingClientRect().right <= innerWidth)).toBe(true);
  const data = await ledger(page);
  expect(data.writes).toEqual([]);
  for (const kind of ["status", "transitions", "permissions"])
    expect(data.reads.slice(before.reads.length).filter((read) => read.kind === kind).map(({ key }) => key).sort()).toEqual(
      Array.from({ length: 10 }, (_, index) => `DEMO-${index + 1}`).sort(),
    );
  await dialog(page).screenshot({ path: info.outputPath("abschlussvorschau.png"), animations: "disabled" });
  await editor(page).press("Escape");
  await expect(openButton(page)).toBeFocused();
  expect((await ledger(page)).writes).toEqual([]);
});

for (const by of ["Abwahl", "Kontowechsel"] as const) {
  test(`${by} verwirft Entwurf und verspätete Metadaten`, async ({ page }) => {
    await page.clock.setFixedTime(fixedTime);
    await enter(page, ["DEMO-1", "DEMO-2"]);
    await editor(page).fill("Alter vorgangsgebundener Entwurf.");
    await page.evaluate(() => { (window as unknown as Fixture).n06.hold = "DEMO-1"; });
    await check(page).press("Enter");
    await expect.poll(() => page.evaluate(() => (window as unknown as Fixture).n06.reached)).toBe("DEMO-1");
    if (by === "Abwahl") {
      const selected = page.getByRole("checkbox", { name: "DEMO-1 auswählen", exact: true });
      await selected.click();
      await expect(selected).not.toBeChecked();
      await expect(dialog(page)).toHaveCount(0);
    } else {
      await switchAccount(page);
      await select(page, "DEMO-2");
    }
    if (!(await editor(page).isVisible())) await open(page);
    await expect(editor(page)).toHaveValue("");
    await expect(rows(page)).toHaveCount(1);
    await expect(row(page, "DEMO-2")).toBeVisible();
    await release(page);
    await expect.poll(() => page.evaluate(() => (window as unknown as Fixture).n06.released)).toBe("DEMO-1");
    await expect(dialog(page).getByRole("combobox", { name: "Zielstatus" })).toHaveCount(0);
    await check(page).press("Enter");
    await choose(page);
    await expect(row(page, "DEMO-2")).toContainText("Erledigungsgrund");
    await expect(dialog(page).getByText("Veraltete Antwort")).toHaveCount(0);
    expect((await ledger(page)).writes).toEqual([]);
  });
}

test("Fixture sendet pro bestätigtem Vorgang genau einen gemeinsamen POST und stoppt bei unklarem Ergebnis", async ({ page }, info) => {
  test.skip(process.env.N06_TRANSITION_QA !== "1", "N06 benötigt die getrennte synthetische Schreibfreigabe.");
  await configureApply(page);
  await enter(page, ["DEMO-1", "DEMO-2", "DEMO-3", "DEMO-4", "DEMO-5", "DEMO-6"]);
  await page.evaluate(() => { (window as unknown as Fixture).n06.mode = "apply"; });
  await check(page).press("Enter");
  await choose(page);
  await expect(approve(page)).toBeDisabled();
  await expect(submit(page)).toBeDisabled();

  const firstLine = "Überprüft und für den Abschluss freigegeben.";
  const secondLine = "Gemeinsamer Beleg aus dem Test.";
  await editor(page).fill(firstLine);
  await approve(page).press("Space");
  await expect(submit(page)).toBeEnabled();
  await editor(page).fill(`${firstLine}\n${secondLine}`);
  await expect(submit(page)).toBeDisabled();
  await approve(page).press("Space");
  expect((await ledger(page)).writes).toEqual([]);
  await page.evaluate(() => { (window as unknown as Fixture).n06.stale = true; });

  await submit(page).press("Enter");
  for (const [index, outcome] of [
    "Geändert · Von Jira bestätigt", "Abgewiesen", "Status oder Übergang hat sich geändert", "Ergebnis unklar",
    "Nach unklarer Antwort gestoppt", "Pflichtangaben im Einzelvorgang prüfen",
  ].entries()) await expect(row(page, `DEMO-${index + 1}`)).toContainText(outcome);
  await expect(submit(page)).toHaveCount(0);
  const body = { type: "doc", version: 1, content: [firstLine, secondLine].map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })) };
  expect((await ledger(page)).writes).toEqual([
    { path: "/issue/DEMO-1/transitions", method: "POST", input: { transition: { id: "31" }, update: { comment: [{ add: { body } }] } } },
    { path: "/issue/DEMO-2/transitions", method: "POST", input: { transition: { id: "312" }, update: { comment: [{ add: { body } }] } }, failed: 403 },
    { path: "/issue/DEMO-4/transitions", method: "POST", input: { transition: { id: "314" }, update: { comment: [{ add: { body } }] } }, failed: 503 },
  ]);
  const success = await page.evaluate(() => (window as unknown as Fixture).__qa.issues[0]!.fields);
  expect(success.status.id).toBe("4");
  expect(success.comment.comments.at(-1)?.body).toEqual(body);
  await dialog(page).getByRole("list", { name: /^Ausgewählt:/ }).focus();
  await dialog(page).screenshot({ path: info.outputPath("abschlussergebnisse.png"), animations: "disabled" });
});

test("Fixture stoppt bei Kontowechsel während frischer Prüfung der bereits bestätigten Auswahl", async ({ page }) => {
  test.skip(process.env.N06_TRANSITION_QA !== "1", "N06 benötigt die getrennte synthetische Schreibfreigabe.");
  await configureApply(page);
  await page.clock.setFixedTime(fixedTime);
  await enter(page, ["DEMO-1", "DEMO-2"]);
  await page.evaluate(() => { (window as unknown as Fixture).n06.mode = "apply"; });
  await check(page).press("Enter");
  await choose(page);
  await editor(page).fill("Eindeutig bestätigter alter Kontext.");
  await approve(page).press("Space");
  await page.evaluate(() => { (window as unknown as Fixture).n06.hold = "DEMO-1"; });
  const prior = await ledger(page);
  await submit(page).press("Enter");
  await expect.poll(() => page.evaluate(() => (window as unknown as Fixture).n06.reached)).toBe("DEMO-1");
  expect((await ledger(page)).writes).toEqual([]);
  await switchAccount(page);
  await release(page);
  await expect.poll(() => page.evaluate(() => (window as unknown as Fixture).n06.released)).toBe("DEMO-1");
  await select(page, "DEMO-1");
  await open(page);
  await expect(editor(page)).toHaveValue("");
  await expect(submit(page)).toHaveCount(0);
  const data = await ledger(page);
  expect(data.reads.slice(prior.reads.length).filter(({ key, kind }) => key === "DEMO-2" && kind === "transitions")).toEqual([]);
  expect(data.writes).toEqual([]);
});


test("Fixture sendet bei abweichender frischer Jira-Identität auch an spätere Vorgänge nichts", async ({ page }) => {
  test.skip(process.env.N06_TRANSITION_QA !== "1", "N06 benötigt die getrennte synthetische Schreibfreigabe.");
  await configureApply(page);
  await enter(page, ["DEMO-1", "DEMO-2"]);
  await page.evaluate(() => { (window as unknown as Fixture).n06.mode = "apply"; });
  await check(page).press("Enter");
  await choose(page);
  await editor(page).fill("Entwurf aus dem ursprünglichen Konto.");
  await approve(page).press("Space");
  await page.evaluate(() => { (window as unknown as Fixture).n06.responseAccount = "qa-unexpected-identity"; });
  const prior = await ledger(page);
  await submit(page).press("Enter");
  await expect(row(page, "DEMO-1")).toContainText("Jira-Konto oder Kontext konnte nicht erneut bestätigt werden.");
  await expect(row(page, "DEMO-2")).toContainText("Freigabe oder Auswahlkontext fehlt.");
  const after = await ledger(page);
  expect(after.writes).toEqual([]);
  expect(after.reads.slice(prior.reads.length).filter(({ kind }) => kind === "account"))
    .toEqual([{ key: "", kind: "account", account: "qa-unexpected-identity" }]);
  expect(after.reads.slice(prior.reads.length).filter(({ key }) => key === "DEMO-2")).toEqual([]);
});
