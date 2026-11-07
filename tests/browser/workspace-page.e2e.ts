import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __qaReads?: string[];
  }
}

const shots = process.env.WORKSPACE_SHOTS;
const own = JSON.stringify(["qa-cloud", "qa-user"]);
const colleague = JSON.stringify(["qa-cloud", "qa-colleague"]);

const open = async (page: Page, route = "/arbeitsplatz", account?: string) => {
  await page.goto(
    `/tests/browser/fixture.html?${new URLSearchParams({ scenario: "workspace", route, ...(account && { account }) })}`,
  );
  await expect(page.getByRole("heading", { name: "Arbeitsplatz", level: 1 })).toBeVisible();
};

const filters = (page: Page) => page.getByRole("navigation", { name: "Arbeitskontexte filtern" });
const list = (page: Page) => page.getByRole("list", { name: "Arbeitskontexte" });
const rows = (page: Page) => list(page).getByRole("listitem");
const search = (page: Page) => page.getByRole("searchbox", { name: "Arbeitsplatz durchsuchen" });
const stored = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("betterjira-workspaces") ?? "{}").state.workspaces);

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.clock.setFixedTime(new Date("2026-11-06T12:00:00.000Z"));
});

test("Überblick zählt Arten getrennt und zeigt unbekannte Tickets nur mit Schlüssel", async ({ page }) => {
  await open(page);
  await expect(filters(page).getByRole("link", { name: "Alle 11" })).toHaveAttribute("aria-current", "page");
  for (const name of ["Angeheftet 2", "Entwürfe 3", "Notizen 1", "Zuletzt 10"])
    await expect(filters(page).getByRole("link", { name })).toBeVisible();
  await expect(rows(page)).toHaveCount(11);
  if ((page.viewportSize()?.width ?? 0) >= 768)
    for (const link of await filters(page).getByRole("link").all())
      await expect(link).toBeInViewport({ ratio: 1 });
  await expect(list(page).getByRole("link", { name: "OPS-7", exact: true })).toBeVisible();
  await expect(list(page).getByText("QA-Notiz eines anderen Kontos")).toHaveCount(0);
  await expect(list(page).getByText("DEMO-12")).toHaveCount(0);
  const draftRow = rows(page).filter({ hasText: "DEMO-3" });
  await expect(draftRow.getByText("QA-Entwurf: Rückfrage zur Übergabe noch offen")).toBeVisible();
  await expect(rows(page).filter({ hasText: "DEMO-1" }).first().getByText("Lesestelle gemerkt")).toBeVisible();
  await expect(search(page)).not.toBeFocused();
  if (shots) await page.screenshot({ path: `${shots}/${test.info().project.name}-overview.png` });
  for (const width of [1024, 760]) {
    await page.setViewportSize({ width, height: 900 });
    for (const link of await filters(page).getByRole("link").all())
      await expect(link).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(rows(page)).toHaveCount(11);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (shots) await page.screenshot({ path: `${shots}/${test.info().project.name}-390.png` });
});

test("Filter und Suche stehen in der URL und folgen Zurück und Vorwärts", async ({ page }) => {
  await open(page);
  await filters(page).getByRole("link", { name: /^Entwürfe/ }).click();
  await expect(page).toHaveURL(/\/arbeitsplatz\?art=entwuerfe$/);
  await expect(rows(page)).toHaveCount(3);
  await expect(list(page).getByRole("link", { name: /^DEMO-2:/ })).toBeVisible();
  await expect(list(page).getByRole("link", { name: "OPS-7", exact: true })).toBeVisible();

  await filters(page).getByRole("link", { name: /^Notizen/ }).click();
  await expect(page).toHaveURL(/art=notizen$/);
  await expect(rows(page)).toHaveCount(1);
  await expect(list(page).getByText("QA-Notiz: vor Freigabe mit Team abstimmen")).toBeVisible();

  await page.goBack();
  await expect(filters(page).getByRole("link", { name: /^Entwürfe/ })).toHaveAttribute("aria-current", "page");
  await page.goForward();
  await expect(filters(page).getByRole("link", { name: /^Notizen/ })).toHaveAttribute("aria-current", "page");

  await filters(page).getByRole("link", { name: /^Alle/ }).click();
  await search(page).fill("freigabe");
  await expect(page).toHaveURL(/q=freigabe/);
  await expect(rows(page)).toHaveCount(1);
  await search(page).fill("gibt es nicht");
  await expect(page.getByText("Kein passender Arbeitskontext")).toBeVisible();
  await page.getByRole("button", { name: "Suche zurücksetzen" }).click();
  await expect(rows(page)).toHaveCount(11);
  await expect(page).toHaveURL(/\/arbeitsplatz$/);

  await page.goto("/tests/browser/fixture.html?scenario=workspace&route=/arbeitsplatz?art=unbekannt");
  await expect(filters(page).getByRole("link", { name: /^Alle/ })).toHaveAttribute("aria-current", "page");
});

test("Öffnen setzt im Ticket fort und überschreibt keinen Entwurf", async ({ page }) => {
  await open(page);
  const before = await stored(page);
  await list(page).getByRole("link", { name: /^DEMO-3:/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/issue\/DEMO-3$/);
  await expect(page.getByRole("textbox", { name: "Kommentar" })).toHaveValue("QA-Entwurf: Rückfrage zur Übergabe noch offen");
  await page.goBack();
  await expect(page).toHaveURL(/\/arbeitsplatz$/);
  const after = await stored(page);
  expect(after[own].drafts).toEqual(before[own].drafts);
  expect(after[own].contexts["DEMO-4"].note).toBe(before[own].contexts["DEMO-4"].note);
  expect(after[colleague]).toEqual(before[colleague]);
});

test("Anheften und Lösen bleibt mit Weiterarbeiten synchron", async ({ page }) => {
  await open(page);
  await rows(page).filter({ hasText: "DEMO-1" }).first().hover();
  await page.getByRole("button", { name: "DEMO-1 anheften" }).click();
  await expect(page.getByRole("button", { name: "DEMO-1 lösen" })).toHaveAttribute("aria-pressed", "true");
  await expect(filters(page).getByRole("link", { name: "Angeheftet 3" })).toBeVisible();

  await page.getByRole("navigation", { name: "Werkzeuge" }).getByRole("button", { name: "Weiterarbeiten" }).click();
  const sheet = page.getByRole("dialog", { name: "Weiterarbeiten" });
  await sheet.getByRole("button", { name: "Angeheftet" }).click();
  await expect(sheet.getByRole("button", { name: "DEMO-1 lösen" })).toBeVisible();
  await sheet.getByRole("button", { name: "DEMO-2 lösen" }).click();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  await expect(filters(page).getByRole("link", { name: "Angeheftet 2" })).toBeVisible();
  await expect(page.getByRole("button", { name: "DEMO-2 anheften" })).toHaveAttribute("aria-pressed", "false");
});

test("Daten bleiben je Konto getrennt, Abmelden blendet sie aus", async ({ page }) => {
  await open(page, "/arbeitsplatz", "qa-colleague");
  await expect(rows(page)).toHaveCount(1);
  await expect(list(page).getByText("QA-Notiz eines anderen Kontos")).toBeVisible();
  await expect(list(page).getByText("QA-Entwurf: Rückfrage zur Übergabe noch offen")).toHaveCount(0);
  await expect(list(page).getByRole("link", { name: "OPS-7", exact: true })).toHaveCount(0);

  await page.locator("header").first().getByRole("button", { name: "Suchen" }).click();
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await palette.getByRole("combobox").fill("Abmelden");
  await palette.getByRole("option", { name: /Abmelden/ }).click();
  await expect(page.getByRole("main").getByText("Nicht angemeldet", { exact: true })).toBeVisible();
  await expect(list(page)).toHaveCount(0);

  await open(page);
  await expect(rows(page)).toHaveCount(11);
  const workspaces = await stored(page);
  expect(workspaces[colleague].drafts["DEMO-12"]).toBe("QA-Entwurf eines anderen Kontos");
  expect(workspaces[own].drafts["DEMO-3"]).toBe("QA-Entwurf: Rückfrage zur Übergabe noch offen");
});

test("Leere Kategorien erklären sich und die Navigation führt zum Arbeitsplatz", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("betterjira-workspaces"))
      localStorage.setItem(
        "betterjira-workspaces",
        JSON.stringify({
          state: {
            workspaces: {
              [JSON.stringify(["qa-cloud", "qa-user"])]: { recent: [], pinned: [], drafts: {}, newestFirst: false, contexts: {} },
            },
          },
          version: 0,
        }),
      );
    localStorage.setItem("betterjira-field-drafts", JSON.stringify({ state: { drafts: {} }, version: 0 }));
  });
  await page.goto("/tests/browser/fixture.html?scenario=workspace&route=/");
  if ((page.viewportSize()?.width ?? 0) < 768) await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("link", { name: "Arbeitsplatz" }).click();
  await expect(page).toHaveURL(/\/arbeitsplatz$/);
  await expect(page.getByText("Noch kein Arbeitskontext")).toBeVisible();
  await filters(page).getByRole("link", { name: /^Notizen/ }).click();
  await expect(page.getByText("Keine privaten Notizen")).toBeVisible();
  if (shots) await page.screenshot({ path: `${shots}/${test.info().project.name}-empty.png` });
});

