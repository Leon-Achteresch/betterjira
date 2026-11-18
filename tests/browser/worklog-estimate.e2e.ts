import { expect, test, type Page } from "@playwright/test";

const drawer = (page: Page) =>
  page
    .getByRole("dialog")
    .filter({ has: page.getByRole("tab", { name: "Zeit", exact: true }) });
const option = (page: Page) =>
  drawer(page).getByRole("checkbox", { name: "Restschätzung neu setzen" });
const input = (page: Page) =>
  drawer(page).getByRole("textbox", { name: "Neue Restschätzung" });
const standard = (page: Page) =>
  drawer(page).getByRole("button", { name: "Zeit erfassen", exact: true });
const confirm = (page: Page) =>
  drawer(page).getByRole("button", {
    name: "Zeit und Restschätzung bestätigen",
  });
const fixture =
  "/tests/browser/fixture.html?scenario=worklog-estimate&route=/issue/DEMO-1";
const date = new Date("2026-11-18T12:00:00+01:00");
const body = {
  timeSpent: "30m",
  started: "2026-11-17T10:15:00.000+0100",
  comment: "Synthetische Buchung",
};
type Write = {
  method: string;
  path: string;
  fullPath: string;
  params: Record<string, string>;
  input: unknown;
  status: number;
  account: string;
};
type State = {
  reads: string[];
  holdIdentity?: boolean;
  release?: () => void;
  released?: boolean;
  fault?: { status: number; commit?: boolean };
};
type Fixture = {
  __qa: {
    accountId?: string;
    writes: Write[];
    issues: Array<{
      key: string;
      fields: {
        worklog: { total: number };
        timetracking?: { remainingEstimate?: string };
      };
    }>;
  };
  __n15: State;
  __qaReadRule: (path: string) => Promise<unknown>;
  __qaIssueLinksRule: (key: string) => { issuelinks: unknown[] };
  __qaWorklogBookingRule: () => State["fault"];
};

const expectWrite = (
  target: string,
  params: Write["params"],
  status = 201,
  account = "qa-user",
): Write => ({
  method: "POST",
  path: `/issue/${target}/worklog`,
  fullPath: `/ex/jira/qa-cloud/rest/api/2/issue/${target}/worklog`,
  params,
  input: body,
  status,
  account,
});
const estimate = (newEstimate: string) => ({
  adjustEstimate: "new",
  newEstimate,
});

const ledger = (page: Page) =>
  page.evaluate(() => {
    const app = window as unknown as Fixture;
    return {
      writes: app.__qa.writes,
      accountReads: app.__n15.reads,
      issues: app.__qa.issues.map(({ key, fields }) => ({
        key,
        count: fields.worklog.total,
        remaining: fields.timetracking?.remainingEstimate,
      })),
    };
  });
const set = (page: Page, patch: Partial<State>) =>
  page.evaluate((value) => {
    Object.assign((window as unknown as Fixture).__n15, value);
  }, patch);

async function open(page: Page) {
  await page.getByRole("button", { name: "Details öffnen", exact: true }).click();
  await drawer(page).getByRole("tab", { name: "Zeit", exact: true }).click();
  await expect(
    drawer(page).getByRole("tab", { name: "Zeit", selected: true }),
  ).toBeVisible();
}

async function draft(page: Page) {
  await drawer(page).getByRole("button", { name: "30m", exact: true }).click();
  await drawer(page)
    .getByLabel("Beginn", { exact: true })
    .fill("2026-11-17T10:15");
  await drawer(page)
    .getByRole("textbox", { name: "Beschreibung", exact: true })
    .fill(body.comment);
}

async function prepare(page: Page, value: string) {
  await draft(page);
  await option(page).check();
  await input(page).fill(value);
}

async function holdIdentity(page: Page) {
  await set(page, { holdIdentity: true });
  await confirm(page).click();
  await expect
    .poll(() =>
      page.evaluate(() => typeof (window as unknown as Fixture).__n15.release),
    )
    .toBe("function");
  expect((await ledger(page)).writes).toEqual([]);
}

