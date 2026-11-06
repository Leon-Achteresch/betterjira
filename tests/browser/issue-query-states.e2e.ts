import { expect, test, type Page, type TestInfo } from "@playwright/test";

type SearchRule = { delayMs?: number; status?: number; keys?: string[]; nextPageToken?: string };

declare global {
  interface Window {
    __qaSearchRule?: (jql: string, pageToken: string | null) => SearchRule;
    __qaCopied: string[];
    __qa: { searches: string[] };
  }
}

const TABLE = "/tests/browser/fixture.html?route=/bereiche/DEMO";

const row = (page: Page, key: string) => page.getByRole("cell", { name: key, exact: true });
const rowBox = (page: Page, key: string) => page.getByRole("checkbox", { name: `${key} auswählen` });
const pending = (page: Page) => page.getByRole("status").filter({ hasText: "geänderte Abfrage" });
const warning = (page: Page, text: string) => page.getByRole("alert").filter({ hasText: text });
const loadMore = (page: Page) => page.getByRole("button", { name: /^Weitere laden/ });
const pick = (page: Page, name: string) => page.getByRole("menuitem", { name, exact: true }).press("Enter");
const copied = (page: Page) => page.evaluate(() => window.__qaCopied.at(-1));

const setRule = (page: Page, source: string) =>
  page.evaluate((body) => {
    window.__qaSearchRule = new Function("jql", "token", body) as Window["__qaSearchRule"];
  }, source);

const search = async (page: Page, text: string) => {
  await page.getByRole("searchbox", { name: "Volltextsuche" }).fill(text);
  await expect
    .poll(() => page.evaluate((term) => window.__qa.searches.some((jql) => jql.includes(term)), text))
    .toBe(true);
};

const openExport = async (page: Page) => {
  await page.getByRole("button", { name: "Ansicht und Export" }).click();
  await page.getByRole("menuitem", { name: "Kopieren als" }).click();
};

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  const dir = process.env.ISSUE_QUERY_SHOTS;
  if (dir) await page.screenshot({ path: `${dir}/${testInfo.project.name}-${name}.png` });
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.addInitScript(() => {
    window.__qaCopied = [];
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: async (text: string) => void window.__qaCopied.push(text) },
    });
  });
});

test("Platzhalter einer neuen Abfrage sperrt Auswahl, Export und Weiterladen", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    window.__qaSearchRule = (jql) =>
      jql.includes("alpha") ? { delayMs: 4000, keys: ["DEMO-2"] } : { keys: ["DEMO-1", "DEMO-3"], nextPageToken: "p2" };
  });
  await page.goto(TABLE);
  await expect(row(page, "DEMO-3")).toBeVisible();
  await expect(loadMore(page)).toBeEnabled();

  await search(page, "alpha");
  await expect(pending(page)).toBeVisible();
  await expect(row(page, "DEMO-1")).toBeVisible();
  await expect(rowBox(page, "DEMO-1")).toBeDisabled();
  await expect(page.getByRole("checkbox", { name: "Alle geladenen Vorgänge auswählen" })).toBeDisabled();
  await expect(loadMore(page)).toHaveCount(0);
  await shot(page, testInfo, "platzhalter");
  await openExport(page);
  await expect(page.getByRole("menuitem", { name: "Schlüsselliste" })).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("menuitem", { name: /^Tabelle/ })).toHaveAttribute("aria-disabled", "true");
  await pick(page, "JQL");
  expect(await copied(page)).toContain('text ~ "alpha*"');

  await expect(pending(page)).toHaveCount(0);
  await expect(row(page, "DEMO-2")).toBeVisible();
  await expect(row(page, "DEMO-1")).toHaveCount(0);
  await rowBox(page, "DEMO-2").click();
  await page.getByRole("region", { name: "Ausgewählte Vorgänge" }).getByRole("button", { name: "Schlüssel" }).click();
  expect(await copied(page)).toBe("DEMO-2");
});

