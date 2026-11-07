import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __qa: { writes: unknown[]; searches: string[]; outlook: { calls: { action: string }[] } };
    __qaRolloutWrites: number;
  }
}

type StoredRollout = {
  id: string;
  title: string;
  start: string;
  end: string;
  notes: string;
  issues: { key: string; summary: string }[];
  siteUrl: string;
  reminderMinutes: number;
  outlookEventId: string | null;
  outlookAccountId: string | null;
  outlookWebLink: string | null;
};

const storageKey = "betterjira:calendar:rollouts:v1";
const originalId = "00000000-0000-4000-8000-000000000101";
const foreignId = "00000000-0000-4000-8000-000000000102";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const countRolloutWrites = (page: Page) =>
  page.addInitScript((key) => {
    window.__qaRolloutWrites = 0;
    const { setItem, removeItem } = Storage.prototype;
    Storage.prototype.setItem = function (name, value) {
      if (name === key || name.startsWith("betterjira:calendar:outlook")) window.__qaRolloutWrites += 1;
      return setItem.call(this, name, value);
    };
    Storage.prototype.removeItem = function (name) {
      if (name === key || name.startsWith("betterjira:calendar:outlook")) window.__qaRolloutWrites += 1;
      return removeItem.call(this, name);
    };
  }, storageKey);

const open = async (page: Page) => {
  await countRolloutWrites(page);
  await page.goto("/tests/browser/fixture.html?scenario=rollout-duplicate&route=/kalender");
  await expect(page.getByRole("heading", { name: "Kalender", exact: true })).toBeVisible();
  await expect(article(page, "Produktion Release 2.4")).toBeVisible();
  await expect(article(page, "Produktion Release 2.4").getByText("In Outlook eingetragen", { exact: true })).toBeVisible();
};

const agenda = (page: Page) => page.getByRole("region", { name: "Tagesagenda" });
const article = (page: Page, title: string) => agenda(page).locator("article").filter({ has: page.getByRole("heading", { name: title, exact: true, level: 3 }) });
const moreButton = (page: Page, title: string) => article(page, title).getByRole("button", { name: "Weitere Aktionen", exact: true });
const dialog = (page: Page) => page.getByRole("dialog");

const stored = (page: Page) =>
  page.evaluate((key): StoredRollout[] => JSON.parse(localStorage.getItem(key) ?? "[]"), storageKey);

const snapshot = (page: Page) =>
  page.evaluate((key) => ({
    raw: localStorage.getItem(key),
    storageWrites: window.__qaRolloutWrites,
    outlookWrites: window.__qa.outlook.calls.filter((call) => call.action !== "account" && call.action !== "list").length,
    jiraWrites: window.__qa.writes.length,
    searches: window.__qa.searches.length,
  }), storageKey);

const openDuplicate = async (page: Page, title: string) => {
  await moreButton(page, title).click();
  await page.getByRole("menuitem", { name: "Als Vorlage duplizieren", exact: true }).click();
  await expect(dialog(page).getByRole("heading", { name: "Rollout duplizieren", exact: true })).toBeVisible();
};

const settle = (page: Page) =>
  page.evaluate(async () => {
    await document.fonts.load('16px "Geist Variable"');
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    );
    return {
      loaded: [...document.fonts].some((face) => face.family.includes("Geist") && face.status === "loaded"),
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      dark: document.documentElement.classList.contains("dark"),
    };
  });

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.clock.setFixedTime(new Date("2026-11-06T12:00:00.000Z"));
});

test("Duplizieren öffnet einen vorbefüllten Entwurf und schreibt vor dem Speichern nichts", async ({ page }) => {
  await open(page);
  const before = await snapshot(page);
  await openDuplicate(page, "Produktion Release 2.4");
  const form = dialog(page);
  await expect(form.getByLabel("Titel", { exact: true })).toHaveValue("Produktion Release 2.4 (Kopie)");
  await expect(form.getByLabel("Beginn", { exact: true })).toHaveValue("2026-11-06");
  await expect(form.getByLabel("Uhrzeit Beginn", { exact: true })).toHaveValue("14:00");
  await expect(form.getByLabel("Ende", { exact: true })).toHaveValue("2026-11-06");
  await expect(form.getByLabel("Uhrzeit Ende", { exact: true })).toHaveValue("15:30");
  await expect(form.getByLabel("Notizen", { exact: true })).toHaveValue("Monitoring beobachten\nRollback vorbereiten");
  await expect(form.getByLabel("Erinnerung", { exact: true })).toContainText("1 Stunde vorher");
  await expect(form.getByRole("button", { name: "DEMO-1 entfernen", exact: true })).toBeVisible();
  await expect(form.getByText("Outlook-Verknüpfungen werden nicht übernommen.", { exact: false })).toBeVisible();
  await expect(form.getByRole("button", { name: "Anlegen", exact: true })).toBeVisible();
  expect(await snapshot(page)).toMatchObject({ raw: before.raw, storageWrites: before.storageWrites, outlookWrites: 0, jiraWrites: 0 });

  await form.getByLabel("Titel", { exact: true }).fill("Verworfene Kopie");
  await form.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(await snapshot(page)).toMatchObject({ raw: before.raw, storageWrites: before.storageWrites, outlookWrites: 0, jiraWrites: 0 });
  await expect(agenda(page).locator("article")).toHaveCount(2);

  await openDuplicate(page, "Produktion Release 2.4");
  await expect(dialog(page).getByLabel("Titel", { exact: true })).toHaveValue("Produktion Release 2.4 (Kopie)");
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  expect(await snapshot(page)).toMatchObject({ raw: before.raw, storageWrites: before.storageWrites, outlookWrites: 0, jiraWrites: 0 });
});

