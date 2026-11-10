import { expect, test, type Page, type TestInfo } from "@playwright/test";

declare global {
  interface Window {
    __qaMyselfGate?: Promise<void>;
    __qaReleaseMyselfGate?: () => void;
    __qaSearchRule?: (jql: string) => { keys?: string[] };
    __qaMyselfRule?: () => { delayMs?: number; status?: number };
    __qaIssueRule?: (key: string) => { delayMs?: number; status?: number };
  }
}

const STORAGE_KEY = "betterjira-issue-tabs";
const scope = (cloud: string, account: string) => JSON.stringify([cloud, account]);
const A = scope("qa-cloud", "qa-user");
const B = scope("qa-cloud-b", "qa-user");
const LEGACY_LABEL = "3 frühere Tabs ohne Konto, übernehmen oder verwerfen";

type Open = { route?: string; cloud?: string; account?: string; scenario?: string };

const open = (page: Page, { route = "/issue/DEMO-1", cloud, account, scenario }: Open = {}) => {
  const params = new URLSearchParams({ route });
  if (cloud) params.set("cloud", cloud);
  if (account) params.set("account", account);
  if (scenario) params.set("scenario", scenario);
  return page.goto(`/tests/browser/fixture.html?${params}`);
};

const header = (page: Page) => page.locator("header").first();
const tabs = (page: Page) => page.getByRole("tablist", { name: "Geöffnete Tickets" }).getByRole("tab");
const offer = (page: Page) => header(page).getByRole("button", { name: LEGACY_LABEL });
const raw = (page: Page) => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
const stored = async (page: Page) => JSON.parse((await raw(page)) ?? "null")?.state;
const issueTitle = (page: Page, title: string) => page.getByRole("main").getByRole("heading", { level: 1, name: title });

const undo = (page: Page, text: string) =>
  page.locator("[data-sonner-toast]").filter({ hasText: text }).getByRole("button", { name: "Rückgängig" }).click();

const seed = (page: Page, workspaces: Record<string, { keys: string[]; pinned: string[] }>) =>
  page.addInitScript(
    ({ key, value }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, value);
    },
    { key: STORAGE_KEY, value: JSON.stringify({ state: { workspaces }, version: 0 }) },
  );

const logout = async (page: Page) => {
  await header(page).getByRole("button", { name: "Suchen" }).click();
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await palette.getByRole("combobox").fill("Abmelden");
  await palette.getByRole("option", { name: /Abmelden/ }).click();
};

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  const dir = process.env.ISSUE_TAB_SCOPE_SHOTS;
  if (!dir) return;
  expect(await page.evaluate(async () => {
    await document.fonts.load('12px "Geist Variable"');
    await document.fonts.ready;
    return [...document.fonts].some((face) => face.family.includes("Geist") && face.status === "loaded");
  })).toBe(true);
  await page.waitForFunction(() => document.getAnimations().filter((animation) => animation.effect?.getTiming().iterations !== Infinity).every((animation) => animation.playState !== "running"));
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: `${dir}/${testInfo.project.name}-${name}.png`, animations: "disabled" });
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("A, B und zurück zu A: Tabs bleiben je Konto und Instanz getrennt, gleicher Schlüssel inklusive", async ({ page }) => {
  await open(page);
  await expect(tabs(page)).toHaveText([/^DEMO-1/]);
  await open(page, { route: "/issue/DEMO-2" });
  await expect(tabs(page)).toHaveText([/^DEMO-1/, /^DEMO-2/]);
  await tabs(page).nth(1).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Anheften" }).click();
  await expect(tabs(page)).toHaveText([/^DEMO-2$/, /^DEMO-1/]);

  await open(page, { cloud: "qa-cloud-b" });
  await expect(tabs(page)).toHaveText([/^DEMO-1/]);
  await expect(tabs(page).getByText("DEMO-2")).toHaveCount(0);
  expect((await stored(page)).workspaces[B]).toEqual({ keys: ["DEMO-1"], pinned: [] });

  await open(page, { route: "/" });
  await expect(tabs(page)).toHaveText([/^DEMO-2$/, /^DEMO-1/]);
  expect((await stored(page)).workspaces[A]).toEqual({ keys: ["DEMO-1", "DEMO-2"], pinned: ["DEMO-2"] });
});

