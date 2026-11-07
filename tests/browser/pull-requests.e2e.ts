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

const sortBox = (page: Page) => page.getByRole("combobox", { name: "Sortieren" });

const chooseSort = async (page: Page, name: string) => {
  await sortBox(page).click();
  await page.getByRole("option", { name, exact: true }).click();
  await expect(sortBox(page)).toContainText(name);
};

const scmReads = (page: Page) => page.evaluate(() => window.__qaScm.requests.length);

const OPEN_BY_UPDATE = [
  "DEMO-1 Suche für den Arbeitsalltag vereinfachen",
  "DEMO-2 Schnittstelle für Kommentare",
  "Tooltip-Abstände vereinheitlichen",
  "DEMO-2 Tastaturbedienung im Editor verbessern",
];

const OPEN_BY_TITLE = [
  "DEMO-1 Suche für den Arbeitsalltag vereinfachen",
  "DEMO-2 Schnittstelle für Kommentare",
  "DEMO-2 Tastaturbedienung im Editor verbessern",
  "Tooltip-Abstände vereinheitlichen",
];

test("Sortierung ordnet nur geladene Pull Requests und steht mit eigenem Verlaufseintrag in der URL", async ({ page }) => {
  await open(page, "/pull-requests");
  await expect(titles(page)).toHaveText(OPEN_BY_UPDATE);
  await expect(sortBox(page)).toContainText("Zuletzt aktualisiert");
  await expect(page.getByText("4 Pull Requests", { exact: false })).toBeVisible();
  const reads = await scmReads(page);

  await chooseSort(page, "Titel A–Z");
  await expect(page).toHaveURL(/\/pull-requests\?sort=title$/);
  await expect(titles(page)).toHaveText(OPEN_BY_TITLE);

  await chooseSort(page, "Älteste Aktualisierung zuerst");
  await expect(page).toHaveURL(/sort=updated-asc/);
  await expect(titles(page)).toHaveText([...OPEN_BY_UPDATE].reverse());

  await chooseSort(page, "Repository");
  await expect(page).toHaveURL(/sort=repo/);
  await expect(titles(page)).toHaveText([
    "DEMO-2 Schnittstelle für Kommentare",
    "Tooltip-Abstände vereinheitlichen",
    "DEMO-1 Suche für den Arbeitsalltag vereinfachen",
    "DEMO-2 Tastaturbedienung im Editor verbessern",
  ]);

  await chooseSort(page, "Zuletzt aktualisiert");
  await expect(page).not.toHaveURL(/sort=/);
  await expect(titles(page)).toHaveText(OPEN_BY_UPDATE);
  expect(await scmReads(page)).toBe(reads);

  await page.goBack();
  await expect(page).toHaveURL(/sort=repo/);
  await expect(sortBox(page)).toContainText("Repository");
  await page.goBack();
  await expect(page).toHaveURL(/sort=updated-asc/);
  await expect(titles(page)).toHaveText([...OPEN_BY_UPDATE].reverse());
  await page.goBack();
  await expect(page).toHaveURL(/sort=title/);
  await page.goBack();
  await expect(page).not.toHaveURL(/sort=/);
  await expect(titles(page)).toHaveText(OPEN_BY_UPDATE);
  await page.goForward();
  await expect(page).toHaveURL(/sort=title/);
  await expect(titles(page)).toHaveText(OPEN_BY_TITLE);
  expect(await scmReads(page)).toBe(reads);

  await titles(page).nth(2).click();
  await expect.poll(() => page.evaluate(() => window.__qaScm.opened)).toEqual(["https://github.com/qa/web-app/pull/39"]);
});

test("Suche ersetzt den Verlaufseintrag, Status und Repository behalten die Sortierung", async ({ page }) => {
  await open(page, "/pull-requests");
  await expect(titles(page)).toHaveCount(4);
  await chooseSort(page, "Älteste Aktualisierung zuerst");
  await expect(page).toHaveURL(/sort=updated-asc/);

  const search = page.getByRole("textbox", { name: "Pull Requests durchsuchen" });
  await search.fill("demo-2");
  await expect(page).toHaveURL(/q=demo-2/);
  await expect(page).toHaveURL(/sort=updated-asc/);
  await expect(titles(page)).toHaveText(["DEMO-2 Tastaturbedienung im Editor verbessern", "DEMO-2 Schnittstelle für Kommentare"]);

  await page.goBack();
  await expect(page).not.toHaveURL(/sort=|q=/);
  await expect(titles(page)).toHaveText(OPEN_BY_UPDATE);
  await page.goForward();
  await expect(page).toHaveURL(/q=demo-2/);
  await expect(search).toHaveValue("demo-2");
  await page.getByRole("button", { name: "Suche leeren" }).click();
  await expect(page).not.toHaveURL(/q=/);
  await expect(page).toHaveURL(/sort=updated-asc/);

  await chooseSort(page, "Titel A–Z");
  await tab(page, "Gemergt").click();
  await expect(page).toHaveURL(/status=merged/);
  await expect(page).toHaveURL(/sort=title/);
  await expect(titles(page)).toHaveText(["Abhängigkeiten aktualisieren", "DEMO-1 Filter in der Seitenleiste", "Farbtokens für Dark Mode"]);

  await page.getByRole("combobox", { name: "Repository filtern" }).click();
  await page.getByRole("option", { name: "qa/web-app" }).click();
  await expect(page).toHaveURL(/repo=gh%3Agithub\.com%3A%3Aqa%2Fweb-app/);
  await expect(page).toHaveURL(/sort=title/);
  await expect(titles(page)).toHaveText(["Abhängigkeiten aktualisieren", "DEMO-1 Filter in der Seitenleiste"]);
  await expect(sortBox(page)).toContainText("Titel A–Z");
});