async function releaseIdentity(page: Page) {
  await page.evaluate(() => (window as unknown as Fixture).__n15.release?.());
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as Fixture).__n15.released),
    )
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(date);
  await page.route("**/*", (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort(),
  );
  await page.addInitScript(() => {
    const app = window as unknown as Fixture;
    const state: State = { reads: [] };
    app.__n15 = state;
    const type = {
      id: "10",
      name: "Blocks",
      inward: "is blocked by",
      outward: "blocks",
    };
    app.__qaIssueLinksRule = (key) => ({
      issuelinks:
        key === "DEMO-1"
          ? [{ id: "21", type, outwardIssue: { key: "DEMO-2" } }]
          : [],
    });
    app.__qaWorklogBookingRule = () => state.fault;
    app.__qaReadRule = async (path) => {
      if (path !== "/myself") return;
      const accountId = app.__qa.accountId ?? "qa-user";
      state.reads.push(accountId);
      if (!state.holdIdentity) return;
      state.holdIdentity = false;
      await new Promise<void>((resolve) => {
        state.release = resolve;
      });
      state.released = true;
      return {
        body: {
          accountId,
          displayName: "Synthetischer Kontonachweis",
          avatarUrls: { "48x48": "" },
        },
      };
    };
  });
});
test.afterEach(async ({ page }, info) => {
  if (info.status === "skipped") return;
  const evidence = await ledger(page);
  await info.attach("n15-ledger", {
    contentType: "application/json",
    body: JSON.stringify(evidence),
  });
  expect(
    evidence.writes.every(
      ({ method, path }) => method === "POST" && path.endsWith("/worklog"),
    ),
  ).toBe(true);
});

test("N15 zeigt Wirkung und sendet die positive Restschätzung genau einmal", async ({
  page,
}, info) => {
  test.skip(process.env.N15_BUILD === "production", "synthetischer QA-Dialog");
  if (info.project.name === "narrow-dark-reduced")
    await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(fixture);
  await open(page);
  await expect(option(page)).not.toBeChecked();
  await expect(standard(page)).toBeVisible();
  await prepare(page, "02H 030m");
  await expect(drawer(page).getByRole("status")).toContainText(
    "Restschätzung nach dieser Buchung 2h 30m",
  );
  await input(page).press("Enter");
  expect((await ledger(page)).writes).toEqual([]);
  await info.attach("n15-preview", {
    contentType: "image/png",
    body: await drawer(page).screenshot(),
  });
  expect(
    await drawer(page).evaluate(
      (node) => node.scrollWidth <= node.clientWidth + 1,
    ),
  ).toBe(true);
  await confirm(page).focus();
  await confirm(page).press("Enter");
  await expect
    .poll(async () => (await ledger(page)).writes)
    .toEqual([expectWrite("1", estimate("2h 30m"))]);
  await expect(option(page)).not.toBeChecked();
  await expect(drawer(page).getByRole("row", { name: /Verbleibend/ })).toContainText("2h 30m");
  await expect
    .poll(async () => (await ledger(page)).issues[0])
    .toEqual({ key: "DEMO-1", count: 1, remaining: "2h 30m" });
});

test("N15 unterscheidet leere Eingabe und Null und blockiert doppelte Bestätigung", async ({
  page,
}) => {
  test.skip(process.env.N15_BUILD === "production", "synthetischer QA-Dialog");
  await page.goto(fixture);
  await open(page);
  await prepare(page, "");
  await expect(confirm(page)).toBeDisabled();
  expect((await ledger(page)).writes).toEqual([]);
  await input(page).fill("0");
  await expect(drawer(page).getByRole("status")).toContainText("0m");
  await confirm(page).evaluate((node: HTMLButtonElement) => {
    node.click();
    node.click();
  });
  await expect
    .poll(async () => (await ledger(page)).writes)
    .toEqual([expectWrite("1", estimate("0m"))]);
  await expect(option(page)).not.toBeChecked();
  await expect
    .poll(async () => (await ledger(page)).issues[0])
    .toEqual({ key: "DEMO-1", count: 1, remaining: "0m" });
});

test("N15 sperrt ungültige Werte und bucht nach Rückkehr zum Standard ohne Parameter", async ({
  page,
}) => {
  test.skip(process.env.N15_BUILD === "production", "synthetischer QA-Dialog");
  await page.goto(fixture);
  await open(page);
  await prepare(page, "-1h");
  await expect(input(page)).toHaveAttribute("aria-invalid", "true");
  await expect(confirm(page)).toBeDisabled();
  expect((await ledger(page)).writes).toEqual([]);
  await option(page).uncheck();
  await expect(input(page)).toHaveCount(0);
  await standard(page).click();
  await expect
    .poll(async () => (await ledger(page)).writes)
    .toEqual([expectWrite("DEMO-1", {})]);
  await expect.poll(async () => (await ledger(page)).issues[0].count).toBe(1);
});

