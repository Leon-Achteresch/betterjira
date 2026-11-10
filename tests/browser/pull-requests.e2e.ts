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

type SettledLayout = {
  loaded: boolean;
  family: string;
  overflow: number;
  dark: boolean;
  triggerHeight: number;
  triggerRight: number;
  overlaps: number;
};

const settledLayout = (page: Page, trigger: string) =>
  page.evaluate(async (selector): Promise<SettledLayout> => {
    await document.fonts.load('600 24px "Geist Variable"');
    await document.fonts.ready;
    const finite = document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity);
    await Promise.all(finite.map((animation) => animation.finished.catch(() => undefined)));
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    const contentBox = () => JSON.stringify((document.querySelector('[role="list"]') ?? document.querySelector("main"))?.getBoundingClientRect());
    let before = contentBox();
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await frame();
      await frame();
      const after = contentBox();
      if (after === before) break;
      before = after;
    }
    const box = document.querySelector(selector)?.getBoundingClientRect();
    const controls = [...document.querySelectorAll('main [data-slot="select-trigger"], main [data-slot="input-group"], main [aria-label="Aktualisieren"]')].map((element) =>
      element.getBoundingClientRect(),
    );
    const overlaps = controls.reduce(
      (count, a, index) =>
        count +
        controls
          .slice(index + 1)
          .filter((b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5).length,
      0,
    );
    return {
      loaded: [...document.fonts].some((face) => face.family.includes("Geist") && face.status === "loaded"),
      family: getComputedStyle(document.querySelector("main h1") ?? document.body).fontFamily,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      dark: document.documentElement.classList.contains("dark"),
      triggerHeight: box?.height ?? 0,
      triggerRight: box?.right ?? Number.POSITIVE_INFINITY,
      overlaps,
    };
  }, trigger);

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
  await expect(page.getByText(/die 25 zuletzt aktualisierten Pull Requests geladen; Suche, Prüfstatus und Sortierung gelten nur für diese/)).toBeVisible();
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
  const state = await settledLayout(page, '[aria-label="Sortieren"]');
  expect(state.loaded).toBe(true);
  expect(state.family).toContain("Geist");
  expect(state.overflow).toBeLessThanOrEqual(0);
  expect(state.dark).toBe(narrow);
  expect(state.triggerHeight).toBeGreaterThanOrEqual(32);
  expect(state.triggerRight).toBeLessThanOrEqual(narrow ? 390 : 1440);
  expect(state.overlaps).toBe(0);
  await page.mouse.move(0, 0);
  await shot(page, testInfo, "sortiert-repository");
});

const checksBox = (page: Page) => page.getByRole("combobox", { name: "Prüfstatus filtern" });

const chooseChecks = async (page: Page, name: string) => {
  await checksBox(page).click();
  await page.getByRole("option", { name, exact: true }).click();
  await expect(checksBox(page)).toContainText(name);
};

const scmStore = (page: Page) => page.evaluate(() => localStorage.getItem("betterjira-scm"));

const resetChecks = (page: Page) => page.getByRole("button", { name: "Prüfstatus zurücksetzen" });

const DESIGN_SYSTEM = /repo=gh%3Agithub\.com%3A%3Aqa%2Fdesign-system/;

const CHECKS_OPEN = [
  "DEMO-1 Suche für den Arbeitsalltag vereinfachen",
  "DEMO-2 Schnittstelle für Kommentare",
  "Tooltip-Abstände vereinheitlichen",
  "Icons ohne Prüfdaten",
  "DEMO-2 Tastaturbedienung im Editor verbessern",
  "Fokusrahmen schärfen",
  "Changelog ergänzen",
];

const CHECKS_UNKNOWN = ["Icons ohne Prüfdaten", "Fokusrahmen schärfen", "Changelog ergänzen"];

