import { expect, test, type Page, type TestInfo } from "@playwright/test";

type RemoteLinksRule = { delayMs?: number; status?: number; links?: unknown[] };

declare global {
  interface Window {
    __qaRemoteLinksRule?: (key: string) => RemoteLinksRule;
    __qaRemoteStatus?: number;
    __qa: { issueReads: string[]; opened: string[] };
  }
}

const ISSUE = (key: string) => `/tests/browser/fixture.html?route=/issue/${key}`;
const CONFLUENCE = "https://example.atlassian.net/wiki/spaces/QA/pages/1";

const section = (page: Page) => page.locator("section").filter({ has: page.getByRole("heading", { name: /^Externe Links/ }) });
const toggle = (page: Page) => section(page).getByRole("button", { name: /^Externe Links/ });
const items = (page: Page) => section(page).getByRole("listitem");
const remoteReads = (page: Page) =>
  page.evaluate(() => window.__qa.issueReads.filter((read) => /^\/issue\/[^/]+\/remotelink/.test(read)));

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  const dir = process.env.REMOTE_LINKS_SHOTS;
  if (!dir) return;
  await page.evaluate(() => document.fonts.ready);
  await section(page).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${dir}/${testInfo.project.name}-${name}.png` });
};

const statusSwitch = (page: Page) =>
  page.addInitScript(() => {
    window.__qaRemoteLinksRule = () => (window.__qaRemoteStatus ? { status: window.__qaRemoteStatus } : {});
  });

const waitForIssue = (page: Page) =>
  expect(page.locator("section").filter({ has: page.getByRole("heading", { name: /^Verknüpfungen · / }) })).toBeVisible();

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("bleibt eingeklappt ohne Anfrage und lädt erst beim Aufklappen per Tastatur", async ({ page }, testInfo) => {
  await page.goto(ISSUE("DEMO-1"));
  await waitForIssue(page);
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
  await expect(items(page)).toHaveCount(0);
  expect(await remoteReads(page)).toEqual([]);

  await toggle(page).focus();
  await page.keyboard.press("Enter");
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
  await expect(toggle(page)).toHaveText(/^Externe Links\s*· 5$/);
  await expect(items(page)).toHaveCount(5);
  expect(await remoteReads(page)).toHaveLength(1);
  await shot(page, testInfo, "geoeffnet");

  await page.keyboard.press("Enter");
  await expect(items(page)).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(items(page)).toHaveCount(5);
  expect(await remoteReads(page)).toHaveLength(1);
});

test("öffnet nur validierte http/https-Ziele und zeigt Texte unverändert", async ({ page }) => {
  await page.goto(ISSUE("DEMO-1"));
  await toggle(page).click();

  const confluence = section(page).getByRole("button", { name: /Übergabe-Checkliste/ });
  await expect(confluence).toContainText("Wiki-Seite · Confluence · example.atlassian.net");
  await expect(confluence).toContainText("Lokale Testseite: Ablauf, Verantwortliche und Rückfallplan.");
  expect(await page.evaluate(() => window.__qa.opened)).toEqual([]);
  await confluence.focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => window.__qa.opened)).toEqual([CONFLUENCE]);

  const spec = section(page).getByRole("button", { name: /Tastaturbedienung im Editor/ });
  await expect(spec).toContainText("<b>kein HTML</b> wird ausgeführt");
  await expect(spec.locator("b")).toHaveCount(0);
  await expect(spec).toContainText("(erledigt)");

  for (const title of ["Ungültiges Protokoll", "Ziel fehlt", "Ziel mit Zugangsdaten"]) {
    const row = items(page).filter({ hasText: title });
    await expect(row).toContainText("Nicht öffnbar");
    await expect(row.getByRole("button")).toHaveCount(0);
  }
  await expect(section(page)).not.toContainText("geheim");
  await expect(section(page)).not.toContainText("javascript:");
  await expect(section(page)).toContainText("Ein externer Link liefert keine lesbaren Daten.");
  await expect(section(page).locator("img")).toHaveCount(0);
  expect(await page.evaluate(() => window.__qa.opened)).toEqual([CONFLUENCE]);
});

test("Ticketwechsel startet eingeklappt und zeigt keine fremden Links", async ({ page }) => {
  await page.goto(ISSUE("DEMO-1"));
  await toggle(page).click();
  await expect(items(page)).toHaveCount(5);

  await page.getByRole("group", { name: "blocks", exact: true }).getByRole("link", { name: /DEMO-2/ }).click();
  await expect(page).toHaveURL(/\/issue\/DEMO-2$/);
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
  await expect(items(page)).toHaveCount(0);
  expect((await remoteReads(page)).filter((read) => read.startsWith("/issue/DEMO-2/"))).toEqual([]);

  await toggle(page).click();
  await expect(section(page)).toContainText("Keine externen Links.");
  await expect(section(page)).not.toContainText("Übergabe-Checkliste");

  await page.goBack();
  await expect(page).toHaveURL(/\/issue\/DEMO-1$/);
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
});

test("viele Links zeigen zuerst fünf und erweitern lokal mit ehrlicher Zahl", async ({ page }) => {
  await page.addInitScript(() => {
    window.__qaRemoteLinksRule = () => ({
      links: Array.from({ length: 12 }, (_, index) => ({
        id: 20000 + index,
        object: { url: `https://docs.example.test/${index + 1}`, title: `Dokument ${index + 1}` },
      })),
    });
  });
  await page.goto(ISSUE("DEMO-1"));
  await toggle(page).click();
  await expect(toggle(page)).toHaveText(/^Externe Links\s*· 12$/);
  await expect(items(page)).toHaveCount(5);
  const more = section(page).getByRole("button", { name: "7 weitere anzeigen" });
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await more.click();
  await expect(items(page)).toHaveCount(12);
  await expect(section(page).getByRole("button", { name: "Weniger anzeigen" })).toHaveAttribute("aria-expanded", "true");
  expect(await remoteReads(page)).toHaveLength(1);
});

