import { expect, test, type Page, type TestInfo } from "@playwright/test";

type IssueRule = { delayMs?: number; status?: number; summary?: string };

declare global {
  interface Window {
    __qaMyselfRule?: () => { delayMs?: number; status?: number };
    __qaIssueRule?: (key: string) => IssueRule;
    __qa: { issueReads: string[]; writes: unknown[]; sessionFailure: boolean };
  }
}

const ISSUE = (key: string, query = "") => `/tests/browser/fixture.html?${query}route=/issue/${key}`;
const DEMO_1 = "Suche für den Arbeitsalltag vereinfachen";
const DEMO_2 = "Tastaturbedienung im Editor verbessern";

const title = (page: Page) => page.getByRole("heading", { level: 1 });
const alertWith = (page: Page, text: string) => page.getByRole("alert").filter({ hasText: text });
const refreshNotice = (page: Page) => alertWith(page, "zuletzt geladene Stand");
const retry = (page: Page, scope = page.locator("body")) => scope.getByRole("button", { name: "Erneut versuchen" });
const comment = (page: Page) => page.getByRole("textbox", { name: "Kommentar", exact: true });
const loginPrompt = (page: Page) => page.getByText("Melde dich an, um Tickets zu sehen.");

const setRule = (page: Page, rules: Record<string, IssueRule>) =>
  page.evaluate((map) => {
    window.__qaIssueRule = (key) => map[key] ?? {};
  }, rules);

const initialRule = (page: Page, rules: Record<string, IssueRule>) =>
  page.addInitScript((map) => {
    window.__qaIssueRule = (key) => map[key] ?? {};
  }, rules);

const detailReads = (page: Page, key: string) =>
  page.evaluate((path) => window.__qa.issueReads.filter((read) => read === path).length, `/issue/${key}?fields=*all`);

const refreshFromMenu = async (page: Page) => {
  await page.getByRole("button", { name: "Weitere Ticketaktionen" }).click();
  await page.getByRole("menuitem", { name: "Aktualisieren" }).press("Enter");
};

const settle = (page: Page) =>
  page.evaluate(async () => {
    await document.fonts.ready;
    if (![...document.fonts].some((face) => face.family.includes("Geist") && face.status === "loaded")) throw new Error("Geist nicht geladen");
    const finite = document.getAnimations().filter((animation) => animation.effect?.getTiming().iterations !== Infinity);
    await Promise.all(finite.map((animation) => animation.finished.catch(() => undefined)));
    await new Promise((resolve) => setTimeout(resolve, 350));
  });

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  const dir = process.env.ISSUE_RECOVERY_SHOTS;
  if (!dir) return;
  await settle(page);
  await page.screenshot({ path: `${dir}/${testInfo.project.name}-${name}.png` });
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("fehlgeschlagene Kontoprüfung bietet Retry statt endloser Ticket-Platzhalter", async ({ page }) => {
  await page.addInitScript(() => {
    window.__qaMyselfRule = () => ({ status: 403 });
  });
  await page.goto(ISSUE("DEMO-1"));
  const error = alertWith(page, "Jira-Konto konnte nicht geprüft werden");
  await expect(error).toBeVisible();
  await expect(title(page)).toHaveCount(0);
  await expect(loginPrompt(page)).toHaveCount(0);
  expect(await detailReads(page, "DEMO-1")).toBe(0);
  await page.evaluate(() => { window.__qaMyselfRule = undefined; });
  await retry(page, error).click();
  await expect(title(page)).toHaveText(DEMO_1);
});

test("erster 503 erklärt den Fehler ohne Ticketinhalt und Retry lädt das Ticket", async ({ page }, testInfo) => {
  await initialRule(page, { "DEMO-1": { status: 503 } });
  await page.goto(ISSUE("DEMO-1"));
  const error = alertWith(page, "Jira ist gerade nicht erreichbar");
  await expect(error).toContainText("Test: Jira antwortet mit 503");
  await expect(error).toContainText("DEMO-1");
  await expect(title(page)).toHaveCount(0);
  await expect(loginPrompt(page)).toHaveCount(0);
  await shot(page, testInfo, "erstfehler-503");

  await setRule(page, {});
  await retry(page, error).click();
  await expect(title(page)).toHaveText(DEMO_1);
  await expect(error).toHaveCount(0);
});

