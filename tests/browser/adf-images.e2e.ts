import { expect, test, type Locator, type Page } from "@playwright/test";

type QaState = {
  reads: string[];
  issueReads: string[];
  renderedReads: { key: string; expand: string | null }[];
  commentPageExpands: (string | null)[];
  opened: string[];
};
type QaWindow = { __qa: QaState; __qaAdfImagesRevise: () => void };

const ISSUE = (key: string) => `/tests/browser/fixture.html?scenario=adf-images&route=/issue/${key}`;
const qa = (page: Page) => page.evaluate(() => (window as unknown as QaWindow).__qa);
const section = (page: Page, name: RegExp) => page.locator("section").filter({ has: page.getByRole("heading", { name }) });
const description = (page: Page) => section(page, /^Beschreibung$/);
const comments = (page: Page) => section(page, /^Kommentare/);
const comment = (page: Page, text: string) => comments(page).locator("ol > li").filter({ hasText: text });
const media = (scope: Locator, kind: "image" | "file" | "missing", id?: string) =>
  scope.locator(id ? `[data-adf-media="${kind}"][data-attachment-id="${id}"]` : `[data-adf-media="${kind}"]`);
const pending = (scope: Locator, kind: "single" | "chip") => scope.locator(`[data-adf-media="pending"][data-adf-pending="${kind}"]`);
const anhang = (scope: Locator) => scope.getByText("[Anhang]", { exact: true });
const editor = (page: Page) => page.getByRole("textbox", { name: "Text bearbeiten" });
const scroller = (page: Page) => page.locator("#app-scroll");
const rem = (page: Page) => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("lädt die gerenderte Fassung nur bei Media-Knoten und lässt fields=*all unverändert", async ({ page }) => {
  await page.goto(ISSUE("DEMO-1"));
  await expect(media(description(page), "image", "46883")).toBeVisible();
  const first = await qa(page);
  expect(first.issueReads).toContain("/issue/DEMO-1?fields=*all");
  expect(first.renderedReads).toContainEqual({ key: "DEMO-1", expand: "renderedFields" });

  await page.goto(ISSUE("DEMO-2"));
  await expect(page.getByRole("heading", { name: /^Kommentare/ })).toBeVisible();
  await page.waitForTimeout(500);
  expect((await qa(page)).renderedReads).toEqual([]);
});

test("zeigt Bilder in gespeicherter Breite, höchstens Spaltenbreite, mit reserviertem Platz", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() => Object.assign(window, { __qaAttachmentRule: (id: string) => (id === "46883" ? { delayMs: 1500 } : {}) }));
  await page.goto(ISSUE("DEMO-1"));
  const pixel = media(description(page), "image", "46883");
  await expect(pixel).toHaveAttribute("data-state", "loading");
  const before = await pixel.boundingBox();
  expect(Math.round(before!.width)).toBe(480);
  expect(Math.round(before!.height)).toBe(240);
  await expect(pixel).toHaveAttribute("data-state", "loaded");
  expect(Math.round((await pixel.boundingBox())!.height)).toBe(240);

  const percent = media(description(page), "image", "46884");
  await expect(percent).toHaveAttribute("data-state", "loaded");
  const ratio = await percent.evaluate((element) => element.getBoundingClientRect().width / element.parentElement!.getBoundingClientRect().width);
  expect(ratio).toBeCloseTo(0.5, 2);

  await page.setViewportSize({ width: 390, height: 844 });
  const clamped = await pixel.evaluate((element) => element.getBoundingClientRect().width <= element.parentElement!.getBoundingClientRect().width + 0.5);
  expect(clamped).toBe(true);
});

