import { expect, test, type Page } from "@playwright/test";

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
  await expect(list(page).getByRole("link", { name: "OPS-7", exact: true })).toBeVisible();
  await expect(list(page).getByText("QA-Notiz eines anderen Kontos")).toHaveCount(0);
  await expect(list(page).getByText("DEMO-12")).toHaveCount(0);
  const draftRow = rows(page).filter({ hasText: "DEMO-3" });
  await expect(draftRow.getByText("QA-Entwurf: Rückfrage zur Übergabe noch offen")).toBeVisible();
  await expect(rows(page).filter({ hasText: "DEMO-1" }).first().getByText("Lesestelle gemerkt")).toBeVisible();
  await expect(search(page)).not.toBeFocused();
  if (shots) await page.screenshot({ path: `${shots}/${test.info().project.name}-overview.png` });
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
