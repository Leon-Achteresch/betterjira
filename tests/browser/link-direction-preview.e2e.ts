import { expect, test, type Page } from "@playwright/test";

const trigger = (page: Page, key = "DEMO-2") =>
  page.getByRole("button", {
    name: `Richtung der Verknüpfung zu ${key} prüfen`,
    exact: true,
  });
const dialog = (page: Page) =>
  page.getByRole("dialog", { name: "Linkrichtung prüfen", exact: true });
const current = (page: Page) =>
  dialog(page).getByRole("region", { name: "Aktuell", exact: true });
const reversed = (page: Page) =>
  dialog(page).getByRole("region", { name: "Umgekehrte Richtung" });
const panel = (page: Page) =>
  page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: /^Verknüpfungen/ }) });
const route = (key = "DEMO-1", cloud = "qa-cloud") =>
  `/tests/browser/fixture.html?route=/issue/${key}&cloud=${cloud}`;

type Read = {
  method: "GET";
  path: string;
  fields: string | null;
  account: string;
  cloud: string;
};
type Match =
  "removed" | "symmetric" | "changed" | "parallel" | "missing-backlink";
type FixtureState = {
  accountReads: Read[];
  endpointReads: Read[];
  patch?: Match;
  denied?: number;
  hold?: boolean;
  release?: () => void;
  resolved?: boolean;
};
type Fixture = {
  __qa: { accountId?: string; writes: unknown[] };
  __qaSiteUrl?: string;
  __n25: FixtureState;
  __qaIssueLinksRule: (key: string) => { issuelinks: unknown[] };
  __qaReadRule: (path: string, params: URLSearchParams) => Promise<unknown>;
};

async function seed(page: Page) {
  await page.addInitScript(() => {
    const app = window as unknown as Fixture;
    const cloud =
      new URLSearchParams(location.search).get("cloud") ?? "qa-cloud";
    const otherSite = cloud === "qa-new-cloud";
    if (otherSite) app.__qaSiteUrl = "https://fixture-b.atlassian.net";
    const state: FixtureState = { accountReads: [], endpointReads: [] };
    app.__n25 = state;

    const type = otherSite
      ? {
          id: "23",
          name: "Requires",
          outward: "requires",
          inward: "is required by",
        }
      : {
          id: "23",
          name: "Blocks",
          outward: "blocks",
          inward: "is blocked by",
        };
    const source = { id: "stable-link", type, outwardIssue: { key: "DEMO-2" } };
    const symmetric = {
      id: "symmetric",
      type: {
        id: "24",
        name: "Relates",
        outward: "relates to",
        inward: " Relates  to ",
      },
      outwardIssue: { key: "DEMO-3" },
    };
    const duplicate = {
      id: "duplicate",
      type: {
        id: "25",
        name: "Duplicate",
        outward: "duplicates",
        inward: "is duplicated by",
      },
      outwardIssue: { key: "OPS-7" },
    };
    const backlink = { id: source.id, type, inwardIssue: { key: "DEMO-1" } };
    const links = (key: string) =>
      key === "DEMO-1"
        ? [source, symmetric, duplicate]
        : key === "DEMO-2"
          ? [backlink]
          : [];
    app.__qaIssueLinksRule = (key) => ({ issuelinks: links(key) });

    app.__qaReadRule = async (path, params) => {
      const row: Read = {
        method: "GET",
        path,
        fields: params.get("fields"),
        account: app.__qa.accountId ?? "qa-user",
        cloud,
      };
      if (path === "/myself") state.accountReads.push(row);
      const key = /^\/issue\/(DEMO-[12])$/.exec(path)?.[1];
      if (!key || row.fields !== "issuelinks") return;
      state.endpointReads.push(row);
      if (key === "DEMO-2" && state.denied)
        return {
          status: state.denied,
          body: { errorMessages: ["Vertraulicher Fixture-Fehler"] },
        };
      let issuelinks: unknown[] = links(key);
      if (key === "DEMO-1") {
        if (state.patch === "removed") issuelinks = [symmetric, duplicate];
        if (state.patch === "symmetric")
          issuelinks = [{ ...source, type: { ...type, inward: type.outward } }];
        if (state.patch === "changed")
          issuelinks = [{ ...source, type: { ...type, inward: "depends on" } }];
        if (state.patch === "parallel")
          issuelinks = [
            source,
            { ...backlink, id: "reversed", inwardIssue: { key: "DEMO-2" } },
          ];
      } else if (state.patch === "missing-backlink") issuelinks = [];
      if (key === "DEMO-2" && state.hold) {
        state.hold = false;
        await new Promise<void>((resolve) => {
          state.release = resolve;
        });
        state.resolved = true;
      }
      return { body: { key, fields: { issuelinks } } };
    };
  });
}

