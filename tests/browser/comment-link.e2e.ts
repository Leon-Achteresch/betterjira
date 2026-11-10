import { expect, test, type Page, type TestInfo } from "@playwright/test";

type ClipboardSpy = { calls: string[]; fail: boolean; delayMs: number };

declare global {
  interface Window {
    __qaSiteUrl?: string;
    __qaClipboard: ClipboardSpy;
    __qaCommentDetailLimit?: number;
    __qaCommentPagesRule?: () => { pageSize: number };
  }
}

const SCENARIO = "/tests/browser/fixture.html?scenario=comment-links&route=/issue/DEMO-1";
const MENU = "Weitere Aktionen";
const ITEM = "Link kopieren";
const UNAVAILABLE = "Kein Jira-Link verfügbar: keine gültige Jira-Verbindung";
const SENTINEL = "QA-Zwischenablage unverändert";
const FIRST = "https://example.atlassian.net/browse/DEMO-1?focusedCommentId=10001#comment-10001";
const SECOND = "https://example.atlassian.net/browse/DEMO-1?focusedCommentId=10002#comment-10002";

const section = (page: Page) => page.locator("section").filter({ has: page.getByRole("heading", { name: /^Kommentare/ }) });
const rows = (page: Page) => section(page).locator("ol > li");
const row = (page: Page, text: string) => rows(page).filter({ hasText: text });
const menuButton = (page: Page, text: string) => row(page, text).getByRole("button", { name: MENU, exact: true });
const linkItem = (page: Page) => page.getByRole("menuitem", { name: new RegExp(`^${ITEM}`) });
const copy = async (page: Page, text: string) => {
  await menuButton(page, text).click();
  await linkItem(page).click();
};
const toasts = (page: Page, text: string) => page.locator("[data-sonner-toast]").filter({ hasText: text });

const clipboardBytes = (page: Page) =>
  page.evaluate(async () => Array.from(new TextEncoder().encode(await navigator.clipboard.readText())));
const bytesOf = (text: string) => Array.from(new TextEncoder().encode(text));
const calls = (page: Page) => page.evaluate(() => window.__qaClipboard.calls);

const open = async (page: Page, siteUrl?: string) => {
  if (siteUrl !== undefined)
    await page.addInitScript((value) => {
      window.__qaSiteUrl = value;
    }, siteUrl);
  await page.goto(SCENARIO);
  await expect(rows(page)).toHaveCount(2);
  await page.evaluate(async (text) => {
    await navigator.clipboard.writeText(text);
    window.__qaClipboard.calls = [];
  }, SENTINEL);
  await settle(page);
};

const settle = async (page: Page) => {
  await expect
    .poll(() => page.evaluate(() => document.getAnimations().filter((animation) => animation.playState === "running").length))
    .toBe(0);
  await expect.poll(() => rows(page).evaluateAll((items) => items.map((item) => getComputedStyle(item).opacity))).toEqual(["1", "1"]);
  const fonts = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].some((face) => face.family.includes("Geist") && face.status === "loaded");
  });
  expect(fonts).toBe(true);
};

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  const dir = process.env.COMMENT_LINK_SHOTS;
  if (!dir) return;
  await section(page).scrollIntoViewIfNeeded();
  await settle(page);
  await page.screenshot({ path: `${dir}/${testInfo.project.name}-${name}.png` });
};

test.beforeEach(async ({ page, context }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => {
    const clipboard = navigator.clipboard;
    const writeText = clipboard.writeText.bind(clipboard);
    window.__qaClipboard = { calls: [], fail: false, delayMs: 0 };
    clipboard.writeText = async (text: string) => {
      const spy = window.__qaClipboard;
      spy.calls.push(text);
      if (spy.delayMs) await new Promise((resolve) => setTimeout(resolve, spy.delayMs));
      if (spy.fail) throw new DOMException("Test: Zwischenablage gesperrt", "NotAllowedError");
      return writeText(text);
    };
  });
});