const STANDARD_ORDER = ["DEMO-10", "DEMO-2", "DEMO-9", "DEMO-11", "DEMO-1"];
const OPENED_ORDER = ["DEMO-2", "DEMO-10", "DEMO-9", "DEMO-11", "DEMO-1"];
const KEY_ORDER = ["DEMO-1", "DEMO-2", "DEMO-9", "DEMO-10", "DEMO-11"];
const TITLE_ORDER = ["DEMO-2", "DEMO-11", "DEMO-9", "DEMO-10", "DEMO-1"];

const seedSortable = (page: Page) =>
  page.addInitScript((now) => {
    window.__qaReads = [];
    const context = (summary: string, minutesAgo: number) => ({
      summary,
      note: "",
      scrollTop: 0,
      visitedAt: now - minutesAgo * 60000,
    });
    if (!localStorage.getItem("betterjira-workspaces"))
      localStorage.setItem(
        "betterjira-workspaces",
        JSON.stringify({
          state: {
            workspaces: {
              [JSON.stringify(["qa-cloud", "qa-user"])]: {
                recent: [
                  { key: "DEMO-10", summary: "Zahlungslauf prüfen" },
                  { key: "DEMO-2", summary: "Abnahme vorbereiten" },
                  { key: "DEMO-9", summary: "Monitoring einrichten" },
                ],
                pinned: [{ key: "DEMO-11", summary: "Backlog ordnen" }],
                drafts: { "DEMO-1": "QA-Entwurf ohne bekannte Details" },
                newestFirst: false,
                contexts: {
                  "DEMO-10": context("Zahlungslauf prüfen", 20),
                  "DEMO-2": context("Abnahme vorbereiten", 5),
                  "DEMO-9": context("Monitoring einrichten", 40),
                },
              },
            },
          },
          version: 0,
        }),
      );
    if (!localStorage.getItem("betterjira-field-drafts"))
      localStorage.setItem("betterjira-field-drafts", JSON.stringify({ state: { drafts: {} }, version: 0 }));
  }, Date.parse("2026-11-06T12:00:00.000Z"));

