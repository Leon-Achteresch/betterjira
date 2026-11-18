import { expect, test, type Page } from "@playwright/test";

const fields = "summary,status,issuetype,priority,issuelinks";
const trigger = (page: Page, key = "DEMO-2") =>
  page.getByRole("button", {
    name: `Duplikatlink zu ${key} vergleichen`,
    exact: true,
  });
const dialog = (page: Page) =>
  page.getByRole("dialog", { name: "Duplikat vergleichen", exact: true });
const route = (key: string) =>
  `/tests/browser/fixture.html?route=/issue/${key}`;
const links = (page: Page) =>
  page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: /^Verknüpfungen/ }) });

type Read = {
  method: "GET";
  path: string;
  fields: string | null;
  account: string;
};
type TestState = {
  reads: Read[];
  status?: number;
  masked?: boolean;
  missingSide?: string;
  nextHold?: boolean;
  release?: () => void;
  completed?: boolean;
};
type BrowserFixture = {
  __qa: { accountId?: string; writes: unknown[]; reads: string[] };
  __n10: TestState;
  __qaIssueLinksRule: (key: string) => { issuelinks: unknown[] };
  __qaReadRule: (path: string, params: URLSearchParams) => Promise<unknown>;
};

async function seed(page: Page) {
  await page.addInitScript((requestedFields) => {
    const app = window as unknown as BrowserFixture;
    const state: TestState = { reads: [] };
    app.__n10 = state;
    const type = {
      id: "10004",
      name: "Duplicate",
      inward: "is duplicated by",
      outward: "duplicates",
    };
    const stale = { summary: "Alte Vorschau aus der Linkliste" };
    const sourceLinks = (key: string) =>
      key === "DEMO-1"
        ? [
            {
              id: "n10-42",
              type,
              outwardIssue: { key: "DEMO-2", fields: stale },
            },
            {
              id: "other",
              type: { ...type, name: "Blocks", inward: "is blocked by" },
              outwardIssue: { key: "DEMO-3" },
            },
            {
              id: "unproven",
              type: { ...type, id: "81", inward: "unbekannt" },
              outwardIssue: { key: "OPS-7" },
            },
          ]
        : key === "DEMO-2"
          ? [
              {
                id: "n10-42",
                type,
                inwardIssue: { key: "DEMO-1", fields: stale },
              },
            ]
          : [];
    app.__qaIssueLinksRule = (key) => ({ issuelinks: sourceLinks(key) });
    app.__qaReadRule = async (path, params) => {
      const account = app.__qa.accountId ?? "qa-user";
      const selection = params.get("fields");
      if (path === "/myself")
        state.reads.push({ method: "GET", path, fields: selection, account });
      const key = /^\/issue\/(DEMO-[12])$/.exec(path)?.[1];
      if (!key || selection !== requestedFields) return;
      state.reads.push({ method: "GET", path, fields: selection, account });
      if (key === "DEMO-2" && state.status)
        return {
          status: state.status,
          body: { errorMessages: ["Vertraulicher Fehlertext"] },
        };
      const summary =
        key === "DEMO-1"
          ? "Duplikat frisch geladen"
          : `Ursprung frisch geladen für ${account}`;
      const ticket = {
        key,
        fields: {
          summary,
          status: { name: "In Arbeit" },
          issuetype: { name: "Aufgabe" },
          priority: { name: "Hoch" },
          ...(key === "DEMO-2" &&
            state.masked && {
              summary: null,
              status: { redacted: true },
              priority: { name: " " },
            }),
          description: "Geheime Beschreibung",
          assignee: { displayName: "Person anonymisiert" },
          issuelinks: state.missingSide === key ? [] : sourceLinks(key),
        },
      };
      if (key === "DEMO-2" && state.nextHold) {
        state.nextHold = false;
        await new Promise<void>((resolve) => {
          state.release = resolve;
        });
        state.completed = true;
        ticket.fields.summary = "Verspäteter alter Vergleich";
      }
      return { body: ticket };
    };
  }, fields);
}

const report = (page: Page) =>
  page.evaluate(() => {
    const app = window as unknown as BrowserFixture;
    return {
      reads: app.__n10.reads,
      writes: app.__qa.writes,
      jiraReads: app.__qa.reads,
    };
  });
