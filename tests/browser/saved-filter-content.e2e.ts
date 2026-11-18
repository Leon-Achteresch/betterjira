import { expect, test, type Page } from "@playwright/test";

type Read = { path: string; params: string; account: string; cloud: string };
type State = {
  reads: Read[];
  status?: number;
  hold?: boolean;
  release?: () => void;
  delivered?: boolean;
};
type Fixture = {
  __qa: { accountId?: string; writes: unknown[]; searches: string[] };
  __n19: State;
  __qaReadRule: (path: string, params: URLSearchParams) => Promise<unknown>;
};

const openPage = (page: Page, cloud = "qa-cloud", account = "qa-user") =>
  page.goto(
    `/tests/browser/fixture.html?${new URLSearchParams({ scenario: "filters", route: "/filter", cloud, account })}`,
  );
const trigger = (page: Page) =>
  page.getByRole("button", { name: "JQL-Inhalte prüfen" });
const dialog = (page: Page) =>
  page.getByRole("dialog", { name: "JQL-Inhalte prüfen" });
const input = (page: Page) =>
  dialog(page).getByRole("searchbox", {
    name: "Text in gespeicherten Abfragen",
  });
const result = (page: Page, name: string) =>
  dialog(page).getByRole("link", { name, exact: true });
const list = (page: Page) =>
  page.getByRole("list", { name: "Filter", exact: true });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const app = window as unknown as Fixture;
    const cloud =
      new URLSearchParams(location.search).get("cloud") ?? "qa-cloud";
    const initialAccount =
      new URLSearchParams(location.search).get("account") ?? "qa-user";
    const state: State = { reads: [] };
    app.__n19 = state;
    const row = (
      id: string,
      name: string,
      jql: unknown,
      owner = "qa-user",
      favourite = false,
    ) => ({
      id,
      name,
      jql,
      favourite,
      owner: { accountId: owner, displayName: owner },
    });
    const rows = [
      row("301", "A Eigener Favorit", null),
      row(
        "301",
        "A Eigener Favorit",
        'component = "Versand[1]"',
        "qa-user",
        true,
      ),
      row(
        "302",
        "ZZ Lange Abfrage",
        `summary ~ "${"unbeteiligt ".repeat(800)}" AND component = "Versand[1]"`,
      ),
      row(
        "303",
        "Fremder Favorit",
        'component = "Versand[1]"',
        "qa-peer",
        true,
      ),
      row("304", "Abfrage fehlt", undefined),
      row("305", "Versand[1] nur im Namen", "project = DEMO"),
      row("306", "Unklares JQL", { redacted: true }),
      ...Array.from({ length: 8 }, (_, index) =>
        row(
          String(310 + index),
          `Team ${index + 1}`,
          'component = "Versand[1]"',
        ),
      ),
    ];
    const forScope = (account: string) =>
      cloud !== "qa-cloud"
        ? [
            row(
              "301",
              "Eigenes Ticket auf anderer Site",
              "project = NEU",
              account,
            ),
          ]
        : account !== "qa-user"
          ? [
              row(
                "301",
                "Filter des zweiten Kontos",
                "project = SECOND",
                account,
              ),
            ]
          : rows;
    app.__qaReadRule = async (path, params) => {
      const account = app.__qa.accountId ?? initialAccount;
      if (
        path === "/myself" ||
        path.startsWith("/filter") ||
        path.startsWith("/search") ||
        path.startsWith("/jql")
      )
        state.reads.push({ path, params: params.toString(), account, cloud });
      if (path === "/filter/my") {
        if (state.status)
          return {
            status: state.status,
            body: { errorMessages: ["Kein Filterzugriff"] },
          };
        const filters = forScope(account);
        if (state.hold) {
          state.hold = false;
          await new Promise<void>((resolve) => {
            state.release = resolve;
          });
          state.delivered = true;
          return {
            body: [
              ...filters,
              row("399", "Verspätete alte Liste", 'component = "Versand[1]"'),
            ],
          };
        }
        return { body: filters };
      }
      const id = /^\/filter\/(\d+)$/.exec(path)?.[1];
      if (id) {
        const filter = forScope(account).find(
          (entry) => entry.id === id && typeof entry.jql === "string",
        );
        return filter ? { body: filter } : { status: 404, body: {} };
      }
    };
  });
});

const ledger = (page: Page) =>
  page.evaluate(() => {
    const app = window as unknown as Fixture;
    return {
      reads: app.__n19.reads,
      writes: app.__qa.writes,
      searches: app.__qa.searches,
    };
  });

const backgroundQuery = (jql: string | null) =>
  jql ===
    "assignee = currentUser() AND (statusCategory != Done OR resolved >= -7d) ORDER BY updated DESC" ||
  (typeof jql === "string" &&
    /^\(assignee = currentUser\(\) OR reporter = currentUser\(\) OR watcher = currentUser\(\)\) AND updated >= -\d+m ORDER BY updated DESC$/.test(
      jql,
    ));