test("Speichern legt genau einen neuen lokalen Rollout an, das Original bleibt unverändert", async ({ page }) => {
  await open(page);
  const [original] = (await stored(page)).filter((row) => row.id === originalId);
  const before = await snapshot(page);
  await openDuplicate(page, "Produktion Release 2.4");
  await dialog(page).locator("form").evaluate((form: HTMLFormElement) => {
    form.requestSubmit();
    form.requestSubmit();
  });
  await expect(dialog(page)).toHaveCount(0);
  await expect(article(page, "Produktion Release 2.4 (Kopie)")).toBeVisible();

  const rows = await stored(page);
  expect(rows).toHaveLength(3);
  expect(rows.find((row) => row.id === originalId)).toEqual(original);
  const copies = rows.filter((row) => row.id !== originalId && row.id !== foreignId);
  expect(copies).toHaveLength(1);
  const [copy] = copies;
  expect(copy.id).toMatch(uuid);
  expect(copy).toEqual({
    ...original,
    id: copy.id,
    title: "Produktion Release 2.4 (Kopie)",
    outlookEventId: null,
    outlookAccountId: null,
    outlookWebLink: null,
  });

  const after = await snapshot(page);
  expect(after.storageWrites - before.storageWrites).toBe(1);
  expect(after).toMatchObject({ outlookWrites: 0, jiraWrites: 0 });
  await expect(article(page, "Produktion Release 2.4 (Kopie)").getByText("Nur lokal", { exact: true })).toBeVisible();
  await expect(article(page, "Produktion Release 2.4").getByText("In Outlook eingetragen", { exact: true })).toBeVisible();
  await expect(page.getByText("Rollout angelegt", { exact: true })).toBeVisible();
});

test("Kopie eines Rollouts einer fremden Jira-Site bleibt ehrlich und startet keine Ticketsuche", async ({ page }) => {
  await open(page);
  const before = await snapshot(page);
  await openDuplicate(page, "Partner-Rollout");
  const form = dialog(page);
  await expect(form.getByText("Dieser Rollout gehört zu einer anderen Jira-Site.", { exact: false })).toBeVisible();
  await expect(form.getByRole("button", { name: "EXT-4 entfernen", exact: true })).toBeVisible();
  await expect(form.getByRole("searchbox", { name: "Tickets suchen", exact: true })).toHaveCount(0);
  expect((await snapshot(page)).searches).toBe(before.searches);

  await form.getByRole("button", { name: "Anlegen", exact: true }).click();
  await expect(dialog(page)).toHaveCount(0);
  const copy = (await stored(page)).find((row) => row.title === "Partner-Rollout (Kopie)");
  expect(copy).toMatchObject({
    siteUrl: "https://andere-firma.example.atlassian.net",
    issues: [{ key: "EXT-4", summary: "QA-Testticket der fremden Site" }],
    reminderMinutes: 1440,
    outlookEventId: null,
  });
  expect(copy?.id).not.toBe(foreignId);
  expect(await snapshot(page)).toMatchObject({ searches: before.searches, outlookWrites: 0, jiraWrites: 0 });
});

