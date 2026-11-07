import { expect, test, type Page, type TestInfo } from "@playwright/test";

type BoardRule = { delayMs?: number; status?: number };

declare global {
  interface Window {
    __qaBoardRule?: (path: string) => BoardRule;
    __qaBoardType?: string;
    __qa: {
      searches: string[];
      boardReads?: string[];
      sessionFailure: boolean;
      writes: { path: string }[];
    };
  }
}

const open = (page: Page, route: string, scenario = "board") =>
  page.goto(`/tests/browser/fixture.html?${new URLSearchParams({ route, scenario })}`);

const main = (page: Page) => page.getByRole("main");
const card = (page: Page) => page.getByRole("link", { name: "Datentabelle: Kopfmenü schwer auffindbar", exact: true });
const boardSkeleton = (page: Page) => page.getByLabel("Board wird geladen");
const login = (page: Page) => main(page).getByRole("button", { name: "Mit Atlassian verbinden" });
const showAll = (page: Page) => main(page).getByRole("button", { name: "Alle Vorgänge anzeigen" });
const alertWith = (page: Page, text: string) => main(page).getByRole("alert").filter({ hasText: text });

const setBoardRule = (page: Page, source: string) =>
  page.evaluate((body) => {
    window.__qaBoardRule = new Function("path", body) as Window["__qaBoardRule"];
  }, source);

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  const dir = process.env.AREA_RECOVERY_SHOTS;
  if (dir) await page.screenshot({ path: `${dir}/${testInfo.project.name}-${name}.png` });
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("Normales Board bleibt nutzbar: Karten, Filter, Insights und Verschieben", async ({ page }) => {
  await open(page, "/bereiche/DEMO?board=1");
  await expect(card(page)).toBeVisible();
  await expect(main(page).getByText("DEMO · Team-Board")).toBeVisible();
  await expect(main(page).getByRole("alert")).toHaveCount(0);

  const insights = main(page).getByRole("button", { name: "Insights", exact: true });
  await insights.click();
  await expect(insights).toHaveAttribute("aria-pressed", "true");
  await expect(main(page).getByRole("button", { name: "Insights schließen" })).toBeVisible();

  await main(page).getByRole("button", { name: "DEMO-1 in andere Spalte verschieben" }).click();
  await page.getByRole("menuitem", { name: "Review" }).click();
  await expect.poll(() => page.evaluate(() => window.__qa.writes.some((write) => write.path === "/issue/DEMO-1/transitions"))).toBe(true);
});

test("Sitzung: langsam zeigt Laden, abgemeldet die Anmeldung, Lesefehler Retry statt Logout", async ({ page }) => {
  await open(page, "/bereiche/DEMO?board=1", "session-slow");
  await expect(boardSkeleton(page)).toBeVisible();
  await expect(login(page)).toHaveCount(0);

  await open(page, "/bereiche/DEMO?board=1", "calendar-offline");
  await expect(login(page)).toBeVisible();
  await expect(page.getByText("Anmeldung konnte nicht geprüft werden")).toHaveCount(0);

  await open(page, "/bereiche/DEMO", "session-error");
  const sessionAlert = alertWith(page, "Anmeldung konnte nicht geprüft werden");
  await expect(sessionAlert).toBeVisible();
  await expect(login(page)).toHaveCount(0);
  await page.evaluate(() => {
    window.__qa.sessionFailure = false;
  });
  await sessionAlert.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(main(page).getByRole("cell", { name: "DEMO-1", exact: true })).toBeVisible();
  await expect(sessionAlert).toHaveCount(0);
});

test("Erster Fehler der Boardliste: Retry statt Endlos-Skeleton, bewusster Wechsel zu allen Vorgängen, Back/Forward", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    window.__qaBoardRule = (path) => (path === "/board" ? { status: 503 } : {});
  });
  await open(page, "/bereiche/DEMO?board=1");
  const failure = alertWith(page, "Boards konnten nicht geladen werden");
  await expect(failure).toBeVisible();
  await expect(failure).toContainText("Deine Anmeldung ist davon nicht betroffen");
  await expect(failure).toContainText("Test: Jira antwortet mit 503");
  await expect(boardSkeleton(page)).toHaveCount(0);
  await expect(login(page)).toHaveCount(0);
  await expect(page).toHaveURL(/board=1/);
  await shot(page, testInfo, "boards-fehler");

  await showAll(page).click();
  await expect(page).not.toHaveURL(/board=/);
  await expect(main(page).getByText("DEMO · Alle Vorgänge")).toBeVisible();
  await expect(main(page).getByRole("cell", { name: "DEMO-1", exact: true })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/board=1/);
  await expect(failure).toBeVisible();

  await setBoardRule(page, "return {};");
  await failure.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(card(page)).toBeVisible();
  await expect(failure).toHaveCount(0);

  await page.goForward();
  await expect(page).not.toHaveURL(/board=/);
  await expect(main(page).getByText("DEMO · Alle Vorgänge")).toBeVisible();
});

