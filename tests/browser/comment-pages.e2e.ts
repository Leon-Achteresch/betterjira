import { expect, test, type Page, type TestInfo } from "@playwright/test";

type PageRead = { key: string; startAt: number; maxResults: number; orderBy: string | null };
type QaState = {
  commentPageReads: PageRead[];
  writes: { path: string; method: string }[];
  commands: string[];
  delayMs: number;
};
type QaWindow = { __qa: QaState; __qaCommentFail?: boolean; __qaEditorRef?: Element };

const ISSUE = (key: string, scenario = "comment-pages") =>
  `/tests/browser/fixture.html?scenario=${scenario}&route=/issue/${key}`;
const section = (page: Page) =>
  page.locator("section").filter({ has: page.getByRole("heading", { name: /^Kommentare/ }) });
const items = (page: Page) => section(page).locator("ol > li");
const progress = (page: Page) => section(page).locator('p[role="status"]');
const more = (page: Page) => section(page).getByRole("button", { name: "Weitere Kommentare laden" });
const editor = (page: Page) => page.getByRole("textbox", { name: "Kommentar" });
const qa = (page: Page) => page.evaluate(() => (window as unknown as QaWindow).__qa);
const startsOf = async (page: Page, key = "DEMO-1") =>
  (await qa(page)).commentPageReads.filter((read) => read.key === key).map((read) => read.startAt);

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  const dir = process.env.COMMENT_PAGES_SHOTS;
  if (!dir) return;
  await progress(page).scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check("14px 'Geist Variable'"))).toBe(true);
  await expect.poll(() => section(page).locator('ol > li, [role="alert"]').evaluateAll(
    (nodes) => nodes.every((node) => getComputedStyle(node).opacity === "1" && getComputedStyle(node).transform === "none"),
  )).toBe(true);
  await page.screenshot({ path: `${dir}/${testInfo.project.name}-${name}.png` });
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("lädt beim Öffnen keine weiteren Seiten und zeigt geladen/gesamt", async ({ page }) => {
  await page.goto(ISSUE("DEMO-1", "default"));
  await expect(items(page)).toHaveCount(2);
  await expect(progress(page)).toHaveCount(0);
  await expect(more(page)).toHaveCount(0);

  await page.goto(ISSUE("DEMO-1"));
  await expect(section(page).getByRole("heading", { name: "Kommentare · 7" })).toBeVisible();
  await expect(items(page)).toHaveCount(2);
  await expect(progress(page)).toHaveText("2 von 7 Kommentaren geladen");
  await expect(more(page)).toBeVisible();
  await page.waitForTimeout(800);
  expect((await qa(page)).commentPageReads).toEqual([]);
});

test("lädt mehrere, auch kürzere Seiten mit Duplikaten lückenlos nach", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Object.assign(window, {
      __qaCommentPagesRule: (_key: string, startAt: number) => (startAt === 2 ? { startAt: 1, pageSize: 3 } : { pageSize: 2 }),
    });
  });
  await page.goto(ISSUE("DEMO-1"));
  await expect(items(page)).toHaveCount(2);

  await more(page).click();
  await expect(items(page)).toHaveCount(4);
  await expect(progress(page)).toHaveText("4 von 7 Kommentaren geladen");
  expect((await qa(page)).commentPageReads[0]).toEqual({ key: "DEMO-1", startAt: 2, maxResults: 50, orderBy: "created" });

  await more(page).click();
  await expect(items(page)).toHaveCount(6);
  await expect(progress(page)).toHaveText("6 von 7 Kommentaren geladen");

  await more(page).click();
  await expect(items(page)).toHaveCount(7);
  await expect(progress(page)).toHaveText("Alle 7 Kommentare geladen");
  await expect(more(page)).toHaveCount(0);

  const texts = await items(page).allTextContents();
  for (const index of [3, 4, 5, 6, 7]) expect(texts.filter((text) => text.includes(`Verlaufseintrag ${index}:`))).toHaveLength(1);
  expect(texts.findIndex((text) => text.includes("Verlaufseintrag 3:"))).toBeLessThan(
    texts.findIndex((text) => text.includes("Verlaufseintrag 7:")),
  );
  expect(await startsOf(page)).toEqual([2, 4, 6]);
  await shot(page, testInfo, "alle-geladen");

  await section(page).getByRole("button", { name: "Älteste zuerst" }).click();
  await expect(items(page).first()).toContainText("Verlaufseintrag 7:");
  await expect(items(page)).toHaveCount(7);
});

