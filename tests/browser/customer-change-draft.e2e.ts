import { expect, test, type Page } from "@playwright/test";

type Fixture = {
  __qa: { accountId?: string; writes: unknown[] };
  __qaSearchRule: (jql: string, cursor: string | null, params: URLSearchParams) => unknown;
  n24: { copies: string[]; cursors: (string | null)[] };
};
const route = "/tests/browser/fixture.html?route=/bereiche/DEMO";
const menu = (page: Page) => page.getByRole("button", { name: "Ansicht und Export" });
const entry = (page: Page) => page.getByRole("menuitem", { name: "Kundenhinweis entwerfen…", exact: true });
const panel = (page: Page) => page.getByRole("dialog", { name: "Kundenhinweis entwerfen", exact: true });
const text = (page: Page) => panel(page).getByRole("textbox", { name: "Text für Kunden" });
const review = (page: Page) => panel(page).getByRole("checkbox", { name: "Text für Kunden geprüft" });
const copy = (page: Page) => panel(page).getByRole("button", { name: "Kundenhinweis kopieren" });
const sources = (page: Page) => panel(page).getByRole("list", { name: "Ausgewählte Quellen (intern)" });
const select = (page: Page, key: string) => page.getByRole("checkbox", { name: `${key} auswählen` }).press("Space");
const ledger = (page: Page) => page.evaluate(() => {
  const { __qa, n24 } = window as unknown as Fixture;
  return { ...n24, writes: __qa.writes };
});

const openMenu = async (page: Page) => {
  await menu(page).press("Enter");
  const sub = page.getByRole("menuitem", { name: "Kopieren als" });
  await expect(sub).toBeVisible();
  await sub.focus();
  await page.keyboard.press("ArrowRight");
  await expect(entry(page)).toBeVisible();
};
const openDraft = async (page: Page) => {
  await openMenu(page);
  await expect(entry(page)).toBeEnabled();
  await entry(page).press("Enter");
  await expect(text(page)).toBeFocused();
};

test.beforeEach(async ({ page }, info) => {
  if (info.project.name === "narrow-dark-reduced") await page.setViewportSize({ width: 390, height: 720 });
  page.on("pageerror", (error) => { throw error; });
  await page.route("**/*", (request) => new URL(request.request().url()).hostname === "127.0.0.1" ? request.continue() : request.abort());
  await page.addInitScript(() => {
    const fixture = window as unknown as Fixture;
    fixture.n24 = { copies: [], cursors: [] };
    Object.defineProperty(navigator, "clipboard", { value: { writeText: async (value: string) => void fixture.n24.copies.push(value) } });
    const subjects = ["Interne Bestellansicht", "Interner Eskalationsweg", "Ungewählte Änderung"];
    const issues = subjects.map((summary, index) => ({
      id: `81${index}`, key: `DEMO-${index + 1}`, fields: {
        summary,
        description: "VERTRAULICH – interne Beschreibung",
        internalLink: "https://jira.private.test/OnlyInternal",
        status: { id: "4", name: "Erledigt", statusCategory: { key: "done", colorName: "green" } },
      },
    }));
    fixture.__qaSearchRule = (jql, cursor, params) => {
      if (!jql.includes("DEMO") || !params.get("fields")?.split(",").includes("summary")) return;
      fixture.n24.cursors.push(cursor);
      if (cursor) return { status: 403 };
      return { page: { issues, isLast: false, nextPageToken: "n24-next-page" } };
    };
  });
});

test.afterEach(async ({ page }, info) => {
  if (!page.isClosed() && await page.evaluate(() => Reflect.has(window, "__qa")))
    await info.attach("jira-and-clipboard-ledger", { body: JSON.stringify(await ledger(page)), contentType: "application/json" });
});