test("lädt ein Bild schon 300 px unter dem sichtbaren Bereich von #app-scroll", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(ISSUE("DEMO-1"));
  await expect(media(description(page), "image", "46883")).toHaveAttribute("data-state", "loaded");
  const target = media(comment(page, "Beleg aus dem Test"), "image", "46887");
  await expect(target).toHaveAttribute("data-state", "idle");
  await page.waitForTimeout(300);
  expect((await qa(page)).reads).not.toContain("/attachment/content/46887");

  const gapBelow = () =>
    comment(page, "Beleg aus dem Test").evaluate(
      (entry) =>
        entry.querySelector('[data-adf-media="image"][data-attachment-id="46887"]')!.getBoundingClientRect().top -
        document.getElementById("app-scroll")!.getBoundingClientRect().bottom,
    );
  const gap = await gapBelow();
  await scroller(page).evaluate((element, distance) => {
    element.scrollTop += distance - 300;
  }, gap);
  expect(await gapBelow()).toBeGreaterThan(250);
  await expect.poll(async () => (await qa(page)).reads).toContain("/attachment/content/46887");
  await expect(target).not.toHaveAttribute("data-state", "idle");
  expect(await gapBelow()).toBeGreaterThan(250);
});

test("öffnet die Großansicht per Klick und Tastatur, ohne die Beschreibung zu bearbeiten", async ({ page }) => {
  await page.goto(ISSUE("DEMO-1"));
  const image = media(description(page), "image", "46883");
  await expect(image).toHaveAttribute("data-state", "loaded");
  const dialog = page.getByRole("dialog");

  await image.click();
  await expect(dialog.getByRole("heading", { name: "Ablauf Übergabe.png" })).toBeVisible();
  await expect(editor(page)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  await image.focus();
  await page.keyboard.press("Enter");
  await expect(dialog.getByRole("heading", { name: "Ablauf Übergabe.png" })).toBeVisible();
  await expect(editor(page)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  await description(page).getByText("Vorher:").click();
  await expect(editor(page)).toBeVisible();
});

test("Klick auf Hinweis-Chip öffnet keinen Editor", async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { __qaRenderedRule: () => ({ delayMs: 1500 }) });
    new MutationObserver(() => {
      for (const single of document.querySelectorAll<HTMLElement>("[data-adf-media-single]"))
        if (single.querySelector('[data-adf-media="pending"]')) single.dataset.qaSawPending = "true";
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto(ISSUE("DEMO-1"));
  const missing = media(description(page), "missing").filter({ hasText: "extern-beschreibung.png" });
  await expect(missing).toContainText("Anhang nicht verfügbar");
  await expect(pending(description(page), "single")).toHaveCount(2);
  await expect(media(description(page), "image", "46883")).toBeVisible();
  await expect(description(page).locator('[data-adf-media-single][data-qa-saw-pending="true"]')).toHaveCount(2);
  await expect(description(page).locator("[data-adf-media-single]").filter({ hasText: "extern-beschreibung.png" })).not.toHaveAttribute("data-qa-saw-pending", "true");
  await missing.click();
  await page.waitForTimeout(300);
  await expect(editor(page)).toHaveCount(0);

  await description(page).getByText("Vorher:").click();
  await expect(editor(page)).toBeVisible();
});

test("zeigt mediaGroup als Vorschaubilder, Dateien als Chip und nicht ladende Bilder als Chip", async ({ page }) => {
  await page.goto(ISSUE("DEMO-1"));
  const thumb = media(description(page), "image", "46885");
  await expect(thumb).toHaveAttribute("data-state", "loaded");
  expect((await thumb.boundingBox())!.height).toBeCloseTo((await rem(page)) * 8, 0);
  expect((await qa(page)).reads).toContain("/attachment/thumbnail/46885");

  const pdf = media(description(page), "file", "46886");
  await expect(pdf).toContainText("Angebot.pdf");
  await expect(pdf).toContainText("1.8 MB");
  await pdf.click();
  await expect.poll(async () => (await qa(page)).opened).toContain("https://example.atlassian.net/rest/api/3/attachment/content/46886");
  await expect(editor(page)).toHaveCount(0);
  await pdf.focus();
  const scrolled = await scroller(page).evaluate((element) => element.scrollTop);
  await page.keyboard.press(" ");
  await expect.poll(async () => (await qa(page)).opened.length).toBe(2);
  await expect(editor(page)).toHaveCount(0);
  expect(await scroller(page).evaluate((element) => element.scrollTop)).toBe(scrolled);

  await expect(media(description(page), "file", "46888")).toContainText("Defekt.png");
  await expect(media(description(page), "image", "46888")).toHaveCount(0);
});

test("zeigt Anhänge in Kommentaren und Antworten aus den Kommentarseiten, zuerst über die Media-ID zugeordnet", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith("https://example.com/")) external.push(request.url());
  });
  await page.goto(ISSUE("DEMO-1"));
  const embedded = comment(page, "Beleg aus dem Test");
  await embedded.scrollIntoViewIfNeeded();
  await expect(media(embedded, "image", "46887")).toHaveAttribute("data-state", "loaded");

  const files = media(comment(page, "Protokoll und Messwerte"), "file");
  await expect(files).toHaveCount(2);
  await expect(files.first()).toHaveAttribute("data-attachment-id", "46890");
  await expect(files.first()).toContainText("Messwerte.csv");
  await expect(files.last()).toHaveAttribute("data-attachment-id", "46889");

  expect((await qa(page)).commentPageExpands).toContain("renderedBody");
  const reply = comments(page).locator('ol.ml-8 > li [data-comment-id="c-reply"]');
  await expect(reply).toHaveCount(1);
  await reply.scrollIntoViewIfNeeded();
  await expect(media(reply, "image", "46884")).toHaveAttribute("data-state", "loaded");
  const mixed = comments(page).locator('[data-comment-id="c-mix"]');
  await mixed.scrollIntoViewIfNeeded();
  await expect(media(mixed, "image", "46887")).toHaveAttribute("data-state", "loaded");
  await expect(media(mixed, "file", "46886")).toContainText("Angebot.pdf");
  await expect(media(mixed, "missing")).toHaveCount(2);
  await expect(media(mixed, "missing").filter({ hasText: "extern.png" })).toContainText("Anhang nicht verfügbar");
  expect(external).toEqual([]);
});

