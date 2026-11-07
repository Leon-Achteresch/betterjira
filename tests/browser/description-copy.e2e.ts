import { expect, test, type Page, type TestInfo } from "@playwright/test";

type ClipboardControl = { calls: string[]; settle?: (ok: boolean) => void };

declare global {
  interface Window {
    __qa: { issueReads: string[]; writes: unknown[] };
    __qaDescriptions?: Record<string, unknown>;
    __qaClipboard?: ClipboardControl;
  }
}

const text = (value: string, marks?: unknown[]) => ({ type: "text", text: value, ...(marks && { marks }) });
const paragraph = (...content: unknown[]) => ({ type: "paragraph", content });
const item = (...content: unknown[]) => ({ type: "listItem", content });
const doc = (...content: unknown[]) => ({ type: "doc", version: 1, content });

const RICH = doc(
  { type: "heading", attrs: { level: 2 }, content: [text("Ziel")] },
  paragraph(
    text("Übergabe "),
    text("vorbereiten", [{ type: "strong" }]),
    text(" mit "),
    { type: "mention", attrs: { id: "qa-user", text: "@Alex Beispiel" } },
    text(" – siehe "),
    text("Leitfaden", [{ type: "link", attrs: { href: "https://example.test/leitfaden" } }]),
    text("."),
  ),
  paragraph(text("Zeile eins"), { type: "hardBreak" }, text("Zeile zwei")),
  { type: "bulletList", content: [item(paragraph(text("Punkt A"))), item(paragraph(text("Punkt B")), { type: "bulletList", content: [item(paragraph(text("Unterpunkt")))] })] },
  { type: "orderedList", attrs: { order: 1 }, content: [item(paragraph(text("Erster Schritt"))), item(paragraph(text("Zweiter Schritt")))] },
  { type: "extension", attrs: { extensionKey: "qa-makro", parameters: { token: "geheim-qa" } } },
  paragraph(text("Ende 😄")),
);

const EXPECTED = [
  "Ziel",
  "Übergabe vorbereiten mit @Alex Beispiel – siehe Leitfaden (https://example.test/leitfaden).",
  "Zeile eins\nZeile zwei",
  "- Punkt A\n- Punkt B\n  - Unterpunkt",
  "1. Erster Schritt\n2. Zweiter Schritt",
  "Ende 😄",
].join("\n\n");
const EXPECTED_CLIPBOARD = process.platform === "win32" ? EXPECTED.replace(/\n/g, "\r\n") : EXPECTED;

const SENTINEL = "QA-Zwischenablage vorher";

const ISSUE = (key: string) => `/tests/browser/fixture.html?route=/issue/${key}`;
const trigger = (page: Page) => page.getByRole("button", { name: "Weitere Ticketaktionen" });
const menu = (page: Page) => page.getByRole("menu");
const copyItem = (page: Page) => menu(page).getByRole("menuitem", { name: /^Beschreibung kopieren/ });
const toast = (page: Page, message: string) => page.getByText(message, { exact: true });

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  const dir = process.env.DESCRIPTION_COPY_SHOTS;
  if (!dir) return;
  const loaded = await page.evaluate(async () => {
    await document.fonts.load('14px "Geist Variable"');
    await document.fonts.ready;
    await Promise.all(document.getAnimations().filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity).map((animation) => animation.finished.catch(() => undefined)));
    return [...document.fonts].some((face) => face.family.includes("Geist") && face.status === "loaded");
  });
  expect(loaded).toBe(true);
  await page.screenshot({ path: `${dir}/${testInfo.project.name}-${name}.png` });
};