test("N15 verlangt nach abgewiesenem POST eine weitere bewusste Bestätigung", async ({
  page,
}) => {
  test.skip(process.env.N15_BUILD === "production", "synthetischer QA-Dialog");
  await page.goto(fixture);
  await open(page);
  await prepare(page, "1h");
  await set(page, { fault: { status: 403 } });
  await confirm(page).click();
  await expect(drawer(page).getByRole("alert")).toContainText(
    "Jira antwortet mit 403",
  );
  expect((await ledger(page)).writes).toEqual([
    expectWrite("1", estimate("1h"), 403),
  ]);
  expect((await ledger(page)).issues[0].count).toBe(0);
  await set(page, { fault: undefined });
  await confirm(page).click();
  await expect
    .poll(async () => (await ledger(page)).writes)
    .toEqual([
      expectWrite("1", estimate("1h"), 403),
      expectWrite("1", estimate("1h")),
    ]);
  await expect.poll(async () => (await ledger(page)).issues[0].count).toBe(1);
});

test("N15 sperrt dieselbe Buchung nach unklarer 503 trotz Speicherung im Stub", async ({
  page,
}) => {
  test.skip(process.env.N15_BUILD === "production", "synthetischer QA-Dialog");
  await page.goto(fixture);
  await open(page);
  await prepare(page, "2h");
  await set(page, { fault: { status: 503, commit: true } });
  await confirm(page).click();
  await expect(drawer(page).getByRole("alert")).toContainText(
    "Jira hat die Buchung nicht bestätigt.",
  );
  await expect(confirm(page)).toBeDisabled();
  await expect(option(page)).toBeDisabled();
  expect((await ledger(page)).writes).toEqual([
    expectWrite("1", estimate("2h"), 503),
  ]);
  expect((await ledger(page)).issues[0].count).toBe(1);
});

test("N15 bricht den alten POST nach Kontowechsel während des frischen Reads ab", async ({
  page,
}) => {
  test.skip(process.env.N15_BUILD === "production", "synthetischer QA-Dialog");
  await page.goto(fixture);
  await open(page);
  await prepare(page, "2h");
  await holdIdentity(page);
  await page.evaluate(() => {
    (window as unknown as Fixture).__qa.accountId = "qa-n15-other";
  });
  await page.clock.setFixedTime(new Date(date.getTime() + 120_000));
  await page.evaluate(() =>
    window.dispatchEvent(new Event("visibilitychange")),
  );
  await expect
    .poll(async () =>
      (await ledger(page)).accountReads.includes("qa-n15-other"),
    )
    .toBe(true);
  await releaseIdentity(page);
  await expect(option(page)).not.toBeChecked();
  await expect(input(page)).toHaveCount(0);
  await expect(standard(page)).toBeVisible();
  expect((await ledger(page)).writes).toEqual([]);
});

test("N15 sendet nach Ticketwechsel während des frischen Reads keine alte Buchung", async ({
  page,
}) => {
  test.skip(process.env.N15_BUILD === "production", "synthetischer QA-Dialog");
  await page.goto(fixture);
  await open(page);
  await prepare(page, "2h");
  await holdIdentity(page);
  await page.keyboard.press("Escape");
  await expect(drawer(page)).toHaveCount(0);
  await page.locator('a[data-row-link][href="/issue/DEMO-2"]').click();
  await expect(page).toHaveURL(/\/issue\/DEMO-2$/);
  await open(page);
  await releaseIdentity(page);
  await expect(option(page)).not.toBeChecked();
  await expect(standard(page)).toBeDisabled();
  expect((await ledger(page)).writes).toEqual([]);
});

test("N15 Produktionsbuild behält den normalen Worklog-POST trotz QA-Markierung", async ({
  page,
}) => {
  test.skip(
    process.env.N15_BUILD !== "production",
    "Kontrolle am regulären Build",
  );
  await page.goto(fixture);
  await open(page);
  await expect(option(page)).toHaveCount(0);
  await draft(page);
  await standard(page).click();
  await expect
    .poll(async () => (await ledger(page)).writes)
    .toEqual([expectWrite("DEMO-1", {})]);
});