test("kopiert über das Menü genau einmal den Permalink des Kommentars", async ({ page }, testInfo) => {
  await open(page);
  await expect(rows(page).getByRole("button", { name: MENU, exact: true })).toHaveCount(2);
  await expect(section(page).getByRole("button", { name: "Jira-Link zum Kommentar kopieren" })).toHaveCount(0);

  await copy(page, "Erster QA-Kommentar");

  await expect(toasts(page, "Link zum Kommentar kopiert")).toHaveCount(1);
  expect(await clipboardBytes(page)).toEqual(bytesOf(FIRST));
  expect(await calls(page)).toEqual([FIRST]);
  await shot(page, testInfo, "kopiert");

  await page.evaluate(() => {
    window.__qaClipboard.calls = [];
    window.__qaClipboard.delayMs = 1500;
  });
  await copy(page, "Zweiter QA-Kommentar");
  await copy(page, "Zweiter QA-Kommentar");
  await expect.poll(() => calls(page)).toEqual([SECOND]);
  await expect.poll(() => clipboardBytes(page)).toEqual(bytesOf(SECOND));
  await page.waitForTimeout(300);
  expect(await calls(page)).toEqual([SECOND]);
});

test("ist per Tastatur erreichbar und kopiert mit Enter und Leertaste", async ({ page }) => {
  await open(page);
  const second = menuButton(page, "Zweiter QA-Kommentar");
  await second.focus();
  await expect(second).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(linkItem(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(() => clipboardBytes(page)).toEqual(bytesOf(SECOND));

  await menuButton(page, "Erster QA-Kommentar").focus();
  await page.keyboard.press("Space");
  await expect(linkItem(page)).toBeFocused();
  await page.keyboard.press("Space");
  await expect.poll(() => clipboardBytes(page)).toEqual(bytesOf(FIRST));
  expect(await calls(page)).toEqual([SECOND, FIRST]);
});

test("verwendet Kontextpfad der Instanz ohne Basis-Query und -Fragment", async ({ page }) => {
  await open(page, "https://jira.example.com/jira/?os_authType=basic#oben");
  await copy(page, "Zweiter QA-Kommentar");
  await expect
    .poll(() => clipboardBytes(page))
    .toEqual(bytesOf("https://jira.example.com/jira/browse/DEMO-1?focusedCommentId=10002#comment-10002"));
});

test("meldet einen Fehler der Zwischenablage und lässt sie unverändert", async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    window.__qaClipboard.fail = true;
  });
  await copy(page, "Erster QA-Kommentar");
  await expect(toasts(page, "Kopieren fehlgeschlagen")).toHaveCount(1);
  await expect(toasts(page, "Link zum Kommentar kopiert")).toHaveCount(0);
  expect(await calls(page)).toEqual([FIRST]);
  expect(await clipboardBytes(page)).toEqual(bytesOf(SENTINEL));
});

for (const [name, siteUrl] of [
  ["ohne Jira-Verbindung", ""],
  ["mit Zugangsdaten in der Instanzadresse", "https://qa:geheim@example.atlassian.net"],
  ["mit unsicherer Instanzadresse", "http://example.atlassian.net"],
] as const)
  test(`zeigt ${name} einen klaren Zustand ohne Link`, async ({ page }, testInfo) => {
    await open(page, siteUrl);
    await menuButton(page, "Erster QA-Kommentar").click();
    const item = linkItem(page);
    await expect(item).toHaveAttribute("aria-disabled", "true");
    await expect(item).toContainText(UNAVAILABLE);
    await item.click({ force: true });
    await expect(toasts(page, "Link zum Kommentar kopiert")).toHaveCount(0);
    expect(await calls(page)).toEqual([]);
    expect(await clipboardBytes(page)).toEqual(bytesOf(SENTINEL));
    await expect(section(page).locator("a[href*='focusedCommentId']")).toHaveCount(0);
    if (siteUrl === "") await shot(page, testInfo, "nicht-verbunden");
  });