test("Ladefehler zeigt Jira-Meldung und lädt per Retry nach", async ({ page }, testInfo) => {
  await statusSwitch(page);
  await page.addInitScript(() => {
    window.__qaRemoteStatus = 403;
  });
  await page.goto(ISSUE("DEMO-1"));
  await toggle(page).click();
  const alert = section(page).getByRole("alert");
  await expect(alert).toContainText("Externe Links konnten nicht geladen werden. Test: Jira antwortet mit 403");
  await shot(page, testInfo, "fehler");
  await page.evaluate(() => {
    window.__qaRemoteStatus = 0;
  });
  await alert.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(alert).toHaveCount(0);
  await expect(items(page)).toHaveCount(5);
});

test("fehlgeschlagene Aktualisierung behält den geladenen Stand", async ({ page }, testInfo) => {
  await page.clock.install();
  await statusSwitch(page);
  await page.goto(ISSUE("DEMO-1"));
  await toggle(page).click();
  await expect(items(page)).toHaveCount(5);
  await toggle(page).click();
  await expect(items(page)).toHaveCount(0);

  await page.evaluate(() => {
    window.__qaRemoteStatus = 503;
  });
  await page.clock.setSystemTime(Date.now() + 31_000);
  await toggle(page).click();

  const warning = section(page).getByRole("alert").filter({ hasText: "Aktualisierung fehlgeschlagen" });
  await expect(warning).toContainText("Angezeigt wird der zuletzt geladene Stand.");
  await expect(warning).toContainText("Test: Jira antwortet mit 503");
  await expect(items(page)).toHaveCount(5);
  await shot(page, testInfo, "aktualisierung-fehlgeschlagen");

  await page.evaluate(() => {
    window.__qaRemoteStatus = 0;
  });
  await warning.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(warning).toHaveCount(0);
  await expect(items(page)).toHaveCount(5);
});

test("bleibt bei 390 px ohne Seitenüberlauf bedienbar", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(ISSUE("DEMO-1"));
  await toggle(page).click();
  await expect(items(page)).toHaveCount(5);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const heights = await section(page)
    .getByRole("button")
    .evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height));
  expect(Math.min(...heights)).toBeGreaterThanOrEqual(32);
  await shot(page, testInfo, "schmal-390");
});
