import { expect, test, type Page } from "@playwright/test";

const trigger = (page: Page, repo = "qa/web-app", number = 41) =>
  page.getByRole("button", {
    name: `Reviewgespräche zu ${repo} #${number} prüfen`,
    exact: true,
  });
const dialog = (page: Page) =>
  page.getByRole("dialog", { name: "Reviewgespräche", exact: true });
const list = (page: Page) =>
  dialog(page).getByRole("list", { name: "Gemeldete Reviewgespräche" });
const fixture =
  "/tests/browser/fixture.html?scenario=scm-review-threads&route=/pull-requests";
const endpoint = "https://api.github.com/graphql";
const original = "https://github.com/qa/web-app/pull/41#discussion_r41";
type Request = {
  method: string;
  url: string;
  auth: { kind: string; host?: string; id?: string };
  body: string | null;
};
type Read = {
  variables: { owner: string; name: string; number: number; first: number };
  account: string;
};
type Mode =
  "normal" | "partial" | "empty" | "denied" | "graphql-denied" | "wrong-viewer";
type State = {
  reads: Read[];
  mode: Mode;
  hold?: boolean;
  release?: () => void;
  released?: boolean;
};
type Fixture = {
  __qa: { writes: unknown[]; commands: string[] };
  __qaScm: {
    transcript: Request[];
    opened: string[];
    hosts: { hosts: Record<string, { login: string }[]> };
  };
  __n23: State;
  __qaRefreshScmHosts: () => Promise<unknown>;
  __qaReviewThreadsRule: (
    request: Omit<Request, "body"> & Read & { query: string },
  ) => Promise<unknown>;
};

const ledger = (page: Page) =>
  page.evaluate(() => {
    const app = window as unknown as Fixture;
    return {
      reads: app.__n23.reads,
      scm: app.__qaScm.transcript,
      opened: app.__qaScm.opened,
      commands: app.__qa.commands,
      writes: app.__qa.writes,
    };
  });
const expectedRead = (name = "web-app", number = 41, account = "qa-user") => ({
  variables: { owner: "qa", name, number, first: 8 },
  account,
});
const state = (page: Page, patch: Partial<State>) =>
  page.evaluate((value) => {
    Object.assign((window as unknown as Fixture).__n23, value);
  }, patch);

async function park(page: Page) {
  await state(page, { hold: true });
  await trigger(page).click();
  await expect(
    dialog(page).getByRole("status", {
      name: "Reviewgespräche werden geladen",
    }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => typeof (window as unknown as Fixture).__n23.release),
    )
    .toBe("function");
}

async function release(page: Page) {
  await page.evaluate(() => (window as unknown as Fixture).__n23.release?.());
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as Fixture).__n23.released),
    )
    .toBe(true);
}