const ledger = (page: Page) =>
  page.evaluate(() => {
    const app = window as unknown as Fixture;
    return {
      accountReads: app.__n25.accountReads,
      endpointReads: app.__n25.endpointReads,
      writes: app.__qa.writes,
    };
  });
const setFixture = (page: Page, patch: Partial<FixtureState>) =>
  page.evaluate((value) => {
    Object.assign((window as unknown as Fixture).__n25, value);
  }, patch);
const endpointCount = async (page: Page) =>
  (await ledger(page)).endpointReads.length;
const endpointPaths = async (page: Page, from: number) =>
  (await ledger(page)).endpointReads.slice(from).map(({ path }) => path);
const assertReadOnly = async (page: Page, name: string) => {
  const evidence = await ledger(page);
  await test
    .info()
    .attach(name, {
      contentType: "application/json",
      body: JSON.stringify(evidence),
    });
  expect(evidence.writes).toEqual([]);
};

async function hold(page: Page) {
  await setFixture(page, { hold: true, resolved: false, release: undefined });
  await trigger(page).click();
  await expect(
    dialog(page).getByRole("status", { name: "Beide Tickets werden geprüft" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => typeof (window as unknown as Fixture).__n25.release),
    )
    .toBe("function");
}

async function release(page: Page) {
  await page.evaluate(() => (window as unknown as Fixture).__n25.release?.());
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as Fixture).__n25.resolved),
    )
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  await seed(page);
});
test.afterEach(async ({ page }) => {
  await assertReadOnly(page, "n25-jira-ledger");
});

