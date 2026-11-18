import { expect, test, type Page } from "@playwright/test";

const action = (page: Page) =>
  page.getByRole("button", { name: "Freigaben prüfen", exact: true });
const section = (page: Page) =>
  page
    .locator("section")
    .filter({
      has: page.getByRole("heading", { name: "Freigaben", exact: true }),
    });
const list = (page: Page) =>
  section(page).getByRole("list", { name: "Gemeldete Freigabestufen" });
const route = (scenario = "approvals") =>
  `/tests/browser/fixture.html?scenario=${scenario}&route=/issue/DEMO-1`;
const approvalPath = (key: string) =>
  `/ex/jira/qa-cloud/rest/servicedeskapi/request/${key}/approval`;
const fakeName = "Nur aus dem benannten Jira-Feld";

type Case = "success" | "empty" | "missing" | "denied" | "not-found";
type Read = { method: "GET"; path: string; search: string; account: string };
type State = {
  mode: Case;
  reads: Read[];
  accounts: string[];
  hold?: boolean;
  release?: () => void;
  released?: boolean;
};
type Fixture = {
  __qa: {
    accountId?: string;
    writes: unknown[];
    issues: Array<{ key: string; fields: object; names: object }>;
  };
  __n11: State;
  __qaIssueLinksRule: (key: string) => { issuelinks: unknown[] };
  __qaReadRule: (
    path: string,
    params: URLSearchParams,
    fullPath: string,
  ) => Promise<unknown>;
};

async function seed(page: Page) {
  await page.addInitScript((unverified) => {
    const app = window as unknown as Fixture;
    const state: State = { mode: "success", reads: [], accounts: [] };
    app.__n11 = state;
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
    app.__qaReadRule = async (path, params, fullPath) => {
      const account = app.__qa.accountId ?? "qa-user";
      if (path === "/myself") state.accounts.push(account);
      const issueKey = /^\/issue\/(DEMO-[12])$/.exec(path)?.[1];
      if (issueKey && params.get("fields") === "*all") {
        const issue = app.__qa.issues.find(({ key }) => key === issueKey);
        if (issue)
          return {
            body: {
              ...issue,
              names: { ...issue.names, customfield_9001: "Approvals" },
              fields: {
                ...issue.fields,
                customfield_9001: [
                  { name: unverified, finalDecision: "approved" },
                ],
              },
            },
          };
      }
      const key = /^\/request\/(DEMO-[12])\/approval$/.exec(path)?.[1];
      if (!key) return;
      state.reads.push({
        method: "GET",
        path: fullPath,
        search: params.toString(),
        account,
      });
      if (state.mode === "denied")
        return {
          status: 403,
          body: { errorMessages: ["Interne Zugriffsdetails"] },
        };
      if (state.mode === "not-found") return { status: 404, body: {} };
      if (state.mode === "missing")
        return { body: { start: 0, isLastPage: true } };
      if (state.mode === "empty")
        return { body: { start: 0, isLastPage: true, values: [] } };
      const name =
        key === "DEMO-2"
          ? "Nur zweites Ticket"
          : account === "qa-n11-other"
            ? "Freigabe Konto B"
            : "Sicherheitsprüfung";
      const person =
        key === "DEMO-2"
          ? "Person Ticket B"
          : account === "qa-n11-other"
            ? "Person Konto B"
            : "Ada Freigegeben";
      const delayed = state.hold;
      if (delayed) {
        state.hold = false;
        await new Promise<void>((resolve) => {
          state.release = resolve;
        });
        state.released = true;
      }
      const values = [
        {
          id: "1",
          name,
          finalDecision: "approved",
          canAnswerApproval: true,
          approvers: [
            {
              approver: {
                displayName: delayed ? "Verspäteter Name A" : person,
                emailAddress: "hidden@example.test",
              },
            },
            {
              approver: {
                accountId: "private-approver",
                name: "Verborgener Name",
              },
            },
            { approver: null },
          ],
        },
        { id: "2", name: "Betriebsfreigabe", finalDecision: "declined" },
      ];
      return {
        body: {
          start: 0,
          isLastPage: false,
          values,
          _links: { next: "https://external.invalid/forbidden-next" },
        },
      };
    };
  }, fakeName);
}

const ledger = (page: Page) =>
  page.evaluate(() => {
    const app = window as unknown as Fixture;
    return {
      reads: app.__n11.reads,
      accounts: app.__n11.accounts,
      writes: app.__qa.writes,
    };
  });
const mode = (page: Page, next: Case) =>
  page.evaluate((value) => {
    (window as unknown as Fixture).__n11.mode = value;
  }, next);
const expected = (key = "DEMO-1", account = "qa-user") => ({
  method: "GET",
  path: approvalPath(key),
  search: "start=0&limit=8",
  account,
});

async function hold(page: Page) {
  await page.evaluate(() => {
    (window as unknown as Fixture).__n11.hold = true;
  });
  await action(page).click();
  await expect(
    section(page).getByRole("status", { name: "Freigaben werden geprüft" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => typeof (window as unknown as Fixture).__n11.release),
    )
    .toBe("function");
}

async function release(page: Page) {
  await page.evaluate(() => (window as unknown as Fixture).__n11.release?.());
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as Fixture).__n11.released),
    )
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  await seed(page);
});
test.afterEach(async ({ page }, info) => {
  if (info.status === "skipped") return;
  const report = await ledger(page);
  await info.attach("n11-ledger", {
    contentType: "application/json",
    body: JSON.stringify(report),
  });
  expect(report.writes).toEqual([]);
});