test("403 nennt fehlende Berechtigung und keine Abmeldung", async ({ page }) => {
  await initialRule(page, { "DEMO-1": { status: 403 } });
  await page.goto(ISSUE("DEMO-1"));
  const error = alertWith(page, "Kein Zugriff auf dieses Ticket");
  await expect(error).toContainText("weiterhin angemeldet");
  await expect(error).not.toContainText(/abgemeldet|gelöscht/i);
  await expect(loginPrompt(page)).toHaveCount(0);
  await expect(retry(page, error)).toBeEnabled();
  expect(await detailReads(page, "DEMO-1")).toBe(1);
});

test("404 behauptet weder Löschung noch Abmeldung", async ({ page }) => {
  await page.goto(ISSUE("DEMO-99"));
  const error = alertWith(page, "Ticket nicht gefunden");
  await expect(error).toContainText("verschoben, gelöscht oder für dein Konto nicht sichtbar");
  await expect(error).toContainText("Anmeldung bleibt davon unberührt");
  await expect(error).not.toContainText(/wurde gelöscht|abgemeldet/i);
  await expect(loginPrompt(page)).toHaveCount(0);
});

test("fehlgeschlagene Aktualisierung behält Inhalt, Kommentare, Entwurf und Editor-DOM", async ({ page }, testInfo) => {
  await page.goto(ISSUE("DEMO-1"));
  await expect(title(page)).toHaveText(DEMO_1);
  await comment(page).fill("Entwurf während der Störung");
  await comment(page).evaluate((element) => element.setAttribute("data-qa-keep", "1"));
  await setRule(page, { "DEMO-1": { status: 503 } });

  await refreshFromMenu(page);
  const notice = refreshNotice(page);
  await expect(notice).toContainText("Test: Jira antwortet mit 503");
  await expect(notice).toContainText(/Stand \d{2}:\d{2} Uhr/);
  await expect(title(page)).toHaveText(DEMO_1);
  await expect(page.getByText("Die erste Fassung ist bereit.")).toBeVisible();
  await expect(comment(page)).toHaveText("Entwurf während der Störung");
  await expect(comment(page)).toHaveAttribute("data-qa-keep", "1");
  await shot(page, testInfo, "aktualisierungsfehler");

  await setRule(page, { "DEMO-1": { summary: "Frisch aus Jira" } });
  await retry(page, notice).click();
  await expect(notice).toHaveCount(0);
  await expect(title(page)).toHaveText("Frisch aus Jira");
  await expect(comment(page)).toHaveText("Entwurf während der Störung");
  await expect(comment(page)).toHaveAttribute("data-qa-keep", "1");
});

test("ausgewählter Bereich bleibt nach Schreibzugriff mit fehlgeschlagener Aktualisierung, ohne Schreibwiederholung", async ({ page }) => {
  await page.goto(ISSUE("DEMO-1?bereich=zeit"));
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("tab", { name: "Zeit", selected: true })).toBeVisible();
  const before = await detailReads(page, "DEMO-1");
  await setRule(page, { "DEMO-1": { status: 503 } });

  await drawer.getByRole("button", { name: "30m", exact: true }).click();
  await drawer.getByRole("button", { name: "Zeit erfassen" }).click();
  await expect.poll(() => detailReads(page, "DEMO-1"), { timeout: 15_000 }).toBeGreaterThanOrEqual(before + 3);
  await expect(drawer.getByRole("tab", { name: "Zeit", selected: true })).toBeVisible();
  expect(await page.evaluate(() => window.__qa.writes.length)).toBe(1);

  await page.keyboard.press("Escape");
  await expect(refreshNotice(page)).toBeVisible();
  await expect(title(page)).toHaveText(DEMO_1);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__qa.writes.length)).toBe(1);
});

test("Ticketwechsel zeigt weder Inhalt noch Fehler des vorherigen Tickets", async ({ page }) => {
  await page.goto(ISSUE("DEMO-1"));
  await expect(title(page)).toHaveText(DEMO_1);
  await setRule(page, { "DEMO-1": { status: 503 }, "DEMO-2": { delayMs: 1500 } });
  await refreshFromMenu(page);
  await expect(refreshNotice(page)).toBeVisible();

  await page.getByRole("group", { name: "blocks", exact: true }).getByRole("link", { name: /DEMO-2/ }).click();
  await expect(page.getByLabel("Ticket wird geladen")).toBeVisible();
  await expect(title(page)).toHaveCount(0);
  await expect(refreshNotice(page)).toHaveCount(0);
  await expect(title(page)).toHaveText(DEMO_2);

  await page.goBack();
  await expect(title(page)).toHaveText(DEMO_1);
  await setRule(page, { "DEMO-1": { status: 503 }, "DEMO-3": { status: 404 } });
  await page.getByRole("group", { name: "is blocked by", exact: true }).getByRole("link", { name: /DEMO-3/ }).click();
  const error = alertWith(page, "Ticket nicht gefunden");
  await expect(error).toContainText("DEMO-3");
  await expect(title(page)).toHaveCount(0);
  await expect(refreshNotice(page)).toHaveCount(0);
});