test("Weitere Aktionen sind per Tastatur erreichbar, haben Tooltip und 32 px Trefferfläche", async ({ page }) => {
  await open(page);
  const before = await snapshot(page);
  const trigger = moreButton(page, "Produktion Release 2.4");
  await trigger.scrollIntoViewIfNeeded();
  await settle(page);
  const hits = await trigger.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const hit = (x: number, y: number) => document.elementFromPoint(x, y)?.closest("button") === button;
    const buttons = [...(button.parentElement?.querySelectorAll("button") ?? [])].map((item) => item.getBoundingClientRect());
    return {
      top: hit(centerX, rect.top + 2),
      bottom: hit(centerX, rect.bottom - 2),
      right: hit(rect.right - 2, centerY),
      width: rect.width,
      height: rect.height,
      left: rect.left,
      topEdge: rect.top,
      rightEdge: rect.right,
      bottomEdge: rect.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      separated: buttons.every((item, index) => index === 0 || buttons[index - 1].right <= item.left),
    };
  });
  expect(hits).toMatchObject({ top: true, bottom: true, right: true, separated: true });
  expect(hits.width).toBeGreaterThanOrEqual(32);
  expect(hits.height).toBeGreaterThanOrEqual(32);
  expect(hits.left).toBeGreaterThanOrEqual(0);
  expect(hits.topEdge).toBeGreaterThanOrEqual(0);
  expect(hits.rightEdge).toBeLessThanOrEqual(hits.viewportWidth);
  expect(hits.bottomEdge).toBeLessThanOrEqual(hits.viewportHeight);

  await trigger.hover();
  await expect(page.getByText("Weitere Aktionen", { exact: true })).toBeVisible();
  await page.mouse.move(0, 0);
  await trigger.focus();
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Enter");
  const item = page.getByRole("menuitem", { name: "Als Vorlage duplizieren", exact: true });
  await expect(item).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog(page).getByRole("heading", { name: "Rollout duplizieren", exact: true })).toBeVisible();
  await expect(dialog(page).getByLabel("Titel", { exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  expect(await snapshot(page)).toMatchObject({ raw: before.raw, storageWrites: before.storageWrites, outlookWrites: 0 });

  await article(page, "Partner-Rollout").getByRole("button", { name: "Bearbeiten", exact: true }).click();
  await expect(dialog(page).getByRole("heading", { name: "Rollout bearbeiten", exact: true })).toBeVisible();
  await dialog(page).getByRole("button", { name: "Abbrechen", exact: true }).click();
  await expect(dialog(page)).toHaveCount(0);
});

for (const scheme of ["light", "dark"] as const) {
  test(`390 px ${scheme === "light" ? "hell" : "dunkel"}: Menü und Dialog ohne Seitenüberlauf`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Eigene Breite und eigenes Schema");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: scheme });
    await open(page);
    const label = scheme === "light" ? "hell" : "dunkel";
    const dir = process.env.ROLLOUT_DUPLICATE_SHOTS;

    await article(page, "Produktion Release 2.4").scrollIntoViewIfNeeded();
    await moreButton(page, "Produktion Release 2.4").click();
    await expect(page.getByRole("menuitem", { name: "Als Vorlage duplizieren", exact: true })).toBeVisible();
    const menuState = await settle(page);
    expect(menuState.loaded).toBe(true);
    expect(menuState.overflow).toBeLessThanOrEqual(0);
    expect(menuState.dark).toBe(scheme === "dark");
    const menuBox = await page.getByRole("menu").boundingBox();
    expect(menuBox && menuBox.x >= 0 && menuBox.x + menuBox.width <= 390).toBe(true);
    if (dir) await page.screenshot({ path: `${dir}/390-${label}-menue.png` });

    await page.getByRole("menuitem", { name: "Als Vorlage duplizieren", exact: true }).click();
    await expect(dialog(page).getByLabel("Titel", { exact: true })).toHaveValue("Produktion Release 2.4 (Kopie)");
    const dialogState = await settle(page);
    expect(dialogState.overflow).toBeLessThanOrEqual(0);
    const dialogBox = await dialog(page).boundingBox();
    expect(dialogBox && dialogBox.x >= 0 && dialogBox.x + dialogBox.width <= 390).toBe(true);
    await page.mouse.move(0, 0);
    if (dir) await page.screenshot({ path: `${dir}/390-${label}-dialog.png` });
    await dialog(page).getByRole("button", { name: "Abbrechen", exact: true }).click();
    await expect(dialog(page)).toHaveCount(0);
  });
}

test("Desktop hell: Rollout mit Weitere-Aktionen-Menü", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Nur Desktop-Aufnahme");
  await page.emulateMedia({ colorScheme: "light" });
  await open(page);
  await moreButton(page, "Produktion Release 2.4").click();
  await expect(page.getByRole("menuitem", { name: "Als Vorlage duplizieren", exact: true })).toBeVisible();
  const state = await settle(page);
  expect(state.loaded).toBe(true);
  expect(state.overflow).toBeLessThanOrEqual(0);
  const dir = process.env.ROLLOUT_DUPLICATE_SHOTS;
  if (dir) await page.screenshot({ path: `${dir}/desktop-hell-menue.png` });
});