test("lässt Entwurf und Sortierung unberührt und erreicht neue Kommentare", async ({ page }) => {
  await open(page);
  const input = page.getByRole("textbox", { name: "Kommentar", exact: true });
  await input.fill("QA-Entwurf bleibt erhalten");
  const order = section(page).getByRole("button", { name: /zuerst$/ });
  const before = await order.getAttribute("aria-pressed");
  const textsBefore = await rows(page).allInnerTexts();

  await copy(page, "Erster QA-Kommentar");
  await expect.poll(() => clipboardBytes(page)).toEqual(bytesOf(FIRST));
  await expect(input).toHaveText("QA-Entwurf bleibt erhalten");
  await expect(order).toHaveAttribute("aria-pressed", before ?? "false");
  expect(await rows(page).allInnerTexts()).toEqual(textsBefore);

  await order.click();
  await expect(order).not.toHaveAttribute("aria-pressed", before ?? "false");
  await expect(rows(page).getByRole("button", { name: MENU, exact: true })).toHaveCount(2);
  await copy(page, "Zweiter QA-Kommentar");
  await expect.poll(() => clipboardBytes(page)).toEqual(bytesOf(SECOND));

  await input.fill("Neuer QA-Kommentar für den Link");
  await page.getByRole("button", { name: "Kommentieren" }).click();
  await expect(rows(page)).toHaveCount(3);
  await copy(page, "Neuer QA-Kommentar für den Link");
  await expect
    .poll(async () => new TextDecoder().decode(new Uint8Array(await clipboardBytes(page))))
    .toMatch(/^https:\/\/example\.atlassian\.net\/browse\/DEMO-1\?focusedCommentId=(\d+)#comment-\1$/);
});

for (const colorScheme of ["light", "dark"] as const)
  test(`langer Autorenname bei 390 px ${colorScheme} mit reduzierter Bewegung`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Ansicht wird im Test selbst gesetzt");
    await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    await section(page).scrollIntoViewIfNeeded();
    await settle(page);

    const layout = await row(page, "Zweiter QA-Kommentar").evaluate((item, label) => {
      const button = item.querySelector(`button[aria-label="${label}"]`);
      const header = button?.closest("article")?.querySelector(":scope > div.text-sm")?.firstElementChild;
      const box = button?.getBoundingClientRect();
      const hits = (from: number, to: number, point: (value: number) => [number, number]) => {
        let size = 0;
        for (let value = from; value <= to; value += 0.5) {
          const target = document.elementFromPoint(...point(value));
          if (button && target && button.contains(target)) size += 0.5;
        }
        return size;
      };
      const centerX = box ? box.left + box.width / 2 : 0;
      const centerY = box ? box.top + box.height / 2 : 0;
      return {
        hitWidth: box ? hits(box.left - 12, box.right + 12, (x) => [x, centerY]) : 0,
        hitHeight: box ? hits(box.top - 12, box.bottom + 12, (y) => [centerX, y]) : 0,
        dark: document.documentElement.classList.contains("dark"),
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        width: box?.width ?? 0,
        height: box?.height ?? 0,
        right: box?.right ?? Infinity,
        headerRight: header?.getBoundingClientRect().right ?? Infinity,
        left: box?.left ?? 0,
        viewport: window.innerWidth,
      };
    }, MENU);
    expect(layout.dark).toBe(colorScheme === "dark");
    expect(layout.overflow).toBeLessThanOrEqual(0);
    expect(layout.width).toBeGreaterThanOrEqual(24);
    expect(layout.height).toBeGreaterThanOrEqual(24);
    expect(layout.hitWidth).toBeGreaterThanOrEqual(32);
    expect(layout.hitHeight).toBeGreaterThanOrEqual(32);
    expect(layout.right).toBeLessThanOrEqual(layout.viewport);
    expect(layout.headerRight).toBeLessThanOrEqual(layout.left);
    await expect(row(page, "Zweiter QA-Kommentar")).toContainText("Testdorf (Qualitätssicherung Nord)");

    await copy(page, "Zweiter QA-Kommentar");
    await expect.poll(() => clipboardBytes(page)).toEqual(bytesOf(SECOND));
    await shot(page, testInfo, `390-${colorScheme}`);
  });

