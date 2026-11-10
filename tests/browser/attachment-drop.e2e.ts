import { expect, test, type Locator, type Page } from "@playwright/test";

type AdfNode = { type: string; text?: string; attrs?: Record<string, unknown>; content?: AdfNode[] };
type Write = { path: string; method: string; input: { body?: AdfNode; files?: string[] } };
type QaWindow = { __qa: { writes: Write[]; delayMs: number; failNextWrite: boolean; withholdMediaId?: boolean } };
type Dropped = { name: string; type: string };

const ISSUE = "/tests/browser/fixture.html?route=/issue/DEMO-1";
const SITE = "https://example.atlassian.net";
const PDF = { name: "Angebot (final).pdf", type: "application/pdf" };
const CSV = { name: "export.csv", type: "text/csv" };

const writes = (page: Page) => page.evaluate(() => (window as unknown as QaWindow).__qa.writes);
const uploads = async (page: Page) => (await writes(page)).filter((write) => write.path.endsWith("/attachments")).map((write) => write.input.files);
const qaSet = (page: Page, values: Partial<QaWindow["__qa"]>) =>
  page.evaluate((next) => Object.assign((window as unknown as QaWindow).__qa, next), values);
const toasts = (page: Page, text: string) => page.locator("[data-sonner-toast]").filter({ hasText: text });
const comment = (page: Page) => page.getByRole("textbox", { name: "Kommentar", exact: true });
const placeholder = (scope: Locator) => scope.locator("[data-adf-upload]");
const chips = (scope: Locator) => scope.locator('[data-adf-editor-media="mediaInline"] [data-adf-media="file"]');

const drop = async (page: Page, target: Locator, files: readonly Dropped[]) => {
  const box = (await target.boundingBox())!;
  const dataTransfer = await page.evaluateHandle((entries) => {
    const transfer = new DataTransfer();
    for (const { name, type } of entries) transfer.items.add(new File(["x"], name, { type }));
    return transfer;
  }, files);
  await target.dispatchEvent("drop", { dataTransfer, clientX: box.x + 12, clientY: box.y + 12 });
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("fügt gezogene Dateien als Dateichips in den Kommentar ein und sendet sie als Medienknoten", async ({ page }) => {
  await page.goto(ISSUE);
  await expect(comment(page)).toBeVisible();
  await qaSet(page, { delayMs: 900 });
  await drop(page, comment(page), [PDF, CSV]);

  await expect(placeholder(comment(page))).toHaveText([`${PDF.name} wird hochgeladen …`, `${CSV.name} wird hochgeladen …`]);
  await expect(page.getByRole("button", { name: "Kommentieren" })).toBeDisabled();
  await expect(chips(comment(page))).toHaveCount(2);
  await expect(comment(page)).toContainText(PDF.name);
  await expect(comment(page)).toContainText(CSV.name);
  await expect(placeholder(comment(page))).toHaveCount(0);
  expect((await uploads(page)).flat().sort()).toEqual([PDF.name, CSV.name].sort());
  expect(await uploads(page)).toHaveLength(2);

  await qaSet(page, { delayMs: 0 });
  await page.getByRole("button", { name: "Kommentieren" }).click();
  await expect.poll(async () => (await writes(page)).some((write) => write.path === "/issue/DEMO-1/comment")).toBe(true);
  const posted = (await writes(page)).find((write) => write.path === "/issue/DEMO-1/comment")!.input.body!;
  const inline = posted.content!.flatMap((block) => block.content ?? []).filter((node) => node.type === "mediaInline");
  expect(inline.map((node) => node.attrs?.alt).sort()).toEqual([PDF.name, CSV.name].sort());
  for (const node of inline) expect(node.attrs).toMatchObject({ type: "file", collection: "", id: expect.stringMatching(/^[0-9a-f-]{36}$/) });
});

test("fällt auf einen Link zurück, wenn Jira keine Medien-Kennung liefert", async ({ page }) => {
  await page.goto(ISSUE);
  await comment(page).click();
  await page.keyboard.type("Siehe ");
  await qaSet(page, { withholdMediaId: true });
  await drop(page, comment(page), [PDF]);

  const link = comment(page).getByRole("link");
  await expect(link).toHaveText([PDF.name]);
  expect(await link.getAttribute("href")).toMatch(new RegExp(`^${SITE}/rest/api/3/attachment/content/[^/]+$`));
  await expect(chips(comment(page))).toHaveCount(0);
  await page.keyboard.type("danach");
  await expect(link).toHaveText([PDF.name]);
  await expect(comment(page)).toContainText("danach");
});

test("meldet einen fehlgeschlagenen Upload per Toast und lässt den Text unverändert", async ({ page }) => {
  await page.goto(ISSUE);
  await comment(page).click();
  await page.keyboard.type("Entwurf");
  await qaSet(page, { failNextWrite: true });
  await drop(page, comment(page), [PDF]);

  await expect(toasts(page, `${PDF.name} konnte nicht eingefügt werden`)).toBeVisible();
  await expect(placeholder(comment(page))).toHaveCount(0);
  await expect(chips(comment(page))).toHaveCount(0);
  await expect(comment(page)).toHaveText("Entwurf");
});

test("lädt im Anlegen-Formular nichts hoch, solange es keinen Vorgang gibt", async ({ page }) => {
  await page.goto("/tests/browser/fixture.html?scenario=create&route=/neu");
  await page.getByRole("main").getByRole("combobox", { name: "Projekt", exact: true }).click();
  await page.getByRole("option", { name: /Produktentwicklung/ }).click();
  const description = page.getByRole("main").getByRole("textbox", { name: "Beschreibung" });
  await expect(description).toBeVisible();
  await drop(page, description, [PDF]);
  await page.waitForTimeout(300);

  await expect(placeholder(description)).toHaveCount(0);
  expect(await uploads(page)).toEqual([]);
  await expect(page.locator("[data-file-drop]").filter({ has: description })).toHaveCount(0);
});

test("fängt Datei-Drops neben dem Editor ab, statt die Datei im Fenster zu öffnen", async ({ page }) => {
  await page.goto(ISSUE);
  await expect(comment(page)).toBeVisible();
  const prevented = (type: string, kind: "Files" | "text") =>
    page.evaluate(
      ([name, payload]) => {
        const transfer = new DataTransfer();
        if (payload === "Files") transfer.items.add(new File(["x"], "a.pdf", { type: "application/pdf" }));
        else transfer.setData("text/plain", "x");
        const event = new DragEvent(name, { dataTransfer: transfer, bubbles: true, cancelable: true });
        document.querySelector("h1")!.dispatchEvent(event);
        return event.defaultPrevented;
      },
      [type, kind] as const,
    );

  expect(await prevented("dragover", "Files")).toBe(true);
  expect(await prevented("drop", "Files")).toBe(true);
  expect(await prevented("dragover", "text")).toBe(false);
  await expect(page.locator("[data-file-drop]").filter({ has: comment(page) })).toHaveCount(1);
});