test("Prüfstatus filtert nur geladene Pull Requests mit eigenem Verlaufseintrag", async ({ page }) => {
  await open(page, "/pull-requests", "scm-checks");
  await expect(titles(page)).toHaveText(CHECKS_OPEN);
  await expect(checksBox(page)).toContainText("Alle Prüfstatus");
  const reads = await scmReads(page);
  const store = await scmStore(page);

  await chooseChecks(page, "Fehlgeschlagen");
  await expect(page).toHaveURL(/\/pull-requests\?checks=failure$/);
  await expect(titles(page)).toHaveText(["DEMO-2 Tastaturbedienung im Editor verbessern"]);
  await expect(page.getByText("1 Pull Request", { exact: false })).toBeVisible();

  await chooseChecks(page, "Ausstehend");
  await expect(page).toHaveURL(/checks=pending/);
  await expect(titles(page)).toHaveText(["DEMO-2 Schnittstelle für Kommentare"]);

  await chooseChecks(page, "Erfolgreich");
  await expect(page).toHaveURL(/checks=success/);
  await expect(titles(page)).toHaveText(["DEMO-1 Suche für den Arbeitsalltag vereinfachen", "Tooltip-Abstände vereinheitlichen"]);

  await chooseChecks(page, "Keine Angabe");
  await expect(page).toHaveURL(/checks=unknown/);
  await expect(titles(page)).toHaveText(CHECKS_UNKNOWN);
  await expect(list(page).getByLabel(/^Checks /)).toHaveCount(0);

  await chooseChecks(page, "Alle Prüfstatus");
  await expect(page).not.toHaveURL(/checks=/);
  await expect(titles(page)).toHaveText(CHECKS_OPEN);
  expect(await scmReads(page)).toBe(reads);

  await page.goBack();
  await expect(page).toHaveURL(/checks=unknown/);
  await expect(checksBox(page)).toContainText("Keine Angabe");
  await expect(titles(page)).toHaveText(CHECKS_UNKNOWN);
  await page.goBack();
  await expect(page).toHaveURL(/checks=success/);
  await page.goBack();
  await expect(page).toHaveURL(/checks=pending/);
  await page.goBack();
  await expect(page).toHaveURL(/checks=failure/);
  await expect(titles(page)).toHaveText(["DEMO-2 Tastaturbedienung im Editor verbessern"]);
  await page.goBack();
  await expect(page).not.toHaveURL(/checks=/);
  await expect(titles(page)).toHaveText(CHECKS_OPEN);
  await page.goForward();
  await expect(page).toHaveURL(/checks=failure/);
  await expect(checksBox(page)).toContainText("Fehlgeschlagen");
  await expect(titles(page)).toHaveText(["DEMO-2 Tastaturbedienung im Editor verbessern"]);
  expect(await scmReads(page)).toBe(reads);
  expect(await scmStore(page)).toBe(store);

  await titles(page).first().click();
  await expect.poll(() => page.evaluate(() => window.__qaScm.opened)).toEqual(["https://github.com/qa/web-app/pull/39"]);
});