const settleMenu = (page: Page) =>
  menu(page).evaluate((element) =>
    Promise.all(
      element
        .getAnimations({ subtree: true })
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );

const openMenuByKeyboard = async (page: Page) => {
  await trigger(page).focus();
  await expect(trigger(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(menu(page)).toBeVisible();
  await settleMenu(page);
};

const focusCopyItem = async (page: Page) => {
  for (let step = 0; step < 12; step++) {
    if (await copyItem(page).evaluate((element) => element === document.activeElement)) break;
    await page.keyboard.press("ArrowDown");
  }
  await expect(copyItem(page)).toBeFocused();
};

const useRealClipboard = async (page: Page) => {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.evaluate((value) => navigator.clipboard.writeText(value), SENTINEL);
};

const clipboardBytes = (page: Page) =>
  page.evaluate(async () => Array.from(new TextEncoder().encode(await navigator.clipboard.readText())));

const traffic = (page: Page) =>
  page.evaluate(() => ({ issueReads: [...window.__qa.issueReads], writes: window.__qa.writes.length }));

const deferClipboard = (page: Page) =>
  page.addInitScript(() => {
    const control: ClipboardControl = { calls: [] };
    window.__qaClipboard = control;
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: (value: string) => {
          control.calls.push(value);
          return new Promise<void>((resolve, reject) => {
            control.settle = (ok) => (ok ? resolve() : reject(new DOMException("Test: Zwischenablage gesperrt", "NotAllowedError")));
          });
        },
      },
    });
  });

const settleClipboard = (page: Page, ok: boolean) => page.evaluate((value) => window.__qaClipboard?.settle?.(value), ok);
const clipboardCalls = (page: Page) => page.evaluate(() => window.__qaClipboard?.calls ?? []);

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.addInitScript(
    (descriptions) => {
      window.__qaDescriptions = descriptions;
    },
    { "DEMO-1": RICH, "DEMO-2": null, "DEMO-3": doc(paragraph(), paragraph(text("   "))) },
  );
});

test("kopiert die gespeicherte Beschreibung per Tastatur als lesbaren Klartext ohne Jira-Zugriff", async ({ page }, testInfo) => {
  await page.goto(ISSUE("DEMO-1"));
  await expect(page.getByRole("heading", { name: "Ziel" })).toBeVisible();
  await useRealClipboard(page);
  const before = await traffic(page);

  await openMenuByKeyboard(page);
  await focusCopyItem(page);
  await expect(copyItem(page)).not.toHaveAttribute("aria-disabled", "true");
  await expect(copyItem(page)).toContainText("Gespeicherter Stand");
  const actionBox = await copyItem(page).boundingBox();
  expect(actionBox?.height).toBeGreaterThanOrEqual(32);
  await shot(page, testInfo, "menue");
  await page.keyboard.press("Enter");

  await expect(toast(page, "Beschreibung kopiert")).toBeVisible();
  await expect(menu(page)).toHaveCount(0);
  expect(await clipboardBytes(page)).toEqual([...Buffer.from(EXPECTED_CLIPBOARD, "utf8")]);
  expect(await traffic(page)).toEqual(before);
});

test("verwendet den gespeicherten Stand, nicht den offenen Editorentwurf", async ({ page }) => {
  await page.goto(ISSUE("DEMO-1"));
  await page.getByRole("button", { name: "Beschreibung bearbeiten" }).click();
  const editor = page.getByRole("textbox", { name: "Text bearbeiten" });
  await expect(editor).toBeEnabled();
  await editor.fill("UNGESPEICHERTER ENTWURF");
  await useRealClipboard(page);
  const before = await traffic(page);

  await trigger(page).click();
  await copyItem(page).click();

  await expect(toast(page, "Beschreibung kopiert")).toBeVisible();
  const copied = Buffer.from(await clipboardBytes(page)).toString("utf8");
  expect(copied).toBe(EXPECTED_CLIPBOARD);
  expect(copied).not.toContain("UNGESPEICHERT");
  await expect(editor).toHaveValue("UNGESPEICHERTER ENTWURF");
  expect(await traffic(page)).toEqual(before);
});

