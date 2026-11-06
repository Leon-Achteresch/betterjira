import { expect, test, type Page, type TestInfo } from "@playwright/test";

declare global {
  interface Window {
    __qaScm: { failRepos: string[]; delayMs: number; requests: string[]; opened: string[] };
  }
}

const open = (page: Page, route: string, scenario = "scm") =>
  page.goto(`/tests/browser/fixture.html?${new URLSearchParams({ route, scenario })}`);

const list = (page: Page) => page.getByRole("list").filter({ has: page.getByRole("listitem") });

const titles = (page: Page) => list(page).getByRole("listitem").locator("span.truncate.text-sm");

const tab = (page: Page, name: string) => page.getByRole("navigation", { name: "Pull-Request-Status" }).getByRole("link", { name, exact: true });

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  const dir = process.env.PULL_REQUEST_SHOTS;
  if (dir) await page.screenshot({ path: `${dir}/${testInfo.project.name}-${name}.png` });
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("listet offene Pull Requests aller verknüpften Repositories ohne doppelte Abfragen", async ({ page }, testInfo) => {
  await open(page, "/pull-requests");
  await expect(page.getByRole("heading", { name: "Pull Requests", exact: true })).toBeVisible();
  await expect(tab(page, "Offen")).toHaveAttribute("aria-current", "page");
  await expect(titles(page)).toHaveText([
    "DEMO-1 Suche für den Arbeitsalltag vereinfachen",
    "DEMO-2 Schnittstelle für Kommentare",
    "Tooltip-Abstände vereinheitlichen",
    "DEMO-2 Tastaturbedienung im Editor verbessern",
  ]);
  await expect(page.getByText("4 Pull Requests", { exact: false })).toBeVisible();
  await expect(page.getByText(/die 25 zuletzt aktualisierten Pull Requests/)).toBeVisible();
  await shot(page, testInfo, "offen");

  const graphRequests = await page.evaluate(() => window.__qaScm.requests.filter((url) => url.includes("graphql")).length);
  expect(graphRequests).toBe(2);

  await tab(page, "Entwurf").click();
  await expect(page).toHaveURL(/\/pull-requests\?status=draft$/);
  await expect(titles(page)).toHaveText(["DEMO-3 Übergabe an das Team vorbereiten"]);
  expect(await page.evaluate(() => window.__qaScm.requests.filter((url) => url.includes("graphql")).length)).toBe(graphRequests);

  await titles(page).first().click();
  await expect.poll(() => page.evaluate(() => window.__qaScm.opened)).toEqual(["https://github.com/qa/web-app/pull/44"]);
});

test("Status, Suche und Repository-Filter stehen in der URL", async ({ page }, testInfo) => {
  await open(page, "/pull-requests?status=merged");
  await expect(tab(page, "Gemergt")).toHaveAttribute("aria-current", "page");
  await expect(titles(page)).toHaveText(["DEMO-1 Filter in der Seitenleiste", "Farbtokens für Dark Mode", "Abhängigkeiten aktualisieren"]);

  await page.getByRole("textbox", { name: "Pull Requests durchsuchen" }).fill("farb");
  await expect(page).toHaveURL(/q=farb/);
  await expect(titles(page)).toHaveText(["Farbtokens für Dark Mode"]);
  await page.getByRole("button", { name: "Suche leeren" }).click();
  await expect(page).not.toHaveURL(/q=/);

  await page.getByRole("combobox", { name: "Repository filtern" }).click();
  await page.getByRole("option", { name: "qa/web-app" }).click();
  await expect(page).toHaveURL(/repo=gh%3Agithub\.com%3A%3Aqa%2Fweb-app/);
  await expect(titles(page)).toHaveText(["DEMO-1 Filter in der Seitenleiste", "Abhängigkeiten aktualisieren"]);

  await tab(page, "Geschlossen").click();
  await expect(page).toHaveURL(/status=closed/);
  await expect(page).toHaveURL(/repo=/);
  await expect(titles(page)).toHaveText(["Experiment: neue Navigation"]);

  await page.getByRole("textbox", { name: "Pull Requests durchsuchen" }).fill("niemand");
  await expect(page.getByText("Keine Treffer für „niemand“")).toBeVisible();
  await shot(page, testInfo, "leer");
});

test("Teilfehler je Repository bleiben sichtbar und lassen sich einzeln wiederholen", async ({ page }, testInfo) => {
  await open(page, "/pull-requests", "scm-partial");
  const alerts = page.getByRole("alert");
  await expect(alerts.filter({ hasText: "qa-team/api" })).toContainText("Test: Bitbucket antwortet nicht");
  await expect(alerts.filter({ hasText: "qa/archiv" })).toContainText("Verbindung nicht verfügbar");
  await expect(titles(page)).toHaveText([
    "DEMO-1 Suche für den Arbeitsalltag vereinfachen",
    "Tooltip-Abstände vereinheitlichen",
    "DEMO-2 Tastaturbedienung im Editor verbessern",
  ]);
  await shot(page, testInfo, "teilfehler");

  await page.evaluate(() => {
    window.__qaScm.failRepos = [];
  });
  await alerts.filter({ hasText: "qa-team/api" }).getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(alerts.filter({ hasText: "qa-team/api" })).toHaveCount(0);
  await expect(titles(page)).toContainText(["DEMO-2 Schnittstelle für Kommentare"]);
  await expect(alerts.filter({ hasText: "qa/archiv" })).toBeVisible();
});

test("Lädt mit Skeleton und aktualisiert auf Wunsch", async ({ page }) => {
  await open(page, "/pull-requests", "scm-slow");
  await expect(page.locator("[aria-busy]").first()).toBeVisible();
  await expect(titles(page)).toHaveCount(4);
  const before = await page.evaluate(() => window.__qaScm.requests.length);
  await page.getByRole("button", { name: "Aktualisieren" }).click();
  await expect.poll(() => page.evaluate(() => window.__qaScm.requests.length)).toBeGreaterThan(before);
  await expect(titles(page)).toHaveCount(4);
});

test("Ein fehlgeschlagener Refresh behält die Pull Requests und zeigt den Repository-Fehler", async ({ page }) => {
  await open(page, "/pull-requests");
  await expect(titles(page)).toHaveCount(4);
  await page.evaluate(() => {
    window.__qaScm.failRepos = ["qa-team/api"];
  });
  await page.getByRole("button", { name: "Aktualisieren" }).click();
  const notice = page.getByRole("alert").filter({ hasText: "qa-team/api" });
  await expect(notice).toContainText("Test: Bitbucket antwortet nicht");
  await expect(titles(page)).toHaveCount(4);

  await page.evaluate(() => {
    window.__qaScm.failRepos = [];
  });
  await notice.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(notice).toHaveCount(0);
  await expect(titles(page)).toHaveCount(4);
});

test("Ohne Code-Hosting erklärt die Seite die Einrichtung", async ({ page }, testInfo) => {
  await open(page, "/pull-requests", "scm-empty");
  await expect(page.getByText("Kein Code-Hosting verbunden")).toBeVisible();
  await shot(page, testInfo, "einrichten");
  await page.getByRole("link", { name: "Code-Hosting einrichten" }).click();
  await expect(page).toHaveURL(/\/settings\/code-hosting$/);
});

test("Funktioniert ohne Jira-Anmeldung mit gültigem SCM-Konto", async ({ page }) => {
  await open(page, "/pull-requests", "scm-offline");
  await expect(titles(page)).toHaveCount(4);
  await expect(page.getByText("Kein Code-Hosting verbunden")).toHaveCount(0);
});
