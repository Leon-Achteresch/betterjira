import { expect, test, type Locator, type Page } from "@playwright/test";

type AdfNode = { type: string; text?: string; attrs?: Record<string, unknown>; content?: AdfNode[] };
type Write = { path: string; method: string; input: { body?: AdfNode; fields?: { description?: AdfNode }; files?: string[] } };
type QaWindow = { __qa: { writes: Write[]; delayMs: number; failNextWrite: boolean; withholdMediaId?: boolean } };

const ISSUE = (key: string) => `/tests/browser/fixture.html?scenario=adf-images&route=/issue/${key}`;
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const UPLOADED = /^image-\d{8}-\d{6}\.png$/;

const section = (page: Page, name: RegExp) => page.locator("section").filter({ has: page.getByRole("heading", { name }) });
const comments = (page: Page) => section(page, /^Kommentare/);
const description = (page: Page) => section(page, /^Beschreibung$/);
const composer = (page: Page) => page.getByRole("textbox", { name: "Kommentar", exact: true });
const editorImages = (editor: Locator) => editor.locator('[data-adf-editor-media="mediaSingle"] [data-adf-media="image"]');
const toast = (page: Page, text: string) => page.locator("[data-sonner-toast]").filter({ hasText: text });
const writes = (page: Page) => page.evaluate(() => (window as unknown as QaWindow).__qa.writes);
const qaSet = (page: Page, values: Partial<QaWindow["__qa"]>) =>
  page.evaluate((next) => Object.assign((window as unknown as QaWindow).__qa, next), values);

const sendFile = (target: Locator, kind: "paste" | "drop", name: string, type: string, base64: string) =>
  target.evaluate(
    (element, file) => {
      const bytes = Uint8Array.from(atob(file.base64), (char) => char.charCodeAt(0));
      const data = new DataTransfer();
      data.items.add(new File([bytes], file.name, { type: file.type }));
      const box = element.getBoundingClientRect();
      const init = { bubbles: true, cancelable: true, clientX: box.left + 24, clientY: box.bottom - 12 };
      element.dispatchEvent(
        file.kind === "paste" ? new ClipboardEvent("paste", { ...init, clipboardData: data }) : new DragEvent("drop", { ...init, dataTransfer: data }),
      );
    },
    { kind, name, type, base64 },
  );

const mediaOf = (node: AdfNode | undefined) => node?.content?.[0];

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("fügt ein Bild aus der Zwischenablage ein, schreibt dahinter weiter und sendet beides", async ({ page }) => {
  await page.goto(ISSUE("DEMO-2"));
  const editor = composer(page);
  await editor.click();
  await page.keyboard.type("Vorher");
  await sendFile(editor, "paste", "image.png", "image/png", PNG);

  await expect(editorImages(editor)).toHaveCount(1);
  await expect(editorImages(editor)).toHaveAttribute("data-state", "loaded");
  await expect(editor.locator("[data-adf-upload]")).toHaveCount(0);
  await expect(editor.getByText("[Anhang]")).toHaveCount(0);
  await page.keyboard.type("Nachher");
  await comments(page).getByRole("button", { name: "Kommentieren" }).click();
  await expect(toast(page, "Kommentar hinzugefügt")).toBeVisible();

  const all = await writes(page);
  const upload = all.find((write) => write.path === "/issue/DEMO-2/attachments");
  expect(upload?.input.files?.[0]).toMatch(UPLOADED);
  const body = all.find((write) => write.path === "/issue/DEMO-2/comment")?.input.body;
  expect(body?.content?.map((node) => node.type)).toEqual(["paragraph", "mediaSingle", "paragraph"]);
  expect(body?.content?.[0]?.content?.[0]?.text).toBe("Vorher");
  expect(body?.content?.[2]?.content?.[0]?.text).toBe("Nachher");
  const media = mediaOf(body?.content?.[1]);
  expect(media?.attrs).toMatchObject({ type: "file", collection: "", width: 1, height: 1 });
  expect(media?.attrs?.id).toMatch(/^00000000-0000-4000-8000-\d{12}$/);
  expect(media?.attrs?.alt).toMatch(UPLOADED);

  const posted = comments(page).locator("ol > li").filter({ hasText: "Nachher" });
  await expect(posted.locator('[data-adf-media="image"]')).toBeVisible();
});