const sortControl = (page: Page) => page.getByRole("combobox", { name: "Sortierung" });
const order = (page: Page) =>
  rows(page).evaluateAll((items) =>
    items.map((item) => item.querySelector("a")?.getAttribute("aria-label")?.split(":")[0] ?? ""),
  );
const chooseSort = async (page: Page, label: string) => {
  await sortControl(page).click();
  await page.getByRole("option", { name: label, exact: true }).click();
  await expect(sortControl(page)).toContainText(label);
};
const settle = async (page: Page) => {
  await page.mouse.move(0, 0);
  await expect
    .poll(() => rows(page).evaluateAll((items) => items.every((item) => getComputedStyle(item).transform === "none")))
    .toBe(true);
  const state = await page.evaluate(async () => {
    await document.fonts.load('400 16px "Geist Variable"');
    await document.fonts.ready;
    await Promise.allSettled(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished),
    );
    return {
      loaded: [...document.fonts].some((face) => face.family.includes("Geist") && face.status === "loaded"),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  expect(state.loaded).toBe(true);
  expect(state.overflow).toBeLessThanOrEqual(0);
};

test("Sortierung ordnet geladene Kontexte nur lokal um und behält die Zeilen", async ({ page }) => {
  await seedSortable(page);
  await open(page);
  await expect(rows(page)).toHaveCount(5);
  await expect(sortControl(page)).toContainText("Standard");
  await expect.poll(() => order(page)).toEqual(STANDARD_ORDER);
  await rows(page)
    .filter({ has: page.getByRole("link", { name: /^DEMO-2:/ }) })
    .evaluate((item) => item.setAttribute("data-qa-kept", "DEMO-2"));
  const readsBefore = await page.evaluate(() => window.__qaReads?.length ?? 0);

  for (const [label, expected] of [
    ["Zuletzt geöffnet", OPENED_ORDER],
    ["Ticket-Schlüssel", KEY_ORDER],
    ["Titel", TITLE_ORDER],
    ["Standard", STANDARD_ORDER],
  ] as const) {
    await chooseSort(page, label);
    await expect.poll(() => order(page)).toEqual(expected);
    await expect(filters(page).getByRole("link", { name: "Alle 5" })).toBeVisible();
  }

  const kept = page.locator('[data-qa-kept="DEMO-2"]');
  await expect(kept).toHaveCount(1);
  await expect(kept.getByRole("link", { name: /^DEMO-2:/ })).toBeVisible();
  const reads = await page.evaluate((from) => (window.__qaReads ?? []).slice(from), readsBefore);
  expect(reads.filter((path) => /^\/(search|issue)/.test(path))).toEqual([]);
});

test("Sortierung steht in der URL, bleibt bei Filter und Suche und folgt Zurück und Vorwärts", async ({ page }) => {
  await seedSortable(page);
  await open(page);
  const historyLength = () => page.evaluate(() => history.length);
  const start = await historyLength();

  await chooseSort(page, "Titel");
  await expect(page).toHaveURL(/\/arbeitsplatz\?sort=titel$/);
  await expect.poll(() => order(page)).toEqual(TITLE_ORDER);
  expect(await historyLength()).toBe(start + 1);

  await search(page).pressSequentially("ng");
  await expect(page).toHaveURL(/[?&]q=ng(&|$)/);
  await expect(page).toHaveURL(/[?&]sort=titel(&|$)/);
  await expect.poll(() => order(page)).toEqual(["DEMO-9", "DEMO-10"]);
  expect(await historyLength()).toBe(start + 1);

  await filters(page).getByRole("link", { name: /^Zuletzt/ }).click();
  await expect(page).toHaveURL(/art=zuletzt/);
  await expect(page).toHaveURL(/[?&]sort=titel(&|$)/);
  await search(page).fill("gibt es nicht");
  await page.getByRole("button", { name: "Suche zurücksetzen" }).click();
  await expect(page).toHaveURL(/\/arbeitsplatz\?art=zuletzt&sort=titel$/);
  await expect.poll(() => order(page)).toEqual(["DEMO-2", "DEMO-9", "DEMO-10"]);
  await expect(filters(page).getByRole("link", { name: /^Notizen/ })).toHaveAttribute("href", /sort=titel/);

  await page.goBack();
  await expect(page).toHaveURL(/[?&]q=ng(&|$)/);
  await expect(search(page)).toHaveValue("ng");
  await expect(sortControl(page)).toContainText("Titel");
  await expect.poll(() => order(page)).toEqual(["DEMO-9", "DEMO-10"]);
  await page.goBack();
  await expect(page).toHaveURL(/\/arbeitsplatz$/);
  await expect(sortControl(page)).toContainText("Standard");
  await expect(search(page)).toHaveValue("");
  await expect.poll(() => order(page)).toEqual(STANDARD_ORDER);
  await page.goForward();
  await expect(sortControl(page)).toContainText("Titel");
  await expect.poll(() => order(page)).toEqual(["DEMO-9", "DEMO-10"]);

  await open(page, "/arbeitsplatz?art=zuletzt&sort=schluessel");
  await expect(sortControl(page)).toContainText("Ticket-Schlüssel");
  await expect.poll(() => order(page)).toEqual(["DEMO-2", "DEMO-9", "DEMO-10"]);
  await open(page, "/arbeitsplatz?sort=unbekannt");
  await expect(sortControl(page)).toContainText("Standard");
  await expect.poll(() => order(page)).toEqual(STANDARD_ORDER);
});

test("Sortierung ist per Tastatur und bei 390 px in hell und dunkel bedienbar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedSortable(page);
  await open(page);
  await expect(rows(page)).toHaveCount(5);
  expect((await sortControl(page).boundingBox())?.height).toBeGreaterThanOrEqual(32);

  await sortControl(page).focus();
  await page.keyboard.press("Enter");
  const current = page.getByRole("option", { name: "Standard", exact: true });
  await expect(current).toHaveAttribute("aria-selected", "true");
  await expect(current).toBeFocused();
  for (const option of await page.getByRole("option").all())
    await expect.poll(async () => (await option.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(32);
  if (await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches))
    await expect(page.locator('[data-slot="select-content"]')).toHaveCSS("animation-name", "none");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("option", { name: "Zuletzt geöffnet" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(sortControl(page)).toBeFocused();
  await expect(sortControl(page)).toContainText("Zuletzt geöffnet");
  await expect(page).toHaveURL(/\/arbeitsplatz\?sort=geoeffnet$/);
  await expect.poll(() => order(page)).toEqual(OPENED_ORDER);

  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.classList.contains("dark")))
      .toBe(colorScheme === "dark");
    await settle(page);
    if (shots) await page.screenshot({ path: `${shots}/${test.info().project.name}-sort-390-${colorScheme}.png` });
  }
});
