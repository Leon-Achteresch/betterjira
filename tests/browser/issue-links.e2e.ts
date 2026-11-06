import { expect, test, type Page, type TestInfo } from "@playwright/test";

type LinksRule = { delayMs?: number; status?: number; issuelinks?: unknown[] };

declare global {
  interface Window {
    __qaIssueLinksRule?: (key: string) => LinksRule;
    __qaLinksStatus?: number;
    __qa: { issueReads: string[] };
  }
}

const ISSUE = (key: string) => `/tests/browser/fixture.html?route=/issue/${key}`;

const panel = (page: Page) => page.locator("section").filter({ has: page.getByRole("heading", { name: /^Verknüpfungen/ }) });
const group = (page: Page, label: string) => panel(page).getByRole("group", { name: label, exact: true });
const rowKeys = (page: Page, label: string) => group(page, label).locator("a[data-row-link] > span:first-child");

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  const dir = process.env.ISSUE_LINKS_SHOTS;
  if (!dir) return;
  await panel(page).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${dir}/${testInfo.project.name}-${name}.png` });
};

const failWithStatusSwitch = (page: Page) =>
  page.addInitScript(() => {
    window.__qaIssueLinksRule = () => (window.__qaLinksStatus ? { status: window.__qaLinksStatus } : {});
  });

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("gruppiert nach Richtung, dedupliziert und lädt beim Öffnen keine Nachbartickets", async ({ page }, testInfo) => {
  await page.goto(ISSUE("DEMO-1"));
  await expect(panel(page).getByRole("heading", { name: "Verknüpfungen · 4" })).toBeVisible();
  await expect(rowKeys(page, "blocks")).toHaveText(["DEMO-2"]);
  await expect(rowKeys(page, "is blocked by")).toHaveText(["DEMO-3"]);
  await expect(rowKeys(page, "relates to")).toHaveText(["DEMO-3", "OPS-7"]);
  await expect(group(page, "relates to").getByRole("link", { name: /OPS-7/ })).toContainText("Details nicht verfügbar");
  await expect(group(page, "blocks").getByRole("link", { name: /DEMO-2/ })).toContainText("Tastaturbedienung im Editor verbessern");
  await expect(group(page, "blocks").getByRole("link", { name: /DEMO-2/ })).toContainText("In Arbeit");
  await expect(panel(page)).toContainText("Eine Verknüpfung liefert keine lesbaren Ticketdaten.");
  await expect(panel(page)).not.toContainText(/gelöscht/i);
  await shot(page, testInfo, "verknuepfungen");

  const reads = await page.evaluate(() => window.__qa.issueReads);
  expect(reads.filter((read) => read.startsWith("/issue/DEMO-1?fields=issuelinks"))).toHaveLength(1);
  expect(reads.filter((read) => /^\/issue\/(DEMO-2|DEMO-3|OPS-7)\?/.test(read))).toEqual([]);
});

test("öffnet ein verknüpftes Ticket intern per Tastatur und kehrt zurück", async ({ page }) => {
  await page.goto(ISSUE("DEMO-1"));
  const link = group(page, "blocks").getByRole("link", { name: /DEMO-2/ });
  await expect(link).toHaveAttribute("href", "/issue/DEMO-2");
  await link.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/issue\/DEMO-2$/);
  await expect(rowKeys(page, "is blocked by")).toHaveText(["DEMO-1"]);
  await expect(panel(page).getByRole("group", { name: "blocks", exact: true })).toHaveCount(0);

  await page.goBack();
  await expect(page).toHaveURL(/\/issue\/DEMO-1$/);
  await expect(rowKeys(page, "blocks")).toHaveText(["DEMO-2"]);

  await group(page, "is blocked by").getByRole("link", { name: /DEMO-3/ }).click();
  await expect(page).toHaveURL(/\/issue\/DEMO-3$/);
  await expect(rowKeys(page, "blocks")).toHaveText(["DEMO-1"]);
});

test("zeigt ohne Verknüpfungen einen ruhigen Leerzustand ohne Gruppen", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    window.__qaIssueLinksRule = () => ({ issuelinks: [] });
  });
  await page.goto(ISSUE("DEMO-1"));
  await expect(panel(page).getByRole("heading", { name: "Verknüpfungen · 0" })).toBeVisible();
  await expect(panel(page)).toContainText("Keine verknüpften Tickets.");
  await expect(panel(page).getByRole("group")).toHaveCount(0);
  await shot(page, testInfo, "leer");
});

test("Ladefehler zeigt Jira-Meldung und lädt per Retry nach", async ({ page }, testInfo) => {
  await failWithStatusSwitch(page);
  await page.addInitScript(() => {
    window.__qaLinksStatus = 403;
  });
  await page.goto(ISSUE("DEMO-1"));
  const alert = panel(page).getByRole("alert");
  await expect(alert).toContainText("Verknüpfungen konnten nicht geladen werden. Test: Jira antwortet mit 403");
  await shot(page, testInfo, "fehler");
  await page.evaluate(() => {
    window.__qaLinksStatus = 0;
  });
  await alert.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(alert).toHaveCount(0);
  await expect(rowKeys(page, "blocks")).toHaveText(["DEMO-2"]);
});

test("fehlgeschlagene Aktualisierung behält den geladenen Stand", async ({ page }, testInfo) => {
  await page.clock.install();
  await failWithStatusSwitch(page);
  await page.goto(ISSUE("DEMO-1"));
  await expect(rowKeys(page, "blocks")).toHaveText(["DEMO-2"]);

  await group(page, "blocks").getByRole("link", { name: /DEMO-2/ }).click();
  await expect(page).toHaveURL(/\/issue\/DEMO-2$/);
  await page.evaluate(() => {
    window.__qaLinksStatus = 503;
  });
  await page.clock.setSystemTime(Date.now() + 31_000);
  await page.goBack();

  const warning = panel(page).getByRole("alert").filter({ hasText: "Aktualisierung fehlgeschlagen" });
  await expect(warning).toContainText("Angezeigt wird der zuletzt geladene Stand.");
  await expect(warning).toContainText("Test: Jira antwortet mit 503");
  await expect(rowKeys(page, "blocks")).toHaveText(["DEMO-2"]);
  await shot(page, testInfo, "aktualisierung-fehlgeschlagen");

  await page.evaluate(() => {
    window.__qaLinksStatus = 0;
  });
  await warning.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(warning).toHaveCount(0);
  await expect(rowKeys(page, "blocks")).toHaveText(["DEMO-2"]);
});

test("lange Gruppen zeigen fünf Einträge und blenden weitere auf Wunsch ein", async ({ page }) => {
  await page.addInitScript(() => {
    const type = { name: "Relates", inward: "relates to", outward: "relates to" };
    window.__qaIssueLinksRule = () => ({
      issuelinks: Array.from({ length: 8 }, (_, index) => ({ type, outwardIssue: { key: `OPS-${index + 1}` } })),
    });
  });
  await page.goto(ISSUE("DEMO-1"));
  await expect(rowKeys(page, "relates to")).toHaveCount(5);
  const more = group(page, "relates to").getByRole("button", { name: "3 weitere anzeigen" });
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await more.click();
  await expect(rowKeys(page, "relates to")).toHaveCount(8);
  await expect(group(page, "relates to").getByRole("button", { name: "Weniger anzeigen" })).toHaveAttribute("aria-expanded", "true");
});

test("bleibt bei 390 px ohne Seitenüberlauf bedienbar", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(ISSUE("DEMO-1"));
  await expect(rowKeys(page, "relates to")).toHaveText(["DEMO-3", "OPS-7"]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const heights = await panel(page)
    .locator("a[data-row-link]")
    .evaluateAll((links) => links.map((link) => link.getBoundingClientRect().height));
  expect(Math.min(...heights)).toBeGreaterThanOrEqual(32);
  await shot(page, testInfo, "schmal-390");
});
