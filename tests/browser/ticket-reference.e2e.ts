import { expect, test, type Page, type TestInfo } from "@playwright/test";

declare global {
  interface Window {
    __qa: { searches: string[]; commands: string[] };
    __qaSearchRule?: (jql: string) => { delayMs?: number };
  }
}

const SITE = "https://example.atlassian.net";
const shots = process.env.TICKET_REFERENCE_SHOTS;

const open = (page: Page, scenario?: string) =>
  page.goto(`/tests/browser/fixture.html?${new URLSearchParams({ route: "/tickets", ...(scenario && { scenario }) })}`);

const palette = (page: Page) => page.getByRole("dialog", { name: "Command palette" });
const field = (page: Page) => palette(page).getByRole("combobox");
const options = (page: Page) => palette(page).getByRole("option");
const searches = (page: Page) => page.evaluate(() => window.__qa.searches);
const textSearches = async (page: Page) => (await searches(page)).filter((jql) => jql.includes("text ~"));

const summon = async (page: Page) => {
  await expect(page.getByRole("button", { name: "Suchen" })).toBeVisible();
  await page.keyboard.press("ControlOrMeta+k");
  await expect(field(page)).toBeFocused();
};

const shot = async (page: Page, info: TestInfo, name: string) => {
  if (!shots) return;
  const narrow = info.project.name !== "desktop";
  const state = await page.evaluate(async () => {
    await document.fonts.ready;
    return {
      geist: [...document.fonts].some((face) => face.family.includes("Geist") && face.status === "loaded"),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      dark: document.documentElement.classList.contains("dark"),
    };
  });
  expect(state).toEqual({ geist: true, overflow: 0, dark: narrow });
  await page.screenshot({ path: `${shots}/${narrow ? "390-dunkel" : "desktop-hell"}-${name}.png` });
};

test.beforeEach(async ({ page }, info) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  if (info.project.name !== "desktop") await page.setViewportSize({ width: 390, height: 844 });
});

test("Eigener Jira-Link mit Query und Fragment öffnet das Ticket intern", async ({ page }, info) => {
  await open(page);
  await summon(page);
  await field(page).fill(`${SITE}/browse/demo-2?focusedCommentId=10001&atlOrigin=geheim#comment-10001`);
  await expect(options(page)).toHaveCount(1);
  await expect(options(page).first()).toHaveAccessibleName(/DEMO-2 öffnen/);
  await expect(palette(page).getByText("Ticket-Link")).toBeVisible();
  await shot(page, info, "treffer");

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/issue\/DEMO-2$/);
  await expect(palette(page)).toBeHidden();
  expect(await textSearches(page)).toEqual([]);
  expect((await page.evaluate(() => window.__qa.commands)).filter((command) => command.includes("opener"))).toEqual([]);

  await summon(page);
  await field(page).fill(`${SITE}/browse/DEMO-3`);
  await options(page).first().click();
  await expect(page).toHaveURL(/\/issue\/DEMO-3$/);
});

test("Schlüssel und Freitext funktionieren unverändert", async ({ page }) => {
  await open(page);
  await summon(page);
  await field(page).fill("demo-2");
  await expect(palette(page).getByRole("option", { name: /DEMO-2 öffnen/ })).toBeVisible();

  await field(page).fill("Übergabe");
  await expect.poll(() => textSearches(page)).toContain('text ~ "Übergabe*" ORDER BY updated DESC');
  await expect(palette(page).getByText("Suchergebnisse").or(palette(page).getByText("Meine Vorgänge")).first()).toBeVisible();

  await field(page).fill("Jira-Tickets");
  await palette(page).getByRole("option", { name: /Jira-Tickets/ }).click();
  await expect(page).toHaveURL(/\/tickets$/);
});

const REJECTED: [string, string, RegExp][] = [
  ["Link mit Leerzeichen", `${SITE}/browse/DEMO-1?token=geheim wert`, /kein gültiger Link/],
  ["Script-Adresse mit Leerzeichen", "javascript:alert('geheim wert')", /kein gültiger Link/],
  ["fremder Host", "https://evil.example/browse/DEMO-1?token=geheim#frag", /Nur Links von example\.atlassian\.net/],
  ["täuschender Host", `${SITE}.evil.example/browse/DEMO-1?token=geheim`, /Nur Links von example\.atlassian\.net/],
  ["http", "http://example.atlassian.net/browse/DEMO-1", /Nur sichere https-Links/],
  ["Zugangsdaten", "https://nutzer:passwort@example.atlassian.net/browse/DEMO-1", /Zugangsdaten/],
  ["ungültiger Pfad", `${SITE}/jira/software/projects/DEMO/boards/1?selectedIssue=DEMO-1`, /zeigt auf kein Ticket/],
];

test("Fremde, täuschende und ungültige Links werden erklärt und nicht gesucht", async ({ page }, info) => {
  await open(page);
  await summon(page);
  for (const [name, link, message] of REJECTED) {
    await field(page).fill(link);
    const hint = palette(page).getByText(message);
    await expect(hint, name).toBeVisible();
    await expect(options(page), name).toHaveCount(0);
    await expect(hint).not.toContainText(/geheim|frag|selectedIssue|passwort/);
    if (name === "täuschender Host") await shot(page, info, "fremder-host");
  }
  await page.waitForTimeout(400);
  expect(await textSearches(page)).toEqual([]);
  await expect(page).toHaveURL(/\/tickets$/);
});

test("Abgemeldet erklärt die fehlende Verbindung ohne Anmeldewechsel", async ({ page }) => {
  await open(page, "calendar-offline");
  await summon(page);
  await field(page).fill(`${SITE}/browse/DEMO-1`);
  await expect(palette(page).getByText("Ticket-Links lassen sich erst nach der Verbindung mit Jira öffnen.")).toBeVisible();
  await expect(options(page)).toHaveCount(0);
  await page.waitForTimeout(400);
  const commands = await page.evaluate(() => window.__qa.commands);
  expect(commands.filter((command) => command.includes("oauth") || command.includes("opener"))).toEqual([]);
  expect(await textSearches(page)).toEqual([]);
});

test("Verzögerte frühere Freitextsuche überlagert den Linktreffer nicht", async ({ page }) => {
  await page.addInitScript(() => {
    window.__qaSearchRule = (jql) => (jql.includes("text ~") ? { delayMs: 1500 } : {});
  });
  await open(page);
  await summon(page);
  await field(page).fill("Übergabe");
  await expect.poll(() => textSearches(page)).toHaveLength(1);
  await field(page).fill(`${SITE}/browse/DEMO-2#comment-1`);
  await expect(options(page)).toHaveCount(1);
  await page.waitForTimeout(1800);
  await expect(options(page)).toHaveCount(1);
  await expect(options(page).first()).toHaveAccessibleName(/DEMO-2 öffnen/);
  expect(await textSearches(page)).toEqual(['text ~ "Übergabe*" ORDER BY updated DESC']);
});