test("Zwei Konten derselben Instanz übernehmen weder Tabs noch Pins voneinander", async ({ page }) => {
  const colleague = scope("qa-cloud", "qa-colleague");
  await open(page);
  await expect(tabs(page)).toHaveCount(1);
  await tabs(page).first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "Anheften" }).click();
  expect((await stored(page)).workspaces[A].pinned).toEqual(["DEMO-1"]);
  await open(page, { route: "/", account: "qa-colleague" });
  await expect(header(page).getByRole("button", { name: "Suchen" })).toBeVisible();
  await expect(tabs(page)).toHaveCount(0);
  await open(page, { account: "qa-colleague" });
  await expect(tabs(page)).toHaveText([/^DEMO-1/]);
  expect((await stored(page)).workspaces[colleague]).toEqual({ keys: ["DEMO-1"], pinned: [] });
  await open(page, { route: "/" });
  await expect(tabs(page)).toHaveText([/^DEMO-1$/]);
  expect((await stored(page)).workspaces[A]).toEqual({ keys: ["DEMO-1"], pinned: ["DEMO-1"] });
});

test("Langsame Kontoprüfung zeigt keine Tabs und schreibt nichts, bis das Konto bestätigt ist", async ({ page }, testInfo) => {
  await seed(page, { [A]: { keys: ["DEMO-2", "DEMO-3"], pinned: [] } });
  await page.addInitScript(() => {
    window.__qaMyselfGate = new Promise<void>((resolve) => { window.__qaReleaseMyselfGate = resolve; });
  });
  await open(page);
  await expect(page.getByLabel("Ticket wird geladen")).toBeVisible();
  await expect(issueTitle(page, "Suche für den Arbeitsalltag vereinfachen")).toHaveCount(0);
  const before = await raw(page);
  await expect(tabs(page)).toHaveCount(0);
  await shot(page, testInfo, "pruefung-laeuft");
  expect(await raw(page)).toBe(before);

  await page.evaluate(() => window.__qaReleaseMyselfGate?.());
  await expect(tabs(page)).toHaveText([/^DEMO-2/, /^DEMO-3/, /^DEMO-1/]);
});

test("Fehlgeschlagene Kontoprüfung zeigt keine Tabs und schreibt nichts", async ({ page }) => {
  await seed(page, { [A]: { keys: ["DEMO-2"], pinned: [] } });
  await page.addInitScript(() => {
    window.__qaMyselfRule = () => ({ status: 403 });
  });
  await open(page);
  await expect(page.getByRole("main").getByText("Jira-Konto konnte nicht geprüft werden")).toBeVisible();
  const before = await raw(page);
  await page.keyboard.press("ControlOrMeta+1");
  await expect(tabs(page)).toHaveCount(0);
  expect(await raw(page)).toBe(before);
});

test("Abmelden blendet Tabs aus; Tab-Shortcut und Strg-Klick ändern danach nichts", async ({ page }) => {
  await seed(page, { [A]: { keys: ["DEMO-1", "DEMO-2"], pinned: ["DEMO-2"] } });
  await open(page, { route: "/" });
  await expect(tabs(page)).toHaveCount(2);

  await logout(page);
  await expect(tabs(page)).toHaveCount(0);
  const before = await raw(page);
  await page.keyboard.press("ControlOrMeta+2");
  await page.evaluate(() => {
    const link = document.createElement("a");
    link.href = "/issue/DEMO-3";
    document.body.append(link);
    link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, ctrlKey: true, button: 0 }));
    link.remove();
  });
  expect(await raw(page)).toBe(before);

  await open(page, { route: "/" });
  await expect(tabs(page)).toHaveText([/^DEMO-2$/, /^DEMO-1/]);
});

test("Ein noch offener Pfad aus A landet in B erst nach erfolgreichem Laden", async ({ page }) => {
  await open(page);
  await expect(tabs(page)).toHaveText([/^DEMO-1/]);

  await page.addInitScript(() => {
    window.__qaIssueRule = (key) => (key === "DEMO-1" ? { status: 404 } : key === "DEMO-2" ? { delayMs: 2000 } : {});
  });
  await open(page, { cloud: "qa-cloud-b" });
  await expect(page.getByRole("main").getByRole("alert").first()).toContainText("404");
  await expect(tabs(page)).toHaveCount(0);
  expect((await stored(page))?.workspaces[B]).toBeUndefined();

  await open(page, { cloud: "qa-cloud-b", route: "/issue/DEMO-2" });
  await expect(header(page).getByRole("button", { name: "Suchen" })).toBeVisible();
  expect((await stored(page))?.workspaces[B]).toBeUndefined();
  await expect(tabs(page)).toHaveText([/^DEMO-2/]);
  expect((await stored(page)).workspaces[A]).toEqual({ keys: ["DEMO-1"], pinned: [] });
});