const expectReadOnly = (evidence: Awaited<ReturnType<typeof ledger>>) => {
  expect(evidence.writes).toEqual([]);
  expect(evidence.searches.filter((jql) => !backgroundQuery(jql))).toEqual([]);
  expect(
    evidence.reads.filter(
      ({ path, params }) =>
        (path.startsWith("/search") &&
          (path !== "/search/jql" ||
            !backgroundQuery(new URLSearchParams(params).get("jql")))) ||
        path.startsWith("/jql") ||
        path === "/filter/search",
    ),
  ).toEqual([]);
};

test.afterEach(async ({ page }, info) => {
  const evidence = await ledger(page);
  await info.attach("n19-ledger", {
    contentType: "application/json",
    body: JSON.stringify(evidence),
  });
  expectReadOnly(evidence);
});

const search = async (page: Page, text: string) => {
  await input(page).fill(text);
  await input(page).press("Enter");
};

test("N19 durchsucht geladene Inhalte explizit über zwei lokale Seiten und öffnet den Editor ohne Ausführung", async ({
  page,
}, info) => {
  if (info.project.name === "narrow-dark-reduced")
    await page.setViewportSize({ width: 390, height: 844 });
  await openPage(page);
  await expect(
    list(page).getByRole("link", { name: "A Eigener Favorit", exact: true }),
  ).toHaveCount(1);
  await expect(
    list(page).getByText("JQL nicht verfügbar", { exact: true }),
  ).toHaveCount(2);
  await trigger(page).press("Enter");
  await expect(input(page)).toBeFocused();
  await expect(dialog(page)).toContainText(
    "14 geladen · 2 ohne verfügbares JQL",
  );
  await input(page).fill("  VERSAND[1] ");
  await expect(
    dialog(page).getByRole("list", { name: "JQL-Treffer" }),
  ).toHaveCount(0);
  await input(page).press("Enter");
  await expect(dialog(page).getByRole("status")).toContainText(
    "11 Treffer · Seite 1 von 2",
  );
  await expect(dialog(page).getByRole("listitem")).toHaveCount(8);
  await expect(result(page, "A Eigener Favorit")).toHaveCount(1);
  await expect(result(page, "Fremder Favorit")).toBeVisible();
  await expect(result(page, "Versand[1] nur im Namen")).toHaveCount(0);
  const before = (await ledger(page)).reads.filter(({ path }) =>
    path.startsWith("/filter"),
  );
  expect(before).toHaveLength(1);
  expect(before[0].params).toBe("includeFavourites=true&expand=jql");
  await dialog(page)
    .getByRole("button", { name: "Nächste Seite" })
    .press("Enter");
  await expect(dialog(page).getByRole("status")).toContainText("Seite 2 von 2");
  const long = result(page, "ZZ Lange Abfrage");
  await expect(long).toContainText('component = "Versand[1]"');
  expect((await long.innerText()).length).toBeLessThan(160);
  expect(
    (await ledger(page)).reads.filter(({ path }) => path.startsWith("/filter")),
  ).toEqual(before);
  expect(
    await dialog(page).evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth;
    }),
  ).toBe(true);
  await dialog(page).screenshot({
    path: info.outputPath("saved-filter-content.png"),
  });
  await long.press("Enter");
  await expect(page).toHaveURL(/\/filter\/302\?abfrage=true$/);
  await expect(
    page.getByRole("heading", { name: "ZZ Lange Abfrage" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "JQL bearbeiten" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("textbox", { name: "JQL", exact: true }),
  ).toContainText('component = "Versand[1]"');
  await expect(
    page.getByRole("button", { name: "Vorschau", exact: true }),
  ).toBeEnabled();
  expect(
    (await ledger(page)).reads
      .filter(({ path }) => /^\/filter\/\d+$/.test(path))
      .map(({ path }) => path),
  ).toEqual(["/filter/302"]);
});

test("N19 erhält Namenssuche, Leersicht, Fokus und Eigentümerrechte", async ({
  page,
}) => {
  await openPage(page);
  await page
    .getByRole("searchbox", { name: "Filter durchsuchen" })
    .fill("nur im Namen");
  await expect(
    list(page).getByRole("link", {
      name: "Versand[1] nur im Namen",
      exact: true,
    }),
  ).toBeVisible();
  await trigger(page).press("Enter");
  await search(page, "VERSAND1");
  await expect(dialog(page).getByRole("status")).toContainText(
    "Kein Treffer im verfügbaren JQL.",
  );
  await expect(dialog(page)).toContainText("2 ohne verfügbares JQL");
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  await expect(trigger(page)).toBeFocused();
  await trigger(page).press("Enter");
  await search(page, "Versand[1]");
  await result(page, "Fremder Favorit").press("Enter");
  await expect(
    page.getByRole("heading", { name: "Fremder Favorit" }),
  ).toBeVisible();
  await expect(
    page.getByText("Dieser Filter gehört qa-peer.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Speichern", exact: true }),
  ).toHaveCount(0);
});