const comparisonReads = async (page: Page) =>
  (await report(page)).reads.filter((read) => read.fields === fields);
const setFixture = (page: Page, patch: Partial<TestState>) =>
  page.evaluate((value) => {
    Object.assign((window as unknown as BrowserFixture).__n10, value);
  }, patch);

async function hold(page: Page) {
  await setFixture(page, { nextHold: true });
  await trigger(page).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => typeof (window as unknown as BrowserFixture).__n10.release,
      ),
    )
    .toBe("function");
  await expect(
    dialog(page).getByRole("status", { name: "Beide Tickets werden geprüft" }),
  ).toBeVisible();
}

async function release(page: Page) {
  await page.evaluate(() =>
    (window as unknown as BrowserFixture).__n10.release?.(),
  );
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as BrowserFixture).__n10.completed,
      ),
    )
    .toBe(true);
}

async function switchAccount(page: Page, account: string) {
  const before = (await report(page)).reads.length;
  const browserTime = await page.evaluate((id) => {
    (window as unknown as BrowserFixture).__qa.accountId = id;
    return Date.now();
  }, account);
  await page.clock.setFixedTime(new Date(browserTime + 120_000));
  await page.evaluate(() =>
    window.dispatchEvent(new Event("visibilitychange")),
  );
  await expect
    .poll(async () =>
      (await report(page)).reads
        .slice(before)
        .some((row) => row.path === "/myself" && row.account === account),
    )
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  await seed(page);
});

test.afterEach(async ({ page }, info) => {
  const ledger = await report(page);
  await info.attach("n10-ledger", {
    contentType: "application/json",
    body: JSON.stringify(ledger),
  });
  expect(ledger.writes).toEqual([]);
});

test("N10 öffnet nur den gewählten Duplikatlink mit gleicher Rollenfolge aus beiden Richtungen", async ({
  page,
}, info) => {
  if (info.project.name === "narrow-dark-reduced")
    await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(route("DEMO-1"));
  await expect(trigger(page)).toBeVisible();
  await expect(trigger(page, "DEMO-3")).toHaveCount(0);
  await expect(trigger(page, "OPS-7")).toHaveCount(0);
  await trigger(page).focus();
  expect(await comparisonReads(page)).toEqual([]);
  const before = (await report(page)).reads.length;
  await page.keyboard.press("Enter");
  await expect(dialog(page).getByRole("heading")).toBeFocused();
  await expect(
    dialog(page).getByRole("columnheader", { name: "Duplikat DEMO-1" }),
  ).toBeVisible();
  await expect(
    dialog(page).getByRole("columnheader", {
      name: "Ursprung laut Link DEMO-2",
    }),
  ).toBeVisible();
  await expect(dialog(page)).toContainText(
    "Ursprung frisch geladen für qa-user",
  );
  await expect(dialog(page)).not.toContainText(
    /Alte Vorschau|Geheime Beschreibung|Person anonymisiert/,
  );
  expect(
    (await report(page)).reads.slice(before).map(({ path }) => path),
  ).toEqual(["/myself", "/issue/DEMO-1", "/issue/DEMO-2", "/myself"]);
  expect(
    await dialog(page).evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return (
        rect.left >= 0 &&
        rect.right <= innerWidth &&
        node.scrollWidth <= node.clientWidth
      );
    }),
  ).toBe(true);
  await dialog(page).screenshot({
    path: info.outputPath("duplicate-comparison.png"),
  });
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  await expect(trigger(page)).toBeFocused();
  await links(page)
    .getByRole("link", { name: /DEMO-2/ })
    .click();
  await expect(page).toHaveURL(/\/issue\/DEMO-2$/);
  await trigger(page, "DEMO-1").press("Enter");
  await expect(
    dialog(page).getByRole("columnheader", { name: "Duplikat DEMO-1" }),
  ).toBeVisible();
  await expect(
    dialog(page).getByRole("columnheader", {
      name: "Ursprung laut Link DEMO-2",
    }),
  ).toBeVisible();
  expect((await comparisonReads(page)).map(({ path }) => path)).toEqual([
    "/issue/DEMO-1",
    "/issue/DEMO-2",
    "/issue/DEMO-2",
    "/issue/DEMO-1",
  ]);
});