test.describe("Kommentare auf späteren Seiten", () => {
  const paged = (route: string) => `/tests/browser/fixture.html?route=${encodeURIComponent(route)}`;
  const allLoaded = (page: Page, count: number) => section(page).getByText(`Alle ${count} Kommentare geladen`);

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__qaCommentDetailLimit = 2;
      window.__qaCommentPagesRule = () => ({ pageSize: 2 });
    });
  });

  test("springt zu einem Kommentar auf Seite 3 und lädt dafür nach", async ({ page }) => {
    await page.goto(paged("/issue/DEMO-1?comment=10005"));
    const target = section(page).locator('[data-comment-id="10005"]');
    await expect(target).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get("comment")).toBeNull();
    await expect(toasts(page, "Kommentar nicht mehr vorhanden")).toHaveCount(0);
    const starts = await page.evaluate(() =>
      (window as unknown as { __qa: { commentPageReads: { startAt: number }[] } }).__qa.commentPageReads.map((read) => read.startAt),
    );
    expect(starts).toEqual(expect.arrayContaining([0, 2, 4]));
    expect(starts).not.toContain(6);
  });

  test("fragt nicht weiter ab, wenn beim Sprung Seite 2 scheitert, und springt nach „Erneut versuchen“", async ({ page }) => {
    await page.addInitScript(() => {
      const qa = window as unknown as { __qaJumpFail: boolean; __qaCommentPagesRule: (key: string, startAt: number) => object };
      qa.__qaJumpFail = true;
      qa.__qaCommentPagesRule = (_key, startAt) => ({ pageSize: 2, ...(startAt > 0 && qa.__qaJumpFail ? { status: 400 } : {}) });
    });
    const reads = () =>
      page.evaluate(() => (window as unknown as { __qa: { commentPageReads: { startAt: number }[] } }).__qa.commentPageReads.map((read) => read.startAt));
    await page.goto(paged("/issue/DEMO-1?comment=10005"));
    await expect(section(page).getByText("Weitere Kommentare konnten nicht geladen werden")).toBeVisible();
    const afterError = (await reads()).length;
    await page.waitForTimeout(3000);
    expect((await reads()).length).toBe(afterError);
    expect(await reads()).not.toContain(4);
    expect(new URL(page.url()).searchParams.get("comment")).toContain("10005");
    await expect(toasts(page, "Kommentar nicht mehr vorhanden")).toHaveCount(0);

    await page.evaluate(() => {
      (window as unknown as { __qaJumpFail: boolean }).__qaJumpFail = false;
    });
    await section(page).getByRole("button", { name: "Erneut versuchen" }).click();
    await expect(section(page).locator('[data-comment-id="10005"]')).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get("comment")).toBeNull();
    expect(await reads()).toEqual(expect.arrayContaining([0, 2, 4]));
  });

  test("bearbeitet und löscht eigene Kommentare nach dem Nachladen, ohne dass die Liste zurückspringt", async ({ page }) => {
    await page.goto(paged("/issue/DEMO-1"));
    const load = section(page).getByRole("button", { name: "Weitere Kommentare laden" });
    for (let round = 0; round < 6 && !(await allLoaded(page, 11).isVisible()); round++) {
      await load.click();
      await page.waitForTimeout(150);
    }
    await expect(allLoaded(page, 11)).toBeVisible();
    const articles = section(page).locator("article[data-comment-id]");
    await expect(articles).toHaveCount(11);

    const edited = section(page).locator('[data-comment-id="10009"]');
    await edited.getByRole("button", { name: MENU, exact: true }).click();
    await page.getByRole("menuitem", { name: /^Bearbeiten/ }).click();
    const editor = page.getByRole("textbox", { name: "Kommentar bearbeiten" });
    await expect(editor).toBeFocused();
    await page.keyboard.press("End");
    await page.keyboard.type(" Ergänzt.");
    await page.getByRole("button", { name: "Speichern" }).click();
    await expect(toasts(page, "Kommentar gespeichert")).toHaveCount(1);
    await expect(edited).toContainText("Ergänzt.");
    await expect(articles).toHaveCount(11);
    await expect(allLoaded(page, 11)).toBeVisible();

    const removed = section(page).locator('[data-comment-id="10007"]');
    await removed.getByRole("button", { name: MENU, exact: true }).click();
    await page.getByRole("menuitem", { name: /^Löschen/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Löschen", exact: true }).click();
    await expect(toasts(page, "Kommentar gelöscht")).toHaveCount(1);
    await expect(removed).toHaveCount(0);
    await expect(articles).toHaveCount(10);
    await expect(allLoaded(page, 10)).toBeVisible();
    await expect(load).toHaveCount(0);

    const input = page.getByRole("textbox", { name: "Kommentar", exact: true });
    await input.fill("Eigener QA-Kommentar zum Löschen");
    await page.getByRole("button", { name: "Kommentieren" }).click();
    const posted = section(page).locator("article[data-comment-id]").filter({ hasText: "Eigener QA-Kommentar zum Löschen" });
    await expect(posted).toHaveCount(1);
    await posted.getByRole("button", { name: MENU, exact: true }).click();
    await page.getByRole("menuitem", { name: /^Löschen/ }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Löschen", exact: true }).click();
    await expect.poll(() => page.evaluate(() =>
      (window as unknown as { __qa: { writes: { method: string; path: string }[] } }).__qa.writes.filter((write) => write.method === "DELETE").length,
    )).toBe(2);
    await expect(posted).toHaveCount(0);
    await page.waitForTimeout(500);
    await expect(posted).toHaveCount(0);
    await expect(articles).toHaveCount(10);
  });
});