const external = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  external.set(page, []);
  await page.route("**/*", (route) => {
    const address = new URL(route.request().url());
    if (address.hostname === "127.0.0.1") return route.continue();
    external.get(page)?.push(address.href);
    return route.abort();
  });
  await page.addInitScript(() => {
    const app = window as unknown as Fixture;
    const model: State = { reads: [], mode: "normal" };
    app.__n23 = model;
    app.__qaReviewThreadsRule = async ({ variables }) => {
      const account = app.__qaScm.hosts.hosts["github.com"]![0]!.login;
      model.reads.push({ variables, account });
      const held = model.hold;
      if (held) {
        model.hold = false;
        await new Promise<void>((resolve) => {
          model.release = resolve;
        });
        model.released = true;
      }
      if (model.mode === "denied")
        return { status: 403, body: { message: "Interner Fixture-Fehler" } };
      const repo = `${variables.owner}/${variables.name}`;
      const url = `https://github.com/${repo}/pull/${variables.number}`;
      const entry = (
        id: string,
        path: string,
        isResolved: boolean,
        isOutdated: boolean,
        link: string,
      ) => ({
        id,
        path,
        isResolved,
        isOutdated,
        comments: { nodes: [{ url: link }] },
      });
      const filename = held
        ? "src/verspaetete-alte-antwort.ts"
        : account === "qa-n23-other"
          ? "src/neue-verbindung.ts"
          : repo === "qa/design-system"
            ? "src/anderes-repo.ts"
            : "src/offen-und-veraltet.ts";
      const first = entry("1", filename, false, true, `${url}#discussion_r41`);
      const nodes =
        model.mode === "empty"
          ? []
          : model.mode === "partial"
            ? [
                first,
                { id: "unknown", path: "src/keine-flags.ts", isOutdated: true },
                null,
              ]
            : [
                first,
                entry(
                  "2",
                  "src/geloest-aktuell.ts",
                  true,
                  false,
                  `${url}#discussion_r42`,
                ),
                entry(
                  "3",
                  "src/fremder-host.ts",
                  false,
                  false,
                  "https://evil.invalid/qa/web-app/pull/41#discussion_r43",
                ),
                entry(
                  "4",
                  "src/fremder-pr.ts",
                  true,
                  true,
                  "https://github.com/qa/web-app/pull/39#discussion_r44",
                ),
              ];
      return {
        body: {
          ...(model.mode === "graphql-denied" && {
            errors: [{ type: "FORBIDDEN", message: "Interner Fixture-Fehler" }],
          }),
          data: {
            viewer: {
              login: model.mode === "wrong-viewer" ? "anderes-konto" : account,
            },
            repository: {
              nameWithOwner: repo,
              pullRequest: {
                number: variables.number,
                url,
                reviewThreads: {
                  nodes,
                  totalCount: model.mode === "partial" ? 11 : nodes.length,
                  pageInfo: { hasNextPage: model.mode === "partial" },
                },
              },
            },
          },
        },
      };
    };
  });
});
test.afterEach(async ({ page }, info) => {
  if (info.status === "skipped") return;
  const data = await ledger(page);
  await info.attach("n23-ledger", {
    contentType: "application/json",
    body: JSON.stringify({ ...data, external: external.get(page) }),
  });
  expect(external.get(page)).toEqual([]);
  expect(data.writes).toEqual([]);
  expect(
    data.commands.filter((command) =>
      /^scm_token_(?:set|delete)$/.test(command),
    ),
  ).toEqual([]);
  for (const request of data.scm) {
    if (request.url === endpoint) {
      expect(request.method).toBe("POST");
      expect(request.auth).toEqual({ kind: "gh", host: "github.com" });
      const query = JSON.parse(request.body ?? "").query;
      expect(query).toMatch(/^\s*query\b/);
      expect(query).not.toMatch(/\bmutation\b/);
    } else {
      expect(request.method).toBe("GET");
      expect(request.url).toMatch(
        /^https:\/\/api\.bitbucket\.org\/2\.0\/repositories\/qa-team\/api\/pullrequests(?:\?|\/)/,
      );
    }
  }
});

const qaOnly = () =>
  test.skip(
    process.env.N23_BUILD === "production",
    "synthetische Review-Fixture",
  );

test("N23 trennt offen und veraltet und öffnet nur passende Originale", async ({
  page,
}, info) => {
  qaOnly();
  if (info.project.name === "narrow-dark-reduced")
    await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(fixture);
  await expect(trigger(page)).toBeVisible();
  expect((await ledger(page)).reads).toEqual([]);
  await trigger(page).focus();
  await page.keyboard.press("Enter");
  await expect(dialog(page).getByRole("heading")).toBeFocused();
  const open = list(page)
    .getByRole("listitem")
    .filter({ hasText: "src/offen-und-veraltet.ts" });
  await expect(open).toContainText("Offen");
  await expect(open).toContainText("Codebezug veraltet");
  const done = list(page)
    .getByRole("listitem")
    .filter({ hasText: "src/geloest-aktuell.ts" });
  await expect(done).toContainText("Gelöst");
  await expect(done).toContainText("Codebezug aktuell");
  await expect(
    dialog(page).getByRole("button", { name: "Original öffnen" }),
  ).toHaveCount(2);
  await expect(
    list(page).getByText("Originallink nicht bestätigt"),
  ).toHaveCount(2);
  expect(
    await dialog(page).evaluate(
      (node) => node.scrollWidth <= node.clientWidth + 1,
    ),
  ).toBe(true);
  await info.attach("n23-view", {
    contentType: "image/png",
    body: await dialog(page).screenshot(),
  });
  await open.getByRole("button", { name: "Original öffnen" }).click();
  await expect
    .poll(async () => (await ledger(page)).opened)
    .toEqual([original]);
  await page.keyboard.press("Escape");
  await expect(trigger(page)).toBeFocused();
  expect((await ledger(page)).reads).toEqual([expectedRead()]);
});

test("N23 trennt paginierte unvollständige Antwort und bestätigte Leere", async ({
  page,
}) => {
  qaOnly();
  await page.goto(fixture);
  await state(page, { mode: "partial" });
  await trigger(page).click();
  await expect(dialog(page).getByRole("status")).toContainText("Teilansicht");
  await expect(list(page).getByRole("listitem")).toHaveCount(1);
  await expect(list(page)).not.toContainText("src/keine-flags.ts");
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  await state(page, { mode: "empty" });
  await trigger(page).click();
  await expect(dialog(page)).toContainText(
    "GitHub meldet keine Reviewgespräche",
  );
  await expect(list(page)).toHaveCount(0);
  expect((await ledger(page)).reads).toEqual([expectedRead(), expectedRead()]);
});