test("Ungültige Sortierung in der URL fällt auf den Standard zurück", async ({ page }) => {
  await open(page, "/pull-requests?sort=zufall");
  await expect(titles(page)).toHaveText(OPEN_BY_UPDATE);
  await expect(sortBox(page)).toContainText("Zuletzt aktualisiert");
  await chooseSort(page, "Titel A–Z");
  await expect(page).toHaveURL(/sort=title/);
  await expect(page).not.toHaveURL(/zufall/);
  await expect(titles(page)).toHaveText(OPEN_BY_TITLE);
});

test("Sortierung lässt sich vollständig per Tastatur wählen", async ({ page }) => {
  await open(page, "/pull-requests?sort=title");
  await expect(titles(page)).toHaveText(OPEN_BY_TITLE);
  await sortBox(page).focus();
  await expect(sortBox(page)).toBeFocused();
  await page.keyboard.press("Enter");
  const current = page.getByRole("option", { name: "Titel A–Z", exact: true });
  await expect(current).toBeFocused();
  await expect(current).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowUp");
  const target = page.getByRole("option", { name: "Älteste Aktualisierung zuerst", exact: true });
  await expect(target).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(page).toHaveURL(/sort=updated-asc/);
  await expect(sortBox(page)).toBeFocused();
  await expect(titles(page)).toHaveText([...OPEN_BY_UPDATE].reverse());

  await page.keyboard.press("Enter");
  await expect(page.getByRole("option", { name: "Älteste Aktualisierung zuerst", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(page).toHaveURL(/sort=updated-asc/);
});

test("Teilfehler, Grenzhinweis und fehlgeschlagener Refresh bleiben bei Sortierung ehrlich", async ({ page }, testInfo) => {
  await open(page, "/pull-requests?sort=title", "scm-partial");
  const alerts = page.getByRole("alert");
  await expect(alerts.filter({ hasText: "qa-team/api" })).toContainText("Test: Bitbucket antwortet nicht");
  await expect(alerts.filter({ hasText: "qa/archiv" })).toContainText("Verbindung nicht verfügbar");
  await expect(titles(page)).toHaveText([
    "DEMO-1 Suche für den Arbeitsalltag vereinfachen",
    "DEMO-2 Tastaturbedienung im Editor verbessern",
    "Tooltip-Abstände vereinheitlichen",
  ]);
  await expect(page.getByText(/die 25 zuletzt aktualisierten Pull Requests geladen; Suche und Sortierung gelten nur für diese/)).toBeVisible();
  await shot(page, testInfo, "sortiert-teilfehler");

  await page.evaluate(() => {
    window.__qaScm.failRepos = [];
  });
  await alerts.filter({ hasText: "qa-team/api" }).getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(alerts.filter({ hasText: "qa-team/api" })).toHaveCount(0);
  await expect(titles(page)).toHaveText(OPEN_BY_TITLE);
  await expect(page).toHaveURL(/sort=title/);

  await page.evaluate(() => {
    window.__qaScm.failRepos = ["qa-team/api"];
  });
  await page.getByRole("button", { name: "Aktualisieren" }).click();
  await expect(alerts.filter({ hasText: "qa-team/api" })).toContainText("Test: Bitbucket antwortet nicht");
  await expect(titles(page)).toHaveText(OPEN_BY_TITLE);
  await expect(alerts.filter({ hasText: "qa/archiv" })).toBeVisible();
});

test("Sortierung: Desktop hell und 390 px dunkel ohne Seitenüberlauf", async ({ page }, testInfo) => {
  const narrow = testInfo.project.name !== "desktop";
  if (narrow) await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: narrow ? "dark" : "light" });
  await open(page, "/pull-requests?sort=repo");
  await expect(page.getByRole("heading", { name: "Pull Requests", exact: true })).toBeVisible();
  await expect(titles(page)).toHaveCount(4);
  await expect(sortBox(page)).toContainText("Repository");
  const state = await page.evaluate(async () => {
    await document.fonts.load('600 24px "Geist Variable"');
    await document.fonts.ready;
    const finite = document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity);
    await Promise.all(finite.map((animation) => animation.finished.catch(() => undefined)));
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const listBox = () => JSON.stringify(document.querySelector('[role="list"]')?.getBoundingClientRect());
    let before = listBox();
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await frame();
      await frame();
      const after = listBox();
      if (after === before) break;
      before = after;
    }
    const trigger = document.querySelector('[aria-label="Sortieren"]')?.getBoundingClientRect();
    return {
      loaded: [...document.fonts].some((face) => face.family.includes("Geist") && face.status === "loaded"),
      family: getComputedStyle(document.querySelector("main h1") ?? document.body).fontFamily,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      dark: document.documentElement.classList.contains("dark"),
      triggerHeight: trigger?.height ?? 0,
      triggerRight: trigger?.right ?? Number.POSITIVE_INFINITY,
    };
  });
  expect(state.loaded).toBe(true);
  expect(state.family).toContain("Geist");
  expect(state.overflow).toBeLessThanOrEqual(0);
  expect(state.dark).toBe(narrow);
  expect(state.triggerHeight).toBeGreaterThanOrEqual(32);
  expect(state.triggerRight).toBeLessThanOrEqual(narrow ? 390 : 1440);
  await page.mouse.move(0, 0);
  await shot(page, testInfo, "sortiert-repository");
});