test("legt ein gezogenes Bild im Text ab und sendet einen Kommentar, der nur aus dem Bild besteht", async ({ page }) => {
  await page.goto(ISSUE("DEMO-2"));
  const editor = composer(page);
  await editor.click();
  await sendFile(editor, "drop", "Skizze Ablauf.png", "image/png", PNG);

  await expect(editorImages(editor)).toHaveCount(1);
  await expect(editor).toBeFocused();
  const send = comments(page).getByRole("button", { name: "Kommentieren" });
  await expect(send).toBeEnabled();
  await send.click();
  await expect(toast(page, "Kommentar hinzugefügt")).toBeVisible();

  const body = (await writes(page)).find((write) => write.path === "/issue/DEMO-2/comment")?.input.body;
  expect(body?.content?.map((node) => node.type)).toEqual(["mediaSingle"]);
  expect(mediaOf(body?.content?.[0])?.attrs?.alt).toBe("Skizze Ablauf.png");
});

test("sperrt das Senden, solange ein Bild hochlädt, und zeigt dabei einen Platzhalter", async ({ page }) => {
  await page.goto(ISSUE("DEMO-2"));
  const editor = composer(page);
  await editor.click();
  await page.keyboard.type("Text");
  await qaSet(page, { delayMs: 1200 });
  await sendFile(editor, "paste", "image.png", "image/png", PNG);

  await expect(editor.locator('[data-adf-upload="pending"]')).toBeVisible();
  await expect(comments(page).getByText("Bild wird hochgeladen")).toBeVisible();
  const send = comments(page).getByRole("button", { name: "Kommentieren" });
  await expect(send).toBeDisabled();
  await page.keyboard.press("Control+Enter");
  await expect(editorImages(editor)).toHaveCount(1);
  expect((await writes(page)).some((write) => write.path === "/issue/DEMO-2/comment")).toBe(false);
  await qaSet(page, { delayMs: 0 });
  await expect(send).toBeEnabled();
});

test("meldet einen fehlgeschlagenen Upload und lässt den Text unverändert", async ({ page }) => {
  await page.goto(ISSUE("DEMO-2"));
  const editor = composer(page);
  await editor.click();
  await page.keyboard.type("Bleibt stehen");
  await qaSet(page, { failNextWrite: true });
  await sendFile(editor, "paste", "image.png", "image/png", PNG);

  await expect(toast(page, "konnte nicht eingefügt werden")).toBeVisible();
  await expect(editor.locator("[data-adf-upload]")).toHaveCount(0);
  await expect(editorImages(editor)).toHaveCount(0);
  await expect(editor).toHaveText("Bleibt stehen");

  await qaSet(page, { withholdMediaId: true });
  await sendFile(editor, "paste", "image.png", "image/png", PNG);
  await expect(toast(page, "keine Medien-Kennung")).toBeVisible();
  await expect(editorImages(editor)).toHaveCount(0);
});