async function refresh(page: Page, account?: string) {
  const browserTime = await page.evaluate((id) => {
    if (id) (window as unknown as Fixture).__qa.accountId = id;
    return Date.now();
  }, account);
  await page.clock.setFixedTime(new Date(browserTime + 120_000));
  await page.evaluate(() =>
    window.dispatchEvent(new Event("visibilitychange")),
  );
}

test("N19 verwirft alte Suche und gehaltene Filterliste nach Kontowechsel", async ({
  page,
}) => {
  await openPage(page);
  await trigger(page).click();
  await search(page, "Versand[1]");
  await expect(result(page, "A Eigener Favorit")).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as Fixture).__n19.hold = true;
  });
  await refresh(page);
  await expect
    .poll(() =>
      page.evaluate(() => typeof (window as unknown as Fixture).__n19.release),
    )
    .toBe("function");
  await refresh(page, "qa-other");
  await expect(dialog(page)).toHaveCount(0);
  await expect(
    list(page).getByRole("link", {
      name: "Filter des zweiten Kontos",
      exact: true,
    }),
  ).toBeVisible();
  await page.evaluate(() => (window as unknown as Fixture).__n19.release?.());
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as Fixture).__n19.delivered),
    )
    .toBe(true);
  await expect(list(page)).not.toContainText(
    /Verspätete alte Liste|A Eigener Favorit/,
  );
  await trigger(page).click();
  await expect(input(page)).toHaveValue("");
  await search(page, "project = SECOND");
  await expect(result(page, "Filter des zweiten Kontos")).toBeVisible();
});

test("N19 trennt eine neue Verbindung mit derselben Filter-ID", async ({
  page,
}) => {
  await openPage(page);
  await trigger(page).click();
  await search(page, "Versand[1]");
  await expect(result(page, "A Eigener Favorit")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  const profile = page
    .locator('[data-sidebar="footer"]:visible')
    .getByRole("button", { name: /Lokale UI-Testdaten/ });
  if (!(await profile.isVisible()))
    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await profile.click();
  await page.getByRole("menuitem", { name: "Abmelden", exact: true }).click();
  if (
    (await page
      .locator('[data-sidebar="footer"]:visible')
      .getByRole("button", { name: "Mit Atlassian verbinden" })
      .isVisible()) &&
    (page.viewportSize()?.width ?? 0) < 768
  )
    await page.keyboard.press("Escape");
  await expect(
    page.getByRole("main").getByText("Nicht angemeldet", { exact: true }),
  ).toBeVisible();
  await expect(dialog(page)).toHaveCount(0);
  const disconnected = await ledger(page);
  await test.info().attach("n19-previous-connection", {
    contentType: "application/json",
    body: JSON.stringify(disconnected),
  });
  expectReadOnly(disconnected);
  await openPage(page, "qa-new-cloud");
  await trigger(page).click();
  await expect(input(page)).toHaveValue("");
  await search(page, "project = NEU");
  await expect(result(page, "Eigenes Ticket auf anderer Site")).toBeVisible();
  await expect(result(page, "A Eigener Favorit")).toHaveCount(0);
  expect(
    (await ledger(page)).reads
      .filter(({ path }) => path === "/filter/my")
      .map(({ cloud }) => cloud),
  ).toEqual(["qa-new-cloud"]);
});

test("N19 blendet bereits geladene Abfragen nach verweigertem Zugriff aus", async ({
  page,
}) => {
  await openPage(page);
  await trigger(page).click();
  await search(page, "Versand[1]");
  await expect(result(page, "A Eigener Favorit")).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as Fixture).__n19.status = 403;
  });
  await refresh(page);
  const failure = page
    .getByRole("main")
    .getByRole("alert")
    .filter({ hasText: "Filter konnten nicht geladen werden" });
  await expect(failure).toContainText("Kein Filterzugriff");
  await expect(dialog(page)).toHaveCount(0);
  await expect(list(page)).toHaveCount(0);
  await expect(trigger(page)).toHaveCount(0);
  await page.evaluate(() => {
    (window as unknown as Fixture).__n19.status = undefined;
  });
  await failure.getByRole("button", { name: "Erneut versuchen" }).click();
  await trigger(page).click();
  await expect(input(page)).toHaveValue("");
  await expect(
    dialog(page).getByRole("list", { name: "JQL-Treffer" }),
  ).toHaveCount(0);
});