test("zeigt Skeletons in Zielgröße, solange die gerenderte Fassung lädt", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // Comment pages wait too, so the comments embedded in the issue stay on screen without their own rendered body.
  await page.addInitScript(() => Object.assign(window, { __qaRenderedRule: () => ({ delayMs: 2000 }), __qaCommentPagesRule: () => ({ delayMs: 2000 }) }));
  await page.goto(ISSUE("DEMO-1"));
  const singles = pending(description(page), "single");
  await expect(singles).toHaveCount(2);
  const box = await singles.first().boundingBox();
  expect(Math.round(box!.width)).toBe(480);
  expect(Math.round(box!.height)).toBe(240);
  await expect(pending(description(page), "chip")).toHaveCount(1);
  await expect(pending(comment(page, "Protokoll und Messwerte"), "chip")).toHaveCount(2);
  await expect(pending(comment(page, "Beleg aus dem Test"), "single")).toHaveCount(1);
  await expect(anhang(description(page))).toHaveCount(0);
  await expect(anhang(comments(page))).toHaveCount(0);
  await expect(media(description(page), "image")).toHaveCount(0);

  const image = media(description(page), "image", "46883");
  await expect(image).toBeVisible();
  await expect(description(page).locator('[data-adf-media="pending"]')).toHaveCount(0);
  expect(Math.round((await image.boundingBox())!.height)).toBe(240);
});

test("zeigt Hinweis-Chips, wenn die gerenderte Fassung scheitert", async ({ page }) => {
  // Comment pages fail too; otherwise their rendered body would resolve the comment media.
  await page.addInitScript(() => Object.assign(window, { __qaRenderedRule: () => ({ status: 404 }), __qaCommentPagesRule: () => ({ status: 503 }) }));
  await page.goto(ISSUE("DEMO-1"));
  await expect(media(description(page), "missing")).toHaveCount(6, { timeout: 10_000 });
  await expect(media(comment(page, "Protokoll und Messwerte"), "missing")).toHaveCount(2);
  await expect(media(comment(page, "Beleg aus dem Test"), "missing")).toHaveCount(1);
  await expect(description(page).locator('[data-adf-media="pending"]')).toHaveCount(0);
  await expect(media(description(page), "image")).toHaveCount(0);
  await expect(anhang(description(page))).toHaveCount(0);

  await page.evaluate(() => Object.assign(window, { __qaRenderedRule: () => ({}) }));
  await page.getByRole("button", { name: "Weitere Ticketaktionen" }).click();
  await page.getByRole("menuitem", { name: "Aktualisieren" }).click();
  await expect(media(description(page), "image", "46883")).toBeVisible();
  await expect(media(description(page), "missing")).toHaveCount(1);
});

