import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __qa: {
      writes: unknown[];
      commands: string[];
      failMyself: boolean;
      myselfDelayMs: number;
      myselfCalls: number;
      outlook: { calls: Array<{ action: string }> };
    };
    __qaGhHosts: unknown;
  }
}

const SHOTS = process.env.CONNECTIONS_SHOTS;

const open = (page: Page, route: string, scenario = "") =>
  page.goto(`/tests/browser/fixture.html?${new URLSearchParams({ route, scenario })}`);

const card = (page: Page, name: string) => page.getByRole("region", { name, exact: true });

const setDeviceOnline = (page: Page, online: boolean) =>
  page.evaluate((value) => {
    Object.defineProperty(Navigator.prototype, "onLine", { configurable: true, get: () => value });
    window.dispatchEvent(new Event(value ? "online" : "offline"));
  }, online);

const offlineNotice = (page: Page) => page.getByTestId("offline-notice");

const shot = async (page: Page, name: string) => {
  if (!SHOTS) return;
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.addInitScript(() => {
    window.__qaGhHosts = { hosts: {} };
  });
});

test("Offline-Ereignis zeigt den Hinweis, Seiten bleiben bedienbar, online blendet ihn aus", async ({ page }) => {
  await open(page, "/");
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toContainText("Alex");
  await expect(offlineNotice(page)).toHaveCount(0);

  await setDeviceOnline(page, false);
  await expect(offlineNotice(page)).toContainText("Gerät meldet offline; angezeigte Daten können veraltet sein.");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toContainText("Alex");

  await expect(async () => {
    const header = await page.locator("header").first().boundingBox();
    const notice = await offlineNotice(page).boundingBox();
    expect(notice!.y).toBeGreaterThanOrEqual(header!.y + header!.height - 1);
    expect(notice!.x + notice!.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  }).toPass();

  await page.getByRole("navigation", { name: "Werkzeuge" }).getByRole("link", { name: "Einstellungen" }).click();
  await page.getByRole("link", { name: "Verbindungen" }).click();
  await expect(offlineNotice(page)).toBeVisible();
  await expect(card(page, "Netzwerk dieses Geräts")).toContainText("Gerät offline");
  await expect(card(page, "Jira")).toContainText("Angemeldet");
  await expect(card(page, "Jira").getByRole("button", { name: "Jira prüfen" })).toBeDisabled();
  await expect(card(page, "Jira")).toContainText("Eine Prüfung ist erst wieder mit Netzwerk möglich.");
  await expect(card(page, "Code-Hosting")).not.toContainText("Keine Verbindung");
  await expect(card(page, "Outlook-Kalender")).toContainText("Wartet auf Netzwerk");
  await expect(card(page, "Outlook-Kalender")).not.toContainText("Nicht verbunden");
  await shot(page, `offline-${test.info().project.name}`);

  await page.getByRole("link", { name: "Darstellung" }).click();
  await expect(page.getByRole("heading", { name: "Erscheinungsbild" })).toBeVisible();
  await expect(offlineNotice(page)).toBeVisible();

  await setDeviceOnline(page, true);
  await expect(offlineNotice(page)).toHaveCount(0);
  await expect(page.getByText(/wieder verfügbar|alle Dienste/i)).toHaveCount(0);
  expect(await page.evaluate(() => window.__qa.writes)).toEqual([]);
});

test("Jira angemeldet: Prüfung nur auf Knopfdruck, Fehler behält letzten Stand, Abbruch möglich", async ({ page }) => {
  await open(page, "/settings/verbindungen");
  const jira = card(page, "Jira");
  await expect(jira).toContainText("Angemeldet bei Lokale UI-Testdaten");
  await expect(jira.getByRole("button", { name: "Jira prüfen" })).toBeEnabled();
  await expect(jira).toContainText("Antwort erhalten");

  const before = await page.evaluate(() => window.__qa.myselfCalls);
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => window.__qa.myselfCalls)).toBe(before);

  await jira.getByRole("button", { name: "Jira prüfen" }).click();
  await expect(jira).toContainText("Antwort erhalten");
  await expect(jira).toContainText(/Zuletzt erreichbar um \d{2}:\d{2}/);
  expect(await page.evaluate(() => window.__qa.myselfCalls)).toBe(before + 1);

  await page.evaluate(() => {
    window.__qa.failMyself = true;
  });
  await jira.getByRole("button", { name: "Jira prüfen" }).click();
  await expect(jira).toContainText("Prüfung fehlgeschlagen");
  await expect(jira.getByRole("alert")).toBeVisible();
  await expect(jira).toContainText(/Zuletzt erreichbar um \d{2}:\d{2}/);
  await expect(jira).toContainText("Angemeldet bei Lokale UI-Testdaten");

  await page.evaluate(() => {
    window.__qa.failMyself = false;
    window.__qa.myselfDelayMs = 4000;
  });
  await jira.getByRole("button", { name: "Jira prüfen" }).click();
  await expect(jira).toContainText("Wird geprüft");
  await jira.getByRole("button", { name: "Prüfung abbrechen" }).click();
  await expect(jira).toContainText("Prüfung fehlgeschlagen");
  await expect(jira.getByRole("button", { name: "Jira prüfen" })).toBeEnabled();
  await expect(jira.getByRole("button", { name: "Prüfung abbrechen" })).toHaveCount(0);

  const commands = await page.evaluate(() => window.__qa.commands);
  expect(commands).not.toContain("oauth_login");
  expect(commands.filter((command) => command.startsWith("scm_"))).toEqual(commands.filter((command) => command === "scm_gh_hosts"));
  expect(await page.evaluate(() => window.__qa.writes)).toEqual([]);
});