test("nur gewählte Quellen und bewusst geprüfter Kundentext gelangen in die Kopierfassung", async ({ page }, info) => {
  await page.goto(route);
  await expect(page.getByRole("cell", { name: "DEMO-1", exact: true })).toBeVisible();
  await openMenu(page);
  await expect(entry(page)).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(menu(page)).toBeFocused();

  await select(page, "DEMO-1");
  await select(page, "DEMO-2");
  await openDraft(page);
  await expect(sources(page).getByRole("listitem")).toHaveCount(2);
  await expect(sources(page)).toContainText("DEMO-1");
  await expect(sources(page)).toContainText("DEMO-2");
  await expect(sources(page)).not.toContainText("DEMO-3");
  await expect(panel(page)).toContainText("Weitere Treffer sind möglich");
  await expect(text(page)).toHaveValue("");
  await expect(copy(page)).toBeDisabled();
  await expect(review(page)).toBeDisabled();
  expect(await ledger(page)).toMatchObject({ copies: [], writes: [] });
  expect((await ledger(page)).cursors).not.toContain("n24-next-page");

  await panel(page).getByRole("button", { name: "Titel von DEMO-1 einfügen" }).press("Enter");
  await expect(text(page)).toHaveValue("Interne Bestellansicht");
  await expect(panel(page).getByRole("button", { name: "Titel von DEMO-1 eingefügt" })).toBeDisabled();
  await expect(copy(page)).toBeDisabled();
  await review(page).press("Space");
  await expect(copy(page)).toBeEnabled();
  const finalText = "Die Bestellübersicht zeigt zusammengehörige Änderungen.\nDetails zur Verfügbarkeit folgen.";
  await text(page).fill(finalText);
  await expect(review(page)).not.toBeChecked();
  await expect(copy(page)).toBeDisabled();
  expect(await ledger(page)).toMatchObject({ copies: [], writes: [] });
  await review(page).press("Space");
  await expect(copy(page)).toBeInViewport({ ratio: 0.98 });
  await expect(panel(page).getByRole("heading", { name: "Kundenhinweis entwerfen" })).toBeInViewport({ ratio: 0.98 });
  await panel(page).screenshot({ path: info.outputPath("kundenhinweis.png"), animations: "disabled" });
  await copy(page).press("Enter");
  await expect.poll(() => ledger(page)).toMatchObject({ copies: [finalText], writes: [] });
  await expect(text(page)).toHaveValue(finalText);
});

test("fehlgeschlagene Folgeseite begrenzt Quellen und Abwahl beendet den alten Entwurf", async ({ page }) => {
  await page.goto(route);
  await select(page, "DEMO-1");
  await select(page, "DEMO-2");
  await page.getByRole("button", { name: /^Weitere laden/ }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Weitere Vorgänge konnten nicht geladen" })).toBeVisible();
  await openDraft(page);
  await expect(panel(page)).toContainText("Ein Abruf ist fehlgeschlagen");
  await expect(sources(page).getByRole("listitem")).toHaveCount(2);
  await text(page).fill("Vorläufige Fassung der Auswahl.");
  await review(page).press("Space");
  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);
  await expect(menu(page)).toBeFocused();
  await openDraft(page);
  await expect(text(page)).toHaveValue("Vorläufige Fassung der Auswahl.");
  await expect(copy(page)).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(panel(page)).toHaveCount(0);
  await select(page, "DEMO-2");
  await openDraft(page);
  await expect(sources(page).getByRole("listitem")).toHaveCount(1);
  await expect(sources(page)).toContainText("DEMO-1");
  await expect(text(page)).toHaveValue("");
  expect(await ledger(page)).toMatchObject({ copies: [], writes: [] });
  expect((await ledger(page)).cursors.filter(Boolean)).toEqual(["n24-next-page"]);
});

test("Kontowechsel mit offenem Entwurf widerruft Kopierfreigabe auch nach Rückkehr", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-17T12:00:00Z"));
  await page.goto(route);
  await select(page, "DEMO-1");
  await openDraft(page);
  await text(page).fill("Fassung nur für das erste Konto.");
  await review(page).press("Space");
  await expect(copy(page)).toBeEnabled();
  await page.evaluate(() => { (window as unknown as Fixture).__qa.accountId = "qa-n24-other"; });
  await page.clock.setFixedTime(new Date("2026-11-17T12:05:00Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
  await expect(panel(page)).toHaveCount(0);
  await select(page, "DEMO-1");
  await openDraft(page);
  await expect(text(page)).toHaveValue("");
  await expect(copy(page)).toBeDisabled();

  await page.evaluate(() => { delete (window as unknown as Fixture).__qa.accountId; });
  await page.clock.setFixedTime(new Date("2026-11-17T12:10:00Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
  await expect(panel(page)).toHaveCount(0);
  await select(page, "DEMO-1");
  await openDraft(page);
  await expect(text(page)).toHaveValue("");
  await expect(copy(page)).toBeDisabled();
  expect(await ledger(page)).toMatchObject({ copies: [], writes: [] });
});