test("Fehlgeschlagene Aktualisierung behält Board und Karten und kennzeichnet den Stand", async ({ page }, testInfo) => {
  await page.clock.install();
  await open(page, "/bereiche/DEMO?board=1");
  await expect(card(page)).toBeVisible();

  await setBoardRule(page, 'return path === "/board" || path.endsWith("/configuration") ? { status: 503 } : {};');
  await page.clock.setSystemTime(Date.now() + 31_000);
  await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));

  const boards = alertWith(page, "Boards konnten nicht aktualisiert werden");
  const board = alertWith(page, "Board konnte nicht aktualisiert werden");
  await expect(boards).toContainText("Angezeigt wird der zuletzt geladene Stand.");
  await expect(board).toContainText("Test: Jira antwortet mit 503");
  await expect(card(page)).toBeVisible();
  await expect(main(page).getByText("DEMO · Team-Board")).toBeVisible();
  await shot(page, testInfo, "aktualisierung-fehlgeschlagen");

  await setBoardRule(page, "return {};");
  await boards.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(boards).toHaveCount(0);
  await board.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(board).toHaveCount(0);
  await expect(card(page)).toBeVisible();
});

test("Scrum-Board: Sprint und Backlog wechseln, Back/Forward folgt der Auswahl", async ({ page }) => {
  await page.addInitScript(() => {
    window.__qaBoardType = "scrum";
  });
  await open(page, "/bereiche/DEMO?board=1");
  await expect(card(page)).toBeVisible();
  const picker = main(page).getByRole("combobox", { name: "Sprint wählen" });

  await picker.click();
  await page.getByRole("option", { name: "Backlog", exact: true }).click();
  await expect(page).toHaveURL(/sprint=backlog/);
  await expect(main(page).getByRole("cell", { name: "DEMO-1", exact: true })).toBeVisible();

  await picker.click();
  await page.getByRole("option", { name: "Sprint 5", exact: true }).click();
  await expect(page).toHaveURL(/sprint=5/);
  await expect(card(page)).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__qa.searches.some((jql) => jql.includes("sprint = 5")))).toBe(true);

  await page.goBack();
  await expect(page).toHaveURL(/sprint=backlog/);
  await page.goBack();
  await expect(page).not.toHaveURL(/sprint=/);
  await expect(card(page)).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/sprint=backlog/);
});

test("Erster Fehler der Boarddaten zeigt Retry statt Skeleton", async ({ page }) => {
  await page.addInitScript(() => {
    window.__qaBoardRule = (path) => (path.endsWith("/configuration") ? { status: 503 } : {});
  });
  await open(page, "/bereiche/DEMO?board=1");
  const failure = alertWith(page, "Board konnte nicht geladen werden");
  await expect(failure).toBeVisible();
  await expect(boardSkeleton(page)).toHaveCount(0);
  await setBoardRule(page, "return {};");
  await failure.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(card(page)).toBeVisible();
});

test("Unbekanntes Board ist ehrlich als nicht geladen markiert, ohne Umleitung", async ({ page }, testInfo) => {
  await open(page, "/bereiche/DEMO?board=999");
  const missing = alertWith(page, "Board nicht verfügbar");
  await expect(missing).toContainText("Board 999 ist nicht unter den geladenen Boards von DEMO");
  await expect(main(page).getByText("DEMO · Board 999")).toBeVisible();
  await expect(page).toHaveURL(/board=999/);
  await shot(page, testInfo, "board-fehlt");

  await missing.getByRole("button", { name: "Alle Vorgänge anzeigen" }).click();
  await expect(page).not.toHaveURL(/board=/);
  await expect(main(page).getByRole("cell", { name: "DEMO-1", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/board=999/);
  await expect(missing).toBeVisible();
});

test("Ungültige Direktlinks gelangen nicht in Abfragen", async ({ page }) => {
  const sent = () => page.evaluate(() => [...window.__qa.searches, ...(window.__qa.boardReads ?? [])].join("\n"));

  await open(page, "/bereiche/DEMO?board=abc&sprint=1%20OR%201%3D1");
  await expect(main(page).getByText("DEMO · Alle Vorgänge")).toBeVisible();
  await expect(main(page).getByRole("cell", { name: "DEMO-1", exact: true })).toBeVisible();
  expect(await sent()).toContain('project = "DEMO"');
  expect(await sent()).not.toContain("1=1");

  await open(page, "/bereiche/DEMO?board=1&sprint=openSprints()");
  await expect(card(page)).toBeVisible();
  expect(await sent()).not.toContain("sprint");
  expect(await sent()).not.toContain("openSprints");
});