for (const [key, hint] of [
  ["DEMO-2", "Ticket hat keine Beschreibung"],
  ["DEMO-3", "Beschreibung enthält keinen Text"],
] as const) {
  test(`deaktiviert die Aktion mit Erklärung bei ${key}`, async ({ page }, testInfo) => {
    await page.goto(ISSUE(key));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await useRealClipboard(page);

    await openMenuByKeyboard(page);
    await expect(copyItem(page)).toHaveAttribute("aria-disabled", "true");
    await expect(copyItem(page)).toContainText(hint);
    await shot(page, testInfo, `deaktiviert-${key}`);
    await copyItem(page).click({ force: true });
    await page.keyboard.press("Escape");
    await expect(menu(page)).toHaveCount(0);

    await expect(toast(page, "Beschreibung kopiert")).toHaveCount(0);
    expect(Buffer.from(await clipboardBytes(page)).toString("utf8")).toBe(SENTINEL);
  });
}

test("sperrt Doppelauslösung und zeigt Fehler der Zwischenablage", async ({ page }) => {
  await deferClipboard(page);
  await page.goto(ISSUE("DEMO-1"));
  await expect(page.getByRole("heading", { name: "Ziel" })).toBeVisible();

  await trigger(page).click();
  await copyItem(page).click();
  await expect(menu(page)).toHaveCount(0);

  await openMenuByKeyboard(page);
  await expect(copyItem(page)).toHaveAttribute("aria-disabled", "true");
  await expect(copyItem(page)).toContainText("Wird kopiert …");
  await copyItem(page).click({ force: true });
  await page.keyboard.press("Escape");
  expect(await clipboardCalls(page)).toEqual([EXPECTED]);

  await settleClipboard(page, false);
  await expect(toast(page, "Kopieren fehlgeschlagen")).toBeVisible();

  await trigger(page).click();
  await expect(copyItem(page)).not.toHaveAttribute("aria-disabled", "true");
  await copyItem(page).click();
  expect(await clipboardCalls(page)).toEqual([EXPECTED, EXPECTED]);
  await settleClipboard(page, true);
  await expect(toast(page, "Beschreibung kopiert")).toBeVisible();
});

test("fehlende Clipboard-API zeigt einen Fehler und gibt die Kopiersperre wieder frei", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { value: undefined }));
  await page.goto(ISSUE("DEMO-1"));
  await expect(page.getByRole("heading", { name: "Ziel" })).toBeVisible();
  await trigger(page).click();
  await copyItem(page).click();
  await expect(toast(page, "Kopieren fehlgeschlagen")).toBeVisible();
  await openMenuByKeyboard(page);
  await expect(copyItem(page)).not.toHaveAttribute("aria-disabled", "true");
});

test("Darstellung: Desktop hell und 390 px dunkel mit geöffnetem Menü", async ({ page }, testInfo) => {
  const narrow = testInfo.project.name !== "desktop";
  if (narrow) await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(ISSUE("DEMO-1"));
  await expect(page.getByRole("heading", { name: "Ziel" })).toBeVisible();
  const fonts = await page.evaluate(async () => {
    await document.fonts.load('16px "Geist Variable"');
    await document.fonts.ready;
    return {
      loaded: [...document.fonts].some((face) => face.family.includes("Geist") && face.status === "loaded"),
      family: getComputedStyle(document.body).fontFamily,
      dark: document.documentElement.classList.contains("dark"),
    };
  });
  expect(fonts.loaded).toBe(true);
  expect(fonts.family).toContain("Geist");
  expect(fonts.dark).toBe(narrow);

  await openMenuByKeyboard(page);
  await focusCopyItem(page);
  const layout = await menu(page).evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { left: box.left, right: box.right, width: window.innerWidth, overflow: document.documentElement.scrollWidth - window.innerWidth };
  });
  expect(layout.left).toBeGreaterThanOrEqual(0);
  expect(layout.right).toBeLessThanOrEqual(layout.width);
  expect(layout.overflow).toBeLessThanOrEqual(0);
  await page.mouse.move(0, 0);
  await shot(page, testInfo, narrow ? "390-dunkel" : "desktop-hell");
});