test("lädt nach Aktualisieren mit neuem Stand die gerenderte Fassung neu", async ({ page }) => {
  await page.goto(ISSUE("DEMO-1"));
  await expect(media(description(page), "image", "46883")).toBeVisible();
  const before = (await qa(page)).renderedReads.length;

  await page.evaluate(() => (window as unknown as QaWindow).__qaAdfImagesRevise());
  await page.getByRole("button", { name: "Weitere Ticketaktionen" }).click();
  await page.getByRole("menuitem", { name: "Aktualisieren" }).click();

  await expect(description(page).getByText("Neu:")).toBeVisible();
  await expect(media(description(page), "image", "46887")).toBeVisible();
  await expect(media(description(page), "missing")).toHaveCount(0);
  expect((await qa(page)).renderedReads.length).toBeGreaterThan(before);
});

test("zeigt [Anhang] im Arbeitsprotokoll, wo keine gerenderte Fassung vorgesehen ist", async ({ page }) => {
  await page.goto(ISSUE("DEMO-1?bereich=zeit"));
  const entry = page.getByRole("dialog").locator("li").filter({ hasText: "Messprotokoll" });
  await expect(anhang(entry)).toHaveCount(2);
  await expect(entry.locator("[data-adf-media]")).toHaveCount(0);
});

test("lässt ein geladenes Bild nach Änderung an einem anderen Feld ohne Skeleton stehen", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(ISSUE("DEMO-1"));
  const image = media(description(page), "image", "46883");
  await expect(image).toHaveAttribute("data-state", "loaded");
  const before = (await qa(page)).renderedReads.length;

  await page.evaluate(() => {
    const target = window as unknown as { __qa: { issues: { fields: { updated: string; summary: string } }[] }; __qaRenderedRule: () => { delayMs: number } };
    target.__qa.issues[0].fields.updated = "2026-11-05T11:00:00Z";
    target.__qa.issues[0].fields.summary = "Geänderte Zusammenfassung für den Bildtest";
    target.__qaRenderedRule = () => ({ delayMs: 800 });
  });
  await page.getByRole("button", { name: "Weitere Ticketaktionen" }).click();
  await page.getByRole("menuitem", { name: "Aktualisieren" }).click();

  const frames = await page.evaluate(
    () =>
      new Promise<{ height: number; state: string }[]>((resolve) => {
        const samples: { height: number; state: string }[] = [];
        const start = performance.now();
        const sample = () => {
          const heading = [...document.querySelectorAll("section h1, section h2, section h3, section h4")].find((entry) => entry.textContent?.trim() === "Beschreibung");
          const scope = heading?.closest("section");
          const container = scope?.querySelector("[data-adf-media-single]");
          const pending = scope?.querySelector('[data-adf-media="pending"]');
          const target = scope?.querySelector('[data-adf-media="image"][data-attachment-id="46883"]');
          samples.push({
            height: Math.round(container?.getBoundingClientRect().height ?? -1),
            state: pending ? "pending" : (target?.getAttribute("data-state") ?? "missing"),
          });
          if (performance.now() - start < 1500) requestAnimationFrame(sample);
          else resolve(samples);
        };
        requestAnimationFrame(sample);
      }),
  );

  expect(frames.length).toBeGreaterThan(30);
  expect(new Set(frames.map((frame) => frame.height))).toEqual(new Set([240]));
  expect(frames.filter((frame) => frame.state !== "loaded")).toEqual([]);
  await expect(page.getByText("Geänderte Zusammenfassung für den Bildtest").first()).toBeVisible();
  expect((await qa(page)).renderedReads.length).toBeGreaterThan(before);
});