test("langsames Laden zeigt den Platzhalter in Ticketform", async ({ page }) => {
  await initialRule(page, { "DEMO-1": { delayMs: 2500 } });
  await page.goto(ISSUE("DEMO-1"));
  await expect(page.getByLabel("Ticket wird geladen")).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: /Ticket|Aktualisierung|Jira/ })).toHaveCount(0);
  await expect(title(page)).toHaveText(DEMO_1);
  await expect(page.getByLabel("Ticket wird geladen")).toHaveCount(0);
});

test("ohne Sitzung erscheint die Anmeldung, nicht ein Ticketfehler", async ({ page }) => {
  await page.goto(ISSUE("DEMO-1", "scenario=calendar-offline&"));
  await expect(loginPrompt(page)).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: /Ticket|Aktualisierung|Jira/ })).toHaveCount(0);
  expect(await detailReads(page, "DEMO-1")).toBe(0);
});

test("Sitzungsfehler ist keine Abmeldung und Retry öffnet das Ticket", async ({ page }) => {
  await page.goto(ISSUE("DEMO-1", "scenario=session-error&"));
  const error = alertWith(page, "Anmeldung konnte nicht geprüft werden");
  await expect(error).toContainText("keine Abmeldung");
  await expect(loginPrompt(page)).toHaveCount(0);

  await page.evaluate(() => {
    window.__qa.sessionFailure = false;
  });
  await retry(page, error).click();
  await expect(title(page)).toHaveText(DEMO_1);
});

test("Retry und manuelle Aktualisierung lösen jeweils genau einen Abruf aus", async ({ page }) => {
  await initialRule(page, { "DEMO-1": { status: 403 } });
  await page.goto(ISSUE("DEMO-1"));
  const error = alertWith(page, "Kein Zugriff auf dieses Ticket");
  await expect(error).toBeVisible();
  const first = await detailReads(page, "DEMO-1");

  await setRule(page, { "DEMO-1": { delayMs: 1200 } });
  await retry(page, error).evaluate((button) => {
    if (!(button instanceof HTMLButtonElement)) throw new Error("Kein Button");
    button.click();
    button.click();
  });
  await expect(retry(page, error)).toBeDisabled();
  await expect(retry(page, error)).toHaveAttribute("aria-busy", "true");
  await expect(title(page)).toHaveText(DEMO_1);
  expect(await detailReads(page, "DEMO-1")).toBe(first + 1);

  await setRule(page, { "DEMO-1": { delayMs: 2500 } });
  await refreshFromMenu(page);
  await page.getByRole("button", { name: "Weitere Ticketaktionen" }).click();
  await expect(page.getByRole("menuitem", { name: "Wird aktualisiert …" })).toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Escape");
  await expect.poll(() => detailReads(page, "DEMO-1")).toBe(first + 2);
  await page.waitForTimeout(1500);
  expect(await detailReads(page, "DEMO-1")).toBe(first + 2);
});

test("Tastatur und 390 px: Retry erreichbar, groß genug und nicht überdeckt", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(ISSUE("DEMO-1"));
  await expect(title(page)).toHaveText(DEMO_1);
  await setRule(page, { "DEMO-1": { status: 503 } });

  const trigger = page.getByRole("button", { name: "Weitere Ticketaktionen" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const item = page.getByRole("menuitem", { name: "Aktualisieren" });
  await expect(item).toBeVisible();
  await item.focus();
  await page.keyboard.press("Enter");

  const notice = refreshNotice(page);
  const button = retry(page, notice);
  await expect(button).toBeVisible();
  await settle(page);
  const box = await button.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  expect(box.height).toBeGreaterThanOrEqual(32);
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const hit = await button.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return !!target && element.contains(target);
  });
  expect(hit).toBe(true);
  await shot(page, testInfo, "390-aktualisierungsfehler");

  await setRule(page, {});
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(notice).toHaveCount(0);
  await expect(title(page)).toHaveText(DEMO_1);
});