test("N11 liest am regulären Ticket nur belegte Stufen und sichtbare Namen mit schmaler Tastaturansicht", async ({
  page,
}, info) => {
  test.skip(
    process.env.N11_BUILD === "production",
    "synthetische QA-Lesefreigabe",
  );
  if (info.project.name === "narrow-dark-reduced")
    await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(route());
  await expect(action(page)).toBeVisible();
  expect((await ledger(page)).reads).toEqual([]);
  await action(page).focus();
  await expect(action(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(list(page).getByRole("listitem")).toHaveCount(2);
  await expect(list(page)).toContainText("Sicherheitsprüfung");
  await expect(list(page)).toContainText("Status approved");
  await expect(list(page)).toContainText("Betriebsfreigabe");
  await expect(list(page)).toContainText("Status declined");
  await expect(list(page)).toContainText("Entscheider Ada Freigegeben");
  await expect(section(page)).not.toContainText(
    /Verborgener Name|hidden@example|private-approver|Nur aus dem benannten Jira-Feld/,
  );
  await expect(section(page).getByRole("button")).toHaveCount(1);
  await expect(section(page).getByRole("status")).toContainText(
    "Nur die erste Seite",
  );
  expect((await ledger(page)).reads).toEqual([expected()]);
  expect(
    await section(page).evaluate(
      (node) => node.scrollWidth <= node.clientWidth + 1,
    ),
  ).toBe(true);
  await info.attach("n11-approvals", {
    contentType: "image/png",
    body: await page.screenshot(),
  });
});

for (const [scenario, message] of [
  ["empty", "JSM meldet keine Freigabestufen für diese Anfrage."],
  ["missing", "Die Freigabedaten konnten nicht bestätigt werden."],
  ["denied", "Kein Lesezugriff auf die Freigaben dieser Anfrage."],
  [
    "not-found",
    "Für dieses Ticket konnte keine zugängliche JSM-Anfrage bestätigt werden.",
  ],
] as const) {
  test(`N11 bildet ungleiche Leersichten und Fehler ab (${scenario})`, async ({
    page,
  }) => {
    test.skip(
      process.env.N11_BUILD === "production",
      "synthetische QA-Lesefreigabe",
    );
    await page.goto(route());
    await mode(page, scenario);
    await action(page).click();
    await expect(
      section(page).getByRole(scenario === "empty" ? "status" : "alert"),
    ).toHaveText(message);
    await expect(list(page)).toHaveCount(0);
    await expect(section(page)).not.toContainText(
      /Nur aus dem benannten Jira-Feld|Interne Zugriffsdetails/,
    );
    expect((await ledger(page)).reads).toEqual([expected()]);
  });
}

test("N11 verwirft die gehaltene Freigabe nach Navigation zum zweiten Ticket", async ({
  page,
}) => {
  test.skip(
    process.env.N11_BUILD === "production",
    "synthetische QA-Lesefreigabe",
  );
  await page.goto(route());
  await hold(page);
  await page.locator('a[data-row-link][href="/issue/DEMO-2"]').click();
  await expect(page).toHaveURL(/\/issue\/DEMO-2$/);
  await release(page);
  await expect(action(page)).toBeVisible();
  await expect(page.getByText("Verspäteter Name A")).toHaveCount(0);
  expect((await ledger(page)).reads).toEqual([expected()]);
  await action(page).click();
  await expect(list(page)).toContainText("Person Ticket B");
  await expect(list(page)).not.toContainText(
    /Verspäteter Name A|Ada Freigegeben/,
  );
  expect((await ledger(page)).reads).toEqual([expected(), expected("DEMO-2")]);
});

test("N11 verwirft sichtbare und verspätete Entscheidernamen beim Kontowechsel", async ({
  page,
}) => {
  test.skip(
    process.env.N11_BUILD === "production",
    "synthetische QA-Lesefreigabe",
  );
  await page.goto(route());
  await action(page).click();
  await expect(list(page)).toContainText("Ada Freigegeben");
  await hold(page);
  const time = await page.evaluate(() => {
    (window as unknown as Fixture).__qa.accountId = "qa-n11-other";
    return Date.now();
  });
  await page.clock.setFixedTime(new Date(time + 120_000));
  await page.evaluate(() =>
    window.dispatchEvent(new Event("visibilitychange")),
  );
  await expect
    .poll(async () => (await ledger(page)).accounts.includes("qa-n11-other"))
    .toBe(true);
  await release(page);
  await expect(action(page)).toBeVisible();
  await expect(list(page)).toHaveCount(0);
  await expect(
    page.getByText(/Verspäteter Name A|Ada Freigegeben/),
  ).toHaveCount(0);
  expect((await ledger(page)).reads).toEqual([expected(), expected()]);
  await action(page).click();
  await expect(list(page)).toContainText("Person Konto B");
  await expect(list(page)).not.toContainText(
    /Verspäteter Name A|Ada Freigegeben/,
  );
  expect((await ledger(page)).reads).toEqual([
    expected(),
    expected(),
    expected("DEMO-1", "qa-n11-other"),
  ]);
});

test("N11 bleibt im Produktionsbuild selbst beim synthetischen Marker inaktiv", async ({
  page,
}) => {
  test.skip(
    process.env.N11_BUILD !== "production",
    "Kontrolle am regulären Build",
  );
  await page.goto(route());
  await expect(
    page.getByRole("heading", { name: "Beschreibung", exact: true }),
  ).toBeVisible();
  await expect(action(page)).toHaveCount(0);
  await expect(section(page)).toHaveCount(0);
  expect((await ledger(page)).reads).toEqual([]);
});