test("kurze Seiten ohne Gesamtzahl enden nicht vorzeitig; eine neuere Gesamtzahl wird übernommen", async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, {
      __qaCommentPagesRule: (_key: string, startAt: number) => ({ pageSize: 1, maxResults: 50, total: startAt === 2 ? null : startAt === 3 ? 10 : 1 }),
    });
  });
  await page.goto(ISSUE("DEMO-1"));
  await more(page).click();
  await expect(items(page)).toHaveCount(3);
  await expect(more(page)).toBeVisible();
  await more(page).click();
  await expect(items(page)).toHaveCount(4);
  await expect(progress(page)).toHaveText("4 von 10 Kommentaren geladen");
  await expect(section(page).getByRole("heading", { name: "Kommentare · 10" })).toBeVisible();
  await more(page).click();
  await expect(items(page)).toHaveCount(5);
  await expect(progress(page)).toHaveText("5 von 10 Kommentaren geladen");
  await expect(more(page)).toBeVisible();
  expect(await startsOf(page)).toEqual([2, 3, 4]);
});

test("fehlendes optionales comments-Feld gilt als leere Seite und benennt eine Lücke", async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { __qaCommentPagesRule: () => ({ omitComments: true }) });
  });
  await page.goto(ISSUE("DEMO-1"));
  await more(page).click();
  await expect(progress(page)).toHaveText("2 von 7 Kommentaren geladen · Jira liefert keine weiteren");
  await expect(items(page)).toHaveCount(2);
  await expect(section(page).getByRole("alert")).toHaveCount(0);
});

test("leere Seite vor der Gesamtzahl wird als Lücke benannt", async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { __qaCommentPagesRule: () => ({ comments: [] }) });
  });
  await page.goto(ISSUE("DEMO-1"));
  await more(page).click();
  await expect(progress(page)).toHaveText("2 von 7 Kommentaren geladen · Jira liefert keine weiteren");
  await expect(more(page)).toHaveCount(0);
  await expect(items(page)).toHaveCount(2);
});

test("Fehler beim Nachladen behält geladene Kommentare und lädt per Retry", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    Object.assign(window, {
      __qaCommentPagesRule: () => ((window as unknown as QaWindow).__qaCommentFail ? { status: 503 } : { pageSize: 2 }),
    });
  });
  await page.goto(ISSUE("DEMO-1"));
  await more(page).click();
  await expect(items(page)).toHaveCount(4);

  await page.evaluate(() => {
    (window as unknown as QaWindow).__qaCommentFail = true;
  });
  await more(page).click();
  const alert = section(page).getByRole("alert");
  await expect(alert).toContainText("Weitere Kommentare konnten nicht geladen werden.");
  await expect(alert).toContainText("Test: Jira antwortet mit 503");
  await expect(items(page)).toHaveCount(4);
  await expect(progress(page)).toHaveText("4 von 7 Kommentaren geladen");
  await shot(page, testInfo, "fehler");

  await page.evaluate(() => {
    (window as unknown as QaWindow).__qaCommentFail = false;
  });
  await section(page).getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(items(page)).toHaveCount(6);
  await expect(alert).toHaveCount(0);
  await expect(more(page)).toBeVisible();
});

test("Offline wartet der Abruf erkennbar und setzt ohne doppelten Request fort", async ({ page }) => {
  await page.goto(ISSUE("DEMO-1"));
  await editor(page).fill("Entwurf bleibt auch offline");
  await page.evaluate(() => {
    Object.defineProperty(Navigator.prototype, "onLine", { configurable: true, get: () => false });
    window.dispatchEvent(new Event("offline"));
  });
  await more(page).click();
  const waiting = section(page).getByRole("button", { name: "Wartet auf Verbindung" });
  await expect(waiting).toHaveAttribute("aria-disabled", "true");
  await expect(waiting).toHaveAttribute("aria-busy", "false");
  await expect(progress(page)).toContainText("Offline, Abruf wartet auf Verbindung");
  await page.keyboard.press("Enter");
  expect(await startsOf(page)).toEqual([]);
  await page.evaluate(() => {
    Object.defineProperty(Navigator.prototype, "onLine", { configurable: true, get: () => true });
    window.dispatchEvent(new Event("online"));
  });
  await expect(items(page)).toHaveCount(7);
  expect(await startsOf(page)).toEqual([2]);
  await expect(editor(page)).toHaveValue("Entwurf bleibt auch offline");
});