for (const mode of ["denied", "graphql-denied", "wrong-viewer"] as const) {
  test(`N23 sperrt den nicht bestätigten Ergebniszugriff (${mode})`, async ({
    page,
  }) => {
    qaOnly();
    await page.goto(fixture);
    await state(page, { mode });
    await trigger(page).click();
    await expect(dialog(page).getByRole("alert")).toContainText(
      mode === "wrong-viewer"
        ? "konnten für diese Verbindung"
        : "Kein bestätigter Lesezugriff",
    );
    await expect(list(page)).toHaveCount(0);
    await expect(dialog(page)).not.toContainText("Interner Fixture-Fehler");
    expect((await ledger(page)).reads).toEqual([expectedRead()]);
    await state(page, { mode: "normal" });
    await dialog(page)
      .getByRole("button", { name: "Erneut versuchen" })
      .click();
    await expect(list(page)).toContainText("src/offen-und-veraltet.ts");
    expect((await ledger(page)).reads).toEqual([
      expectedRead(),
      expectedRead(),
    ]);
  });
}

test("N23 verwirft die späte Antwort nach Repository-Wechsel", async ({
  page,
}) => {
  qaOnly();
  await page.goto(fixture);
  await park(page);
  await page.getByRole("combobox", { name: "Repository filtern" }).click();
  await page.getByRole("option", { name: "qa/design-system" }).click();
  await expect(page).toHaveURL(/design-system/);
  await expect(dialog(page)).toHaveCount(0);
  await release(page);
  await expect(page.getByText("src/verspaetete-alte-antwort.ts")).toHaveCount(
    0,
  );
  expect((await ledger(page)).reads).toEqual([expectedRead()]);
  await trigger(page, "qa/design-system", 12).click();
  await expect(list(page)).toContainText("src/anderes-repo.ts");
  expect((await ledger(page)).reads).toEqual([
    expectedRead(),
    expectedRead("design-system", 12),
  ]);
});

test("N23 verwirft die späte Antwort nach Wechsel des SCM-Kontos am selben Host", async ({
  page,
}) => {
  qaOnly();
  await page.goto(fixture);
  await park(page);
  await page.evaluate(async () => {
    const app = window as unknown as Fixture;
    app.__qaScm.hosts.hosts["github.com"]![0]!.login = "qa-n23-other";
    await app.__qaRefreshScmHosts();
  });
  await expect(dialog(page)).toHaveCount(0);
  await release(page);
  await expect(page.getByText("src/verspaetete-alte-antwort.ts")).toHaveCount(
    0,
  );
  expect((await ledger(page)).reads).toEqual([expectedRead()]);
  await trigger(page).click();
  await expect(list(page)).toContainText("src/neue-verbindung.ts");
  expect((await ledger(page)).reads).toEqual([
    expectedRead(),
    expectedRead("web-app", 41, "qa-n23-other"),
  ]);
});

test("N23 zeigt für Bitbucket nur den bestätigten PR als Fallback", async ({
  page,
}) => {
  qaOnly();
  await page.goto(fixture);
  await trigger(page, "qa-team/api", 7).click();
  await expect(dialog(page)).toContainText(
    "stehen hier für Bitbucket nicht zur Verfügung",
  );
  await expect(list(page)).toHaveCount(0);
  await dialog(page)
    .getByRole("button", { name: "PR auf Bitbucket öffnen" })
    .click();
  await expect
    .poll(async () => (await ledger(page)).opened)
    .toEqual(["https://bitbucket.org/qa-team/api/pull-requests/7"]);
  expect((await ledger(page)).reads).toEqual([]);
});

test("N23 bleibt im Produktionsbuild selbst mit synthetischer Markierung aus", async ({
  page,
}) => {
  test.skip(
    process.env.N23_BUILD !== "production",
    "Kontrolle am regulären Build",
  );
  await page.goto(fixture);
  const row = page.getByRole("button", {
    name: /Suche für den Arbeitsalltag vereinfachen/,
  });
  await expect(row).toBeVisible();
  await expect(trigger(page)).toHaveCount(0);
  await row.click();
  await expect
    .poll(async () => (await ledger(page)).opened)
    .toEqual(["https://github.com/qa/web-app/pull/41"]);
  expect((await ledger(page)).reads).toEqual([]);
});