test("N10 zeigt Zugriffsausfall und Fehler, fehlende Felder bleiben beim erneuten Lesen sichtbar", async ({
  page,
}) => {
  await page.goto(route("DEMO-1"));
  await setFixture(page, { status: 403, masked: true });
  await trigger(page).click();
  await expect(dialog(page).getByRole("alert")).toContainText(
    "für dieses Konto nicht lesbar",
  );
  await expect(dialog(page).getByRole("table")).toHaveCount(0);
  await expect(dialog(page)).not.toContainText("Vertraulicher Fehlertext");
  await setFixture(page, { status: 503 });
  await dialog(page).getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(dialog(page).getByRole("alert")).toContainText(
    "Vergleich konnte nicht geladen werden",
  );
  await setFixture(page, { status: undefined });
  await dialog(page).getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(
    dialog(page).getByText("Nicht verfügbar", { exact: true }),
  ).toHaveCount(3);
  await expect(dialog(page).getByText("Duplikat frisch geladen")).toBeVisible();
  await expect(dialog(page)).not.toContainText(
    /Alte Vorschau|Person anonymisiert|Geheime Beschreibung/,
  );
  expect(await comparisonReads(page)).toHaveLength(6);
});

test("N10 sperrt einen veralteten Link auf beiden Seiten", async ({ page }) => {
  await page.goto(route("DEMO-1"));
  await setFixture(page, { missingSide: "DEMO-1" });
  await trigger(page).click();
  await expect(dialog(page).getByRole("alert")).toContainText(
    "Duplikatlink konnte auf beiden Tickets nicht bestätigt werden",
  );
  expect((await comparisonReads(page)).map(({ path }) => path)).toEqual([
    "/issue/DEMO-1",
  ]);
  await setFixture(page, { missingSide: "DEMO-2" });
  await dialog(page).getByRole("button", { name: "Erneut versuchen" }).click();
  await expect.poll(() => comparisonReads(page)).toHaveLength(3);
  await expect(dialog(page).getByRole("alert")).toBeVisible();
  await expect(dialog(page).getByRole("table")).toHaveCount(0);
});

test("N10 verwirft die gehaltene Zielantwort beim Abbruch", async ({
  page,
}) => {
  await page.goto(route("DEMO-1"));
  await hold(page);
  await dialog(page).getByRole("button", { name: "Abbrechen" }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(trigger(page)).toBeFocused();
  await release(page);
  await expect(dialog(page)).toHaveCount(0);
  await trigger(page).click();
  await expect(dialog(page)).toContainText("Ursprung frisch geladen");
  await expect(dialog(page)).not.toContainText("Verspäteter alter Vergleich");
});

test("N10 verwirft die gehaltene Zielantwort beim Ticketwechsel", async ({
  page,
}) => {
  await page.goto(route("DEMO-2"));
  await links(page)
    .getByRole("link", { name: /DEMO-1/ })
    .click();
  await expect(page).toHaveURL(/\/issue\/DEMO-1$/);
  await hold(page);
  await page.goBack();
  await expect(page).toHaveURL(/\/issue\/DEMO-2$/);
  await expect(dialog(page)).toHaveCount(0);
  await release(page);
  await expect(dialog(page)).toHaveCount(0);
  await expect(trigger(page, "DEMO-1")).toBeVisible();
  expect(await comparisonReads(page)).toHaveLength(2);
});

test("N10 bindet den Vergleich an das Konto und verwirft eine alte Antwort", async ({
  page,
}) => {
  await page.goto(route("DEMO-1"));
  await hold(page);
  await switchAccount(page, "qa-n10-other");
  await expect(dialog(page)).toHaveCount(0);
  await release(page);
  await expect(dialog(page)).toHaveCount(0);
  await trigger(page).click();
  await expect(dialog(page)).toContainText(
    "Ursprung frisch geladen für qa-n10-other",
  );
  await expect(dialog(page)).not.toContainText("Verspäteter alter Vergleich");
  expect((await comparisonReads(page)).map(({ account }) => account)).toEqual([
    "qa-user",
    "qa-user",
    "qa-n10-other",
    "qa-n10-other",
  ]);
  await switchAccount(page, "qa-user");
  await expect(dialog(page)).toHaveCount(0);
  await expect(
    page.getByText("Ursprung frisch geladen für qa-n10-other", { exact: true }),
  ).toHaveCount(0);
  expect(await comparisonReads(page)).toHaveLength(4);
});