test("Ticketwechsel bricht das Nachladen ab und zeigt keine fremden Kommentare", async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { __qaCommentPagesRule: (key: string) => (key === "DEMO-1" ? { delayMs: 2000 } : {}) });
  });
  await page.goto(ISSUE("DEMO-1"));
  await more(page).click();
  await expect(more(page)).toHaveAttribute("aria-busy", "true");

  await page.locator("section").filter({ has: page.getByRole("heading", { name: /^Verknüpfungen/ }) })
    .getByRole("group", { name: "blocks", exact: true })
    .getByRole("link", { name: /DEMO-2/ })
    .click();
  await expect(page).toHaveURL(/\/issue\/DEMO-2$/);
  await expect(items(page)).toHaveCount(2);
  await page.waitForTimeout(2500);
  await expect(section(page)).not.toContainText("Verlaufseintrag");
  await expect(progress(page)).toHaveCount(0);
  expect((await qa(page)).commands.some((command) => command.startsWith("plugin:http|fetch_cancel"))).toBe(true);

  await page.goBack();
  await expect(page).toHaveURL(/\/issue\/DEMO-1$/);
  await expect(items(page)).toHaveCount(2);
  await expect(progress(page)).toHaveText("2 von 7 Kommentaren geladen");
  await expect(more(page)).not.toHaveAttribute("aria-busy", "true");
  expect(await startsOf(page)).toEqual([2]);
  expect(await startsOf(page, "DEMO-2")).toEqual([]);
});

test("Nachladen behält Editor und Entwurf, Senden schreibt genau einmal", async ({ page }) => {
  await page.goto(ISSUE("DEMO-1"));
  await editor(page).fill("QA: Nachladen mit offenem Entwurf");
  await editor(page).evaluate((element) => {
    (window as unknown as QaWindow).__qaEditorRef = element;
  });

  await more(page).click();
  await expect(items(page)).toHaveCount(7);
  await expect(progress(page)).toHaveText("Alle 7 Kommentare geladen");
  await expect(editor(page)).toHaveValue("QA: Nachladen mit offenem Entwurf");
  expect(await editor(page).evaluate((element) => element === (window as unknown as QaWindow).__qaEditorRef)).toBe(true);

  await page.evaluate(() => {
    (window as unknown as QaWindow).__qa.delayMs = 400;
  });
  await editor(page).focus();
  await page.keyboard.press("Control+Enter");
  await page.keyboard.press("Control+Enter");
  await expect(items(page)).toHaveCount(8);
  await expect(section(page)).toContainText("QA: Nachladen mit offenem Entwurf");
  await expect(progress(page)).toHaveText("Alle 8 Kommentare geladen");
  await expect(section(page).getByRole("heading", { name: "Kommentare · 8" })).toBeVisible();
  await expect(editor(page)).toHaveValue("");
  expect(await editor(page).evaluate((element) => element === (window as unknown as QaWindow).__qaEditorRef)).toBe(true);
  const writes = (await qa(page)).writes.filter((write) => write.path.endsWith("/comment"));
  expect(writes).toHaveLength(1);
});

test("fehlgeschlagene Aktualisierung nach dem Senden bleibt sichtbar und Retry lädt vorhandene Seiten neu", async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, {
      __qaCommentPagesRule: () => ((window as unknown as QaWindow).__qaCommentFail ? { status: 503 } : {}),
    });
  });
  await page.goto(ISSUE("DEMO-1"));
  await more(page).click();
  await expect(items(page)).toHaveCount(7);
  await page.evaluate(() => { (window as unknown as QaWindow).__qaCommentFail = true; });
  await editor(page).fill("QA: geschrieben, aber Aktualisierung fehlgeschlagen");
  await editor(page).focus();
  await page.keyboard.press("Control+Enter");
  await expect(section(page).getByRole("alert")).toContainText("Test: Jira antwortet mit 503");
  await expect(editor(page)).toHaveValue("");
  await expect(items(page)).toHaveCount(7);
  await expect(progress(page)).toHaveText("7 von 8 Kommentaren geladen");
  await page.evaluate(() => { (window as unknown as QaWindow).__qaCommentFail = false; });
  await section(page).getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(items(page)).toHaveCount(8);
  await expect(progress(page)).toHaveText("Alle 8 Kommentare geladen");
  await expect(section(page).getByRole("alert")).toHaveCount(0);
  expect((await qa(page)).writes.filter((write) => write.path.endsWith("/comment"))).toHaveLength(1);
});

test("Tastatur und 390 px dunkel ohne Seitenüberlauf", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.addInitScript(() => {
    Object.assign(window, { __qaCommentPagesRule: () => ({ pageSize: 2 }) });
  });
  await page.goto(ISSUE("DEMO-1"));
  const button = more(page);
  await button.scrollIntoViewIfNeeded();
  expect((await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(32);

  await button.focus();
  await page.keyboard.press("Enter");
  await expect(items(page)).toHaveCount(4);
  await expect(button).toBeFocused();
  await page.keyboard.press("Space");
  await expect(items(page)).toHaveCount(6);
  await expect(button).toBeFocused();
  await shot(page, testInfo, "390-dunkel");
  await page.keyboard.press("Enter");
  await expect(items(page)).toHaveCount(7);
  await expect(progress(page)).toHaveText("Alle 7 Kommentare geladen");
  await expect(progress(page)).toBeFocused();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
