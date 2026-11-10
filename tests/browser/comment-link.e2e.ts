import { expect, test, type Page, type TestInfo } from "@playwright/test";

type ClipboardSpy = { calls: string[]; fail: boolean; delayMs: number };

declare global {
  interface Window {
    __qaSiteUrl?: string;
    __qaClipboard: ClipboardSpy;
  }
}

const SCENARIO = "/tests/browser/fixture.html?scenario=comment-links&route=/issue/DEMO-1";
const LABEL = "Jira-Link zum Kommentar kopieren";
const SENTINEL = "QA-Zwischenablage unverändert";
const FIRST = "https://example.atlassian.net/browse/DEMO-1?focusedCommentId=10001#comment-10001";
const SECOND = "https://example.atlassian.net/browse/DEMO-1?focusedCommentId=10002#comment-10002";

const section = (page: Page) => page.locator("section").filter({ has: page.getByRole("heading", { name: /^Kommentare/ }) });
const rows = (page: Page) => section(page).locator("ol > li");
const row = (page: Page, text: string) => rows(page).filter({ hasText: text });
const action = (page: Page, text: string) => row(page, text).getByRole("button", { name: LABEL, exact: true });
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

test("kopiert per Klick genau einmal den Permalink des Kommentars", async ({ page }, testInfo) => {
  await open(page);
  await expect(rows(page).getByRole("button", { name: LABEL, exact: true })).toHaveCount(2);

  await action(page, "Erster QA-Kommentar").hover();
  await expect(page.getByText(LABEL, { exact: true })).toBeVisible();
  await action(page, "Erster QA-Kommentar").click();

  await expect(toasts(page, "Link zum Kommentar kopiert")).toHaveCount(1);
  expect(await clipboardBytes(page)).toEqual(bytesOf(FIRST));
  expect(await calls(page)).toEqual([FIRST]);
  await shot(page, testInfo, "kopiert");

  await page.evaluate(() => {
    window.__qaClipboard.calls = [];
    window.__qaClipboard.delayMs = 400;
  });
  await action(page, "Zweiter QA-Kommentar").dblclick();
  await expect.poll(() => calls(page)).toEqual([SECOND]);
  await expect.poll(() => clipboardBytes(page)).toEqual(bytesOf(SECOND));
  await page.waitForTimeout(600);
  expect(await calls(page)).toEqual([SECOND]);
});

test("ist per Tastatur erreichbar und kopiert mit Enter und Leertaste", async ({ page }) => {
  await open(page);
  const second = action(page, "Zweiter QA-Kommentar");
  await second.focus();
  await expect(second).toBeFocused();
  await expect(page.getByText(LABEL, { exact: true })).toBeVisible();

  await page.keyboard.press("Enter");
  await expect.poll(() => clipboardBytes(page)).toEqual(bytesOf(SECOND));

  await action(page, "Erster QA-Kommentar").focus();
  await page.keyboard.press("Space");
  await expect.poll(() => clipboardBytes(page)).toEqual(bytesOf(FIRST));
  expect(await calls(page)).toEqual([SECOND, FIRST]);
});

test("verwendet Kontextpfad der Instanz ohne Basis-Query und -Fragment", async ({ page }) => {
  await open(page, "https://jira.example.com/jira/?os_authType=basic#oben");
  await action(page, "Zweiter QA-Kommentar").click();
  await expect
    .poll(() => clipboardBytes(page))
    .toEqual(bytesOf("https://jira.example.com/jira/browse/DEMO-1?focusedCommentId=10002#comment-10002"));
});

test("meldet einen Fehler der Zwischenablage und lässt sie unverändert", async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    window.__qaClipboard.fail = true;
  });
  await action(page, "Erster QA-Kommentar").click();
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
    const first = action(page, "Erster QA-Kommentar");
    await expect(first).toHaveAttribute("data-available", "false");
    await first.hover();
    await expect(page.getByText("Kein Jira-Link verfügbar: keine gültige Jira-Verbindung").first()).toBeVisible();
    await first.click();
    await expect(toasts(page, "Kein Jira-Link verfügbar")).toHaveCount(1);
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

  await action(page, "Erster QA-Kommentar").click();
  await expect.poll(() => clipboardBytes(page)).toEqual(bytesOf(FIRST));
  await expect(input).toHaveText("QA-Entwurf bleibt erhalten");
  await expect(order).toHaveAttribute("aria-pressed", before ?? "false");
  expect(await rows(page).allInnerTexts()).toEqual(textsBefore);

  await order.click();
  await expect(order).not.toHaveAttribute("aria-pressed", before ?? "false");
  await expect(rows(page).getByRole("button", { name: LABEL, exact: true })).toHaveCount(2);
  await action(page, "Zweiter QA-Kommentar").click();
  await expect.poll(() => clipboardBytes(page)).toEqual(bytesOf(SECOND));

  await input.fill("Neuer QA-Kommentar für den Link");
  await page.getByRole("button", { name: "Kommentieren" }).click();
  await expect(rows(page)).toHaveCount(3);
  await action(page, "Neuer QA-Kommentar für den Link").click();
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
      const header = button?.parentElement?.firstElementChild;
      const box = button?.getBoundingClientRect();
      return {
        dark: document.documentElement.classList.contains("dark"),
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        width: box?.width ?? 0,
        height: box?.height ?? 0,
        right: box?.right ?? Infinity,
        headerRight: header?.getBoundingClientRect().right ?? Infinity,
        left: box?.left ?? 0,
        viewport: window.innerWidth,
      };
    }, LABEL);
    expect(layout.dark).toBe(colorScheme === "dark");
    expect(layout.overflow).toBeLessThanOrEqual(0);
    expect(layout.width).toBeGreaterThanOrEqual(32);
    expect(layout.height).toBeGreaterThanOrEqual(32);
    expect(layout.right).toBeLessThanOrEqual(layout.viewport);
    expect(layout.headerRight).toBeLessThanOrEqual(layout.left);
    await expect(row(page, "Zweiter QA-Kommentar")).toContainText("Testdorf (Qualitätssicherung Nord)");

    await action(page, "Zweiter QA-Kommentar").click();
    await expect.poll(() => clipboardBytes(page)).toEqual(bytesOf(SECOND));
    await shot(page, testInfo, `390-${colorScheme}`);
  });