test("Alte globale Tabs bleiben in Quarantäne: übernehmen und verwerfen mit Rückgängig", async ({ page }, testInfo) => {
  await open(page, { route: "/", scenario: "tabs-legacy", cloud: "qa-cloud-b" });
  await expect(offer(page)).toBeVisible();
  await expect(tabs(page)).toHaveCount(0);

  await open(page, { route: "/", scenario: "tabs-legacy" });
  await expect(offer(page)).toBeVisible();
  await expect(tabs(page)).toHaveCount(0);
  expect(await stored(page)).toEqual({ workspaces: {}, legacy: { keys: ["DEMO-3", "DEMO-1", "DEMO-2"], pinned: ["DEMO-1"] } });

  await offer(page).click();
  const popover = page.getByRole("dialog");
  await expect(popover.getByRole("list", { name: "Frühere Tabs" }).getByRole("listitem")).toHaveText(["DEMO-3", "DEMO-1", "DEMO-2"]);
  await shot(page, testInfo, "uebernahme");
  await popover.getByRole("button", { name: "Übernehmen" }).click();
  await expect(tabs(page)).toHaveText([/^DEMO-1$/, /^DEMO-3/, /^DEMO-2/]);
  await expect(offer(page)).toHaveCount(0);

  await undo(page, "übernommen");
  await expect(tabs(page)).toHaveCount(0);
  await expect(offer(page)).toBeVisible();

  await offer(page).click();
  await page.getByRole("dialog").getByRole("button", { name: "Verwerfen" }).click();
  await expect(offer(page)).toHaveCount(0);
  await undo(page, "verworfen");
  await expect(offer(page)).toBeVisible();

  await offer(page).click();
  await page.getByRole("dialog").getByRole("button", { name: "Verwerfen" }).click();
  await expect(offer(page)).toHaveCount(0);
  await open(page, { route: "/", scenario: "tabs-legacy" });
  await expect(header(page).getByRole("button", { name: "Suchen" })).toBeVisible();
  await expect(offer(page)).toHaveCount(0);
  expect((await stored(page)).legacy).toBeUndefined();
});

test("Übernahme per Tastatur über die Command Palette", async ({ page }) => {
  await page.addInitScript(() => { window.__qaSearchRule = () => ({ keys: [] }); });
  await open(page, { route: "/", scenario: "tabs-legacy" });
  await expect(offer(page)).toBeVisible();
  await page.keyboard.press("Control+k");
  await page.keyboard.type("frühere Tabs übernehmen");
  const option = page.getByRole("option", { name: /3 frühere Tabs übernehmen/ });
  await expect(option).toBeVisible();
  await expect(option).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Enter");
  await expect(tabs(page)).toHaveText([/^DEMO-1$/, /^DEMO-3/, /^DEMO-2/]);
  await expect(page.getByRole("dialog", { name: "Command palette", includeHidden: true })).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+2");
  await expect(page).toHaveURL(/\/issue\/DEMO-3$/);
});

test("390 px: Übernahme erreichbar, per Tastatur bedienbar, ohne Überdeckung", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, { route: "/", scenario: "tabs-legacy" });
  await expect(offer(page)).toBeHidden();
  const more = header(page).getByRole("button", { name: "Weitere Aktionen" });
  await more.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu");
  const adopt = menu.getByRole("menuitem", { name: "3 frühere Tabs übernehmen", exact: true });
  await expect(adopt).toBeVisible();
  await expect.poll(async () => (await adopt.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(32);
  const panel = await menu.boundingBox();
  expect(panel!.x).toBeGreaterThanOrEqual(0);
  expect(panel!.x + panel!.width).toBeLessThanOrEqual(390);
  expect(await adopt.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
  })).toBe(true);
  await shot(page, testInfo, "390-uebernahme");
  await adopt.focus();
  await page.keyboard.press("Enter");
  await expect(menu).toHaveCount(0);
  await expect(more).toBeFocused();

  await more.click();
  await expect(page.getByRole("group", { name: "Geöffnete Tickets" }).getByRole("menuitemradio")).toHaveCount(3);
});