test("Schneller Wechsel zeigt nie Treffer einer überholten Abfrage", async ({ page }) => {
  await page.goto(TABLE);
  await expect(row(page, "DEMO-3")).toBeVisible();
  await setRule(
    page,
    `if (jql.includes("beta")) return { delayMs: 3000, keys: ["DEMO-2"] };
     if (jql.includes("gamma")) return { delayMs: 300, keys: ["DEMO-3"] };
     return {};`,
  );

  await search(page, "beta");
  await expect(pending(page)).toBeVisible();
  await search(page, "gamma");
  await expect(pending(page)).toHaveCount(0);
  await expect(row(page, "DEMO-3")).toBeVisible();
  await page.waitForTimeout(3000);
  await expect(row(page, "DEMO-2")).toHaveCount(0);
  await expect(row(page, "DEMO-1")).toHaveCount(0);
  await openExport(page);
  await pick(page, "Schlüsselliste");
  expect(await copied(page)).toBe("DEMO-3");
});

test("Fehlgeschlagene Aktualisierung behält den zuletzt geladenen Stand", async ({ page }, testInfo) => {
  await page.goto(TABLE);
  await expect(row(page, "DEMO-3")).toBeVisible();
  await setRule(page, `return { status: 503 };`);

  await page.getByRole("button", { name: "Aktualisieren" }).click();
  const notice = warning(page, "zuletzt geladene Stand");
  await expect(notice).toContainText("Test: Jira antwortet mit 503");
  await expect(row(page, "DEMO-1")).toBeVisible();
  await expect(rowBox(page, "DEMO-1")).toBeEnabled();
  await shot(page, testInfo, "aktualisierung");

  await setRule(page, `return { keys: ["DEMO-1"] };`);
  await notice.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(notice).toHaveCount(0);
  await expect(row(page, "DEMO-3")).toHaveCount(0);
  await expect(row(page, "DEMO-1")).toBeVisible();
});

test("Erster Ladefehler zeigt den Fehler ohne Tabelle und Retry lädt", async ({ page }) => {
  await page.addInitScript(() => {
    window.__qaSearchRule = () => ({ status: 503 });
  });
  await page.goto(TABLE);
  const error = page.getByRole("alert").filter({ hasText: "Test: Jira antwortet mit 503" });
  await expect(error).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);

  await page.evaluate(() => {
    window.__qaSearchRule = undefined;
  });
  await error.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(row(page, "DEMO-3")).toBeVisible();
  await expect(error).toHaveCount(0);
});

test("Fehler beim Weiterladen verdrängt die geladenen Seiten nicht", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    window.__qaSearchRule = (_, token) =>
      token ? { status: 503 } : { keys: ["DEMO-1", "DEMO-2"], nextPageToken: "p2" };
  });
  await page.goto(TABLE);
  await expect(row(page, "DEMO-2")).toBeVisible();

  await loadMore(page).click();
  const notice = warning(page, "Weitere Vorgänge konnten nicht geladen werden");
  await expect(notice).toContainText("Test: Jira antwortet mit 503");
  await expect(row(page, "DEMO-1")).toBeVisible();
  await expect(row(page, "DEMO-2")).toBeVisible();
  await expect(row(page, "DEMO-3")).toHaveCount(0);
  await shot(page, testInfo, "weiterladen");

  await setRule(page, `return token ? { keys: ["DEMO-3"] } : { keys: ["DEMO-1", "DEMO-2"], nextPageToken: "p2" };`);
  await notice.getByRole("button", { name: "Erneut laden" }).click();
  await expect(row(page, "DEMO-3")).toBeVisible();
  await expect(notice).toHaveCount(0);
  await openExport(page);
  await pick(page, "Schlüsselliste");
  expect(await copied(page)).toBe("DEMO-1, DEMO-2, DEMO-3");
});