test("N25 vergleicht beide Endpunktperspektiven, mit Tastatur, Fokusrückgabe und schmalem Layout", async ({
  page,
}, info) => {
  if (info.project.name === "narrow-dark-reduced")
    await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(route());
  await expect(trigger(page)).toBeVisible();
  await expect(trigger(page, "DEMO-3")).toHaveCount(0);
  await expect(panel(page).getByRole("link", { name: /DEMO-3/ })).toBeVisible();
  await expect(
    panel(page).getByRole("button", {
      name: "Duplikatlink zu OPS-7 vergleichen",
    }),
  ).toBeVisible();
  const before = await endpointCount(page);
  await trigger(page).focus();
  await expect(trigger(page)).toBeFocused();
  expect(await endpointCount(page)).toBe(before);
  await page.keyboard.press("Enter");
  await expect(
    dialog(page).getByRole("heading", { name: "Linkrichtung prüfen" }),
  ).toBeFocused();
  await expect(dialog(page)).toContainText("Linktyp Blocks (23)");
  await expect(current(page).getByRole("listitem")).toHaveText([
    "DEMO-1 blocks DEMO-2",
    "DEMO-2 is blocked by DEMO-1",
  ]);
  await expect(reversed(page).getByRole("listitem")).toHaveText([
    "DEMO-1 is blocked by DEMO-2",
    "DEMO-2 blocks DEMO-1",
  ]);
  expect(await endpointPaths(page, before)).toEqual([
    "/issue/DEMO-1",
    "/issue/DEMO-2",
  ]);

  const bounds = await dialog(page).boundingBox();
  expect(bounds?.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
  await info.attach("n25-link-direction", {
    contentType: "image/png",
    body: await page.screenshot(),
  });

  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  await expect(trigger(page)).toBeFocused();
  await panel(page)
    .getByRole("link", { name: /DEMO-2/ })
    .click();
  await expect(page).toHaveURL(/\/issue\/DEMO-2$/);
  await trigger(page, "DEMO-1").click();
  await expect(current(page).getByRole("listitem")).toHaveText([
    "DEMO-2 is blocked by DEMO-1",
    "DEMO-1 blocks DEMO-2",
  ]);
  await expect(reversed(page).getByRole("listitem")).toHaveText([
    "DEMO-2 blocks DEMO-1",
    "DEMO-1 is blocked by DEMO-2",
  ]);
});

test("N25 zeigt fehlende Rechte und wiederholt einen fehlgeschlagenen Read nur ausdrücklich", async ({
  page,
}) => {
  await page.goto(route());
  await expect(trigger(page)).toBeVisible();
  const before = await endpointCount(page);
  await setFixture(page, { denied: 403 });
  await trigger(page).click();
  await expect(dialog(page).getByRole("alert")).toHaveText(
    "Mindestens ein Ticket ist für dieses Konto nicht lesbar.",
  );
  await expect(reversed(page)).toHaveCount(0);
  await setFixture(page, { denied: 503 });
  const retry = dialog(page).getByRole("button", { name: "Erneut versuchen" });
  await retry.focus();
  await page.keyboard.press("Enter");
  await expect(dialog(page).getByRole("alert")).toHaveText(
    "Die Richtungsvorschau konnte nicht geladen werden.",
  );
  expect(await endpointPaths(page, before)).toEqual([
    "/issue/DEMO-1",
    "/issue/DEMO-2",
    "/issue/DEMO-1",
    "/issue/DEMO-2",
  ]);
  await setFixture(page, { denied: undefined });
  await retry.click();
  await expect(reversed(page)).toBeVisible();
  expect(await endpointPaths(page, before)).toEqual(
    Array.from({ length: 3 }, () => ["/issue/DEMO-1", "/issue/DEMO-2"]).flat(),
  );
});

for (const patch of [
  "removed",
  "symmetric",
  "changed",
  "parallel",
  "missing-backlink",
] as const) {
  test(`N25 sperrt eine inzwischen unbestätigte Relation (${patch})`, async ({
    page,
  }) => {
    await page.goto(route());
    await expect(trigger(page)).toBeVisible();
    const before = await endpointCount(page);
    await setFixture(page, { patch });
    await trigger(page).click();
    await expect(dialog(page).getByRole("alert")).toContainText(
      "nicht eindeutig bestätigt",
    );
    await expect(reversed(page)).toHaveCount(0);
    expect(await endpointPaths(page, before)).toEqual(
      patch === "missing-backlink"
        ? ["/issue/DEMO-1", "/issue/DEMO-2"]
        : ["/issue/DEMO-1"],
    );
  });
}

test("N25 verwirft verspätete Antworten nach Escape und Ticketnavigation", async ({
  page,
}) => {
  await page.goto(route());
  await expect(trigger(page)).toBeVisible();
  const beforeEscape = (await ledger(page)).accountReads.length;
  await hold(page);
  await page.keyboard.press("Escape");
  await expect(trigger(page)).toBeFocused();
  await release(page);
  await expect(dialog(page)).toHaveCount(0);
  expect((await ledger(page)).accountReads.slice(beforeEscape)).toHaveLength(1);

  await hold(page);
  await panel(page)
    .getByRole("link", { name: /DEMO-2/ })
    .click();
  await expect(page).toHaveURL(/\/issue\/DEMO-2$/);
  await release(page);
  await expect(dialog(page)).toHaveCount(0);
  await expect(trigger(page, "DEMO-1")).toBeVisible();
});

test("N25 schließt beim Kontowechsel mit gehaltener Antwort und liest erst nach erneuter Wahl", async ({
  page,
}) => {
  await page.goto(route());
  await hold(page);
  const browserTime = await page.evaluate(() => {
    (window as unknown as Fixture).__qa.accountId = "qa-other-account";
    return Date.now();
  });
  await page.clock.setFixedTime(new Date(browserTime + 120_000));
  await page.evaluate(() =>
    window.dispatchEvent(new Event("visibilitychange")),
  );
  await expect
    .poll(async () =>
      (await ledger(page)).accountReads.some(
        ({ account }) => account === "qa-other-account",
      ),
    )
    .toBe(true);
  await expect(dialog(page)).toHaveCount(0);
  await release(page);
  await expect(dialog(page)).toHaveCount(0);
  await expect(trigger(page)).toBeVisible();
  const before = await endpointCount(page);
  await trigger(page).click();
  await expect(reversed(page)).toBeVisible();
  expect(
    (await ledger(page)).endpointReads
      .slice(before)
      .map(({ account }) => account),
  ).toEqual(["qa-other-account", "qa-other-account"]);
});

test("N25 verwirft eine verspätete Antwort beim Trennen und bindet die neue Vorschau an die andere Site", async ({
  page,
}) => {
  await page.goto(route());
  await hold(page);
  const profile = page
    .locator('[data-sidebar="footer"]:visible')
    .getByRole("button", { name: /Lokale UI-Testdaten/ });
  if (!(await profile.isVisible()))
    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await profile.click();
  await page.getByRole("menuitem", { name: "Abmelden", exact: true }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(trigger(page)).toHaveCount(0);
  await release(page);
  await expect(dialog(page)).toHaveCount(0);
  await assertReadOnly(page, "n25-previous-connection");

  await page.goto(route("DEMO-1", "qa-new-cloud"));
  await expect(trigger(page)).toBeVisible();
  await expect(dialog(page)).toHaveCount(0);
  const before = await endpointCount(page);
  await trigger(page).click();
  await expect(dialog(page)).toContainText("Linktyp Requires (23)");
  await expect(current(page).getByRole("listitem")).toHaveText([
    "DEMO-1 requires DEMO-2",
    "DEMO-2 is required by DEMO-1",
  ]);
  expect(
    (await ledger(page)).endpointReads.slice(before).map(({ cloud }) => cloud),
  ).toEqual(["qa-new-cloud", "qa-new-cloud"]);
});