test("Jira nicht angemeldet und Lesefehler werden unterschieden, ohne Anmeldung zu starten", async ({ page }) => {
  await open(page, "/settings/verbindungen", "calendar-offline");
  await expect(card(page, "Jira")).toContainText("Nicht angemeldet");
  await expect(card(page, "Jira").getByRole("button", { name: "Mit Atlassian verbinden" })).toBeVisible();
  expect(await page.evaluate(() => window.__qa.commands)).not.toContain("oauth_login");

  await open(page, "/settings/verbindungen", "session-error");
  await expect(card(page, "Jira")).toContainText("Anmeldung nicht lesbar");
  await expect(card(page, "Jira")).toContainText("Das ist keine Abmeldung.");
  await expect(card(page, "Jira").getByRole("button", { name: "Mit Atlassian verbinden" })).toHaveCount(0);
  expect(await page.evaluate(() => window.__qa.commands)).not.toContain("oauth_login");
});

test("Code-Hosting und Outlook: keine Verbindung", async ({ page }) => {
  await open(page, "/settings/verbindungen");
  await expect(card(page, "Code-Hosting")).toContainText("Keine Verbindung");
  await expect(card(page, "Code-Hosting").getByRole("link", { name: "Code-Hosting verwalten" })).toHaveAttribute("href", "/settings/code-hosting");
  await expect(card(page, "Outlook-Kalender")).toContainText("Nicht verbunden");
  await expect(card(page, "Outlook-Kalender").getByRole("link", { name: "Im Kalender verbinden" })).toHaveAttribute("href", "/kalender");
  expect(await page.evaluate(() => window.__qa.outlook.calls)).toEqual([]);
});

test("Konfigurierte Verbindungen zeigen ehrliche Zustände ohne Repos oder Termine zu laden", async ({ page }) => {
  await page.addInitScript(() => {
    window.__qaGhHosts = { hosts: { "github.com": [{ state: "success", active: true, host: "github.com", login: "qa-user" }] } };
    localStorage.setItem(
      "betterjira-scm",
      JSON.stringify({
        state: {
          connections: [
            {
              id: "token-1",
              kind: "bitbucket-dc",
              label: "Bitbucket Test",
              baseUrl: "https://bitbucket.example.com",
              account: "qa-user",
              auth: { kind: "token", id: "token-1", username: "qa-user" },
            },
          ],
          repoLinks: {},
        },
        version: 0,
      }),
    );
    localStorage.setItem("betterjira:calendar:outlook:v1", "ABC123");
  });
  await open(page, "/settings/verbindungen");
  const scm = card(page, "Code-Hosting");
  await expect(scm).toContainText("2 konfiguriert");
  await expect(scm).toContainText("Laut GitHub CLI angemeldet");
  await expect(scm).toContainText("bitbucket.example.com · qa-user · Token gespeichert, nicht geprüft");

  const outlook = card(page, "Outlook-Kalender");
  await expect(outlook).toContainText("Verbunden");
  await expect(outlook).toContainText("outlook@example.com");
  await card(page, "Jira").getByRole("button", { name: "Jira prüfen" }).click();
  await expect(card(page, "Jira")).toContainText("Antwort erhalten");
  await shot(page, `overview-${test.info().project.name}`);

  const outlookCalls = () => page.evaluate(() => window.__qa.outlook.calls.map((call) => call.action));
  const beforeCheck = (await outlookCalls()).length;
  await page.evaluate(() => {
    (window.__qa.outlook as { failNext?: boolean }).failNext = true;
  });
  await outlook.getByRole("button", { name: "Outlook prüfen" }).click();
  await expect(outlook).toContainText("Prüfung fehlgeschlagen");
  await expect(outlook).toContainText("outlook@example.com");

  expect(await outlookCalls()).toHaveLength(beforeCheck + 1);
  expect(new Set(await outlookCalls())).toEqual(new Set(["account"]));
  const commands = await page.evaluate(() => window.__qa.commands);
  expect(commands.filter((command) => command.startsWith("scm_"))).toEqual(commands.filter((command) => command === "scm_gh_hosts"));
  expect(await page.evaluate(() => window.__qa.writes)).toEqual([]);
});

test("Offline-Hinweis bei 390 px ohne Überdeckung", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "/settings/verbindungen");
  await expect(card(page, "Jira")).toContainText("Angemeldet");
  await setDeviceOnline(page, false);
  await expect(offlineNotice(page)).toBeVisible();
  await expect(async () => {
    const header = await page.locator("header").first().boundingBox();
    const notice = await offlineNotice(page).boundingBox();
    const heading = await page.getByRole("heading", { name: "Einstellungen" }).boundingBox();
    expect(notice!.y).toBeGreaterThanOrEqual(header!.y + header!.height - 1);
    expect(notice!.x + notice!.width).toBeLessThanOrEqual(391);
    expect(heading!.y).toBeGreaterThanOrEqual(notice!.y + notice!.height - 1);
  }).toPass();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await shot(page, `offline-390-${test.info().project.name}`);
  await setDeviceOnline(page, true);
  await expect(offlineNotice(page)).toHaveCount(0);
});