test("Prüfstatus kombiniert Status, Repository, Suche und Sortierung und trennt die Leerzustände", async ({ page }) => {
  await open(page, "/pull-requests?checks=success&sort=title", "scm-checks");
  await expect(checksBox(page)).toContainText("Erfolgreich");
  await expect(sortBox(page)).toContainText("Titel A–Z");
  await expect(titles(page)).toHaveText(["DEMO-1 Suche für den Arbeitsalltag vereinfachen", "Tooltip-Abstände vereinheitlichen"]);

  await page.getByRole("combobox", { name: "Repository filtern" }).click();
  await page.getByRole("option", { name: "qa/design-system" }).click();
  await expect(page).toHaveURL(DESIGN_SYSTEM);
  await expect(page).toHaveURL(/checks=success/);
  await expect(page).toHaveURL(/sort=title/);
  await expect(titles(page)).toHaveText(["Tooltip-Abstände vereinheitlichen"]);

  const search = page.getByRole("textbox", { name: "Pull Requests durchsuchen" });
  await search.fill("farb");
  await expect(page).toHaveURL(/q=farb/);
  await expect(page.getByText("Keine Treffer für „farb“")).toBeVisible();
  await expect(resetChecks(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Suche leeren" }).click();
  await expect(page).not.toHaveURL(/q=/);

  const reads = await scmReads(page);
  await chooseChecks(page, "Fehlgeschlagen");
  await expect(page.getByText("Keine Pull Requests mit Prüfstatus „Fehlgeschlagen“")).toBeVisible();
  await expect(page.getByText("Der Prüfstatus-Filter gilt nur für die geladenen Pull Requests.")).toBeVisible();
  await expect(page.getByText(/Keine Treffer|mit Status „Offen“/)).toHaveCount(0);
  await resetChecks(page).click();
  await expect(page).not.toHaveURL(/checks=/);
  await expect(page).toHaveURL(DESIGN_SYSTEM);
  await expect(page).toHaveURL(/sort=title/);
  await expect(titles(page)).toHaveText(["Changelog ergänzen", "Fokusrahmen schärfen", "Icons ohne Prüfdaten", "Tooltip-Abstände vereinheitlichen"]);
  await page.goBack();
  await expect(page).toHaveURL(/checks=failure/);
  await expect(resetChecks(page)).toBeVisible();
  await page.goForward();
  await expect(page).not.toHaveURL(/checks=/);
  expect(await scmReads(page)).toBe(reads);

  await chooseChecks(page, "Keine Angabe");
  await expect(titles(page)).toHaveText(["Changelog ergänzen", "Fokusrahmen schärfen", "Icons ohne Prüfdaten"]);
  await tab(page, "Gemergt").click();
  await expect(page).toHaveURL(/status=merged/);
  await expect(page).toHaveURL(/checks=unknown/);
  await expect(titles(page)).toHaveText(["Farbtokens für Dark Mode"]);
  await tab(page, "Geschlossen").click();
  await expect(page.getByText("Keine Pull Requests mit Status „Geschlossen“")).toBeVisible();
  await expect(resetChecks(page)).toHaveCount(0);
  await expect(checksBox(page)).toContainText("Keine Angabe");
});

test("Ungültiger oder Standard-Prüfstatus in der URL zeigt alle Pull Requests", async ({ page }) => {
  await open(page, "/pull-requests?checks=zufall", "scm-checks");
  await expect(titles(page)).toHaveText(CHECKS_OPEN);
  await expect(checksBox(page)).toContainText("Alle Prüfstatus");
  await chooseChecks(page, "Erfolgreich");
  await expect(page).toHaveURL(/checks=success/);
  await expect(page).not.toHaveURL(/zufall/);

  await open(page, "/pull-requests?checks=all&sort=updated-asc", "scm-checks");
  await expect(checksBox(page)).toContainText("Alle Prüfstatus");
  await expect(titles(page)).toHaveText([...CHECKS_OPEN].reverse());
});

test("Teilfehler und Grenzhinweis bleiben beim Prüfstatus sichtbar", async ({ page }, testInfo) => {
  await open(page, "/pull-requests?checks=pending", "scm-partial");
  const alerts = page.getByRole("alert");
  await expect(alerts.filter({ hasText: "qa-team/api" })).toContainText("Test: Bitbucket antwortet nicht");
  await expect(alerts.filter({ hasText: "qa/archiv" })).toContainText("Verbindung nicht verfügbar");
  await expect(page.getByText("Keine Pull Requests mit Prüfstatus „Ausstehend“")).toBeVisible();
  await expect(
    page.getByText("Einige Repositories konnten nicht geladen werden. Der Prüfstatus-Filter gilt nur für die geladenen Pull Requests."),
  ).toBeVisible();
  await expect(page.getByText(/Suche, Prüfstatus und Sortierung gelten nur für diese/)).toBeVisible();
  await shot(page, testInfo, "pruefstatus-teilfehler");

  await page.evaluate(() => {
    window.__qaScm.failRepos = [];
  });
  await alerts.filter({ hasText: "qa-team/api" }).getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(alerts.filter({ hasText: "qa-team/api" })).toHaveCount(0);
  await expect(titles(page)).toHaveText(["DEMO-2 Schnittstelle für Kommentare"]);
  await expect(page).toHaveURL(/checks=pending/);
  await expect(alerts.filter({ hasText: "qa/archiv" })).toBeVisible();
  await expect(page.getByText(/Suche, Prüfstatus und Sortierung gelten nur für diese/)).toBeVisible();
});

test("Prüfstatus und Zurücksetzen funktionieren per Tastatur", async ({ page }) => {
  await open(page, "/pull-requests?checks=failure", "scm-checks");
  await expect(titles(page)).toHaveText(["DEMO-2 Tastaturbedienung im Editor verbessern"]);
  await checksBox(page).focus();
  await expect(checksBox(page)).toBeFocused();
  await page.keyboard.press("Enter");
  const current = page.getByRole("option", { name: "Fehlgeschlagen", exact: true });
  await expect(current).toBeFocused();
  await expect(current).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("option", { name: "Ausstehend", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(page).toHaveURL(/checks=pending/);
  await expect(checksBox(page)).toBeFocused();
  await expect(titles(page)).toHaveText(["DEMO-2 Schnittstelle für Kommentare"]);

  await open(page, "/pull-requests?checks=failure&repo=gh%3Agithub.com%3A%3Aqa%2Fdesign-system", "scm-checks");
  await expect(resetChecks(page)).toBeVisible();
  await resetChecks(page).focus();
  await expect(resetChecks(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).not.toHaveURL(/checks=/);
  await expect(page).toHaveURL(DESIGN_SYSTEM);
  await expect(titles(page)).toHaveCount(4);
});

test("Prüfstatus: Desktop hell und 390 px dunkel ohne Überdeckung", async ({ page }, testInfo) => {
  const narrow = testInfo.project.name !== "desktop";
  if (narrow) await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: narrow ? "dark" : "light" });
  await open(page, "/pull-requests?checks=unknown", "scm-checks");
  await expect(page.getByRole("heading", { name: "Pull Requests", exact: true })).toBeVisible();
  await expect(titles(page)).toHaveText(CHECKS_UNKNOWN);
  await expect(checksBox(page)).toContainText("Keine Angabe");
  const listed = await settledLayout(page, '[aria-label="Prüfstatus filtern"]');
  expect(listed.loaded).toBe(true);
  expect(listed.family).toContain("Geist");
  expect(listed.overflow).toBeLessThanOrEqual(0);
  expect(listed.dark).toBe(narrow);
  expect(listed.triggerHeight).toBeGreaterThanOrEqual(32);
  expect(listed.triggerRight).toBeLessThanOrEqual(narrow ? 390 : 1440);
  expect(listed.overlaps).toBe(0);
  await page.mouse.move(0, 0);
  await shot(page, testInfo, "pruefstatus-keine-angabe");

  await chooseChecks(page, "Fehlgeschlagen");
  await page.getByRole("combobox", { name: "Repository filtern" }).click();
  await page.getByRole("option", { name: "qa/design-system" }).click();
  await expect(resetChecks(page)).toBeVisible();
  const empty = await settledLayout(page, '[aria-label="Prüfstatus filtern"]');
  expect(empty.overflow).toBeLessThanOrEqual(0);
  expect(empty.overlaps).toBe(0);
  expect((await resetChecks(page).boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(32);
  await page.mouse.move(0, 0);
  await shot(page, testInfo, "pruefstatus-leer");
});