test("zeigt vorhandene Bilder beim Bearbeiten eines Kommentars und lässt dahinter schreiben", async ({ page }) => {
  await page.goto(ISSUE("DEMO-1"));
  const entry = comments(page).locator('article[data-comment-id="c-img"]');
  await entry.getByRole("button", { name: "Weitere Aktionen", exact: true }).click();
  await page.getByRole("menuitem", { name: /^Bearbeiten/ }).click();
  const editor = page.getByRole("textbox", { name: "Kommentar bearbeiten" });
  await expect(editor).toBeFocused();

  await expect(editor.locator('[data-adf-media="image"][data-attachment-id="46887"]')).toBeVisible();
  await expect(editor.getByText("[Anhang]")).toHaveCount(0);
  const save = entry.getByRole("button", { name: "Speichern" });
  await expect(save).toBeDisabled();

  await page.keyboard.type("Danach");
  await expect(save).toBeEnabled();
  await save.click();
  await expect(toast(page, "Kommentar gespeichert")).toBeVisible();

  const body = (await writes(page)).find((write) => write.method === "PUT" && write.path.endsWith("/comment/c-img"))?.input.body;
  expect(body?.content?.map((node) => node.type)).toEqual(["paragraph", "mediaSingle", "paragraph"]);
  expect(mediaOf(body?.content?.[1])?.attrs?.id).toBe("uuid-f");
  expect(body?.content?.[2]?.content?.[0]?.text).toBe("Danach");
});

test("entfernt ein Bild über den Knopf am Bild", async ({ page }) => {
  await page.goto(ISSUE("DEMO-2"));
  const editor = composer(page);
  await editor.click();
  await sendFile(editor, "paste", "image.png", "image/png", PNG);
  await expect(editorImages(editor)).toHaveCount(1);

  await editorImages(editor).hover();
  await editor.getByRole("button", { name: "Aus dem Text entfernen" }).click();
  await expect(editorImages(editor)).toHaveCount(0);
});

test("bearbeitet die Beschreibung im Editor mit eingebetteten Bildern und speichert ein neues Bild", async ({ page }) => {
  await page.goto(ISSUE("DEMO-1"));
  await description(page).getByText("Vorher:").click();
  const editor = page.getByRole("textbox", { name: "Beschreibung" });
  await expect(editor).toBeFocused();
  await expect(editor.locator('[data-adf-media="image"][data-attachment-id="46883"]')).toBeVisible();
  await expect(editor.locator('[data-adf-media="image"][data-attachment-id="46884"]')).toBeAttached();
  await expect(editor.getByText("[Anhang]")).toHaveCount(0);

  await sendFile(editor, "paste", "image.png", "image/png", PNG);
  await expect(editorImages(editor)).toHaveCount(3);
  await description(page).getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByRole("textbox", { name: "Beschreibung" })).toHaveCount(0);

  const saved = (await writes(page)).find((write) => write.method === "PUT" && write.path === "/issue/DEMO-1")?.input.fields?.description;
  const singles = saved?.content?.filter((node) => node.type === "mediaSingle") ?? [];
  expect(singles.map((node) => mediaOf(node)?.attrs?.id).filter((id) => typeof id === "string" && id.startsWith("00000000"))).toHaveLength(1);
  expect(saved?.content?.[0]?.content?.[0]?.text).toBe("Vorher:");
  expect(saved?.content?.at(-2)?.content?.[0]?.text).toBe("Fülltext 40 für den Abstand zu den Kommentaren.");
  expect(mediaOf(saved?.content?.at(-1))?.attrs?.alt).toMatch(UPLOADED);
  await expect(description(page).locator('[data-adf-media="image"][data-attachment-id^="qa-upload-"]')).toBeVisible();
});

test("wechselt für die Beschreibung auf Wiki-Markup und zurück", async ({ page }) => {
  await page.goto(ISSUE("DEMO-2"));
  await page.getByRole("button", { name: "Beschreibung bearbeiten" }).click();
  await expect(page.getByRole("textbox", { name: "Beschreibung" })).toBeVisible();
  await description(page).getByRole("button", { name: "Wiki-Markup" }).click();
  await expect(page.getByRole("textbox", { name: "Text bearbeiten" })).toBeVisible();
  await description(page).getByRole("button", { name: "Zum Editor" }).click();
  await expect(page.getByRole("textbox", { name: "Beschreibung" })).toBeVisible();
});
