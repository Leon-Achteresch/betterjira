import { expect, test, type Page, type TestInfo } from "@playwright/test";

declare global {
  interface Window {
    __qa: { commands: string[]; writes: { path: string }[]; opened?: string[]; delayMs: number };
  }
}

const URL = "/tests/browser/fixture.html?scenario=attachments&route=/issue/DEMO-1";

const openAttachments = async (page: Page) => {
  await page.goto(URL);
  await page.getByRole("button", { name: "Details öffnen" }).click();
  await page.getByRole("tab", { name: /^Anhänge · 7/ }).click();
  await expect(list(page).getByRole("listitem")).toHaveCount(7);
};

const list = (page: Page) => page.getByRole("list", { name: "Anhänge" });
const visibleNames = (page: Page) => list(page).locator("li:not([hidden]) button span.truncate");
const search = (page: Page) => page.getByRole("searchbox", { name: "Anhänge nach Dateiname durchsuchen" });
const kind = (page: Page, label: string) => page.getByRole("radiogroup", { name: "Dateityp" }).getByRole("radio", { name: label });
const httpCalls = (page: Page) => page.evaluate(() => window.__qa.commands.filter((command) => command === "plugin:http|fetch_send").length);

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  const dir = process.env.ATTACHMENT_FILTER_SHOTS;
  if (dir) await page.screenshot({ path: `${dir}/${testInfo.project.name}-${name}.png` });
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("filtert nach Name und Typ ohne neue Anfragen und setzt zurück", async ({ page }, testInfo) => {
  await openAttachments(page);
  await expect(page.getByRole("button", { name: "Unbenannte Datei" })).toBeVisible();
  await expect(list(page).locator('[data-slot="skeleton"]')).toHaveCount(0);
  const before = await httpCalls(page);

  await search(page).fill("(final) [v2]");
  await expect(visibleNames(page)).toHaveText(["Angebot (final) [v2].pdf"]);
  await expect(page.getByRole("status").filter({ hasText: "1 von 7 Anhängen" })).toBeVisible();

  await search(page).fill("");
  await kind(page, "Bilder").click();
  await expect(visibleNames(page)).toHaveText(["Screenshot Übergabe.png"]);
  await kind(page, "Dokumente").click();
  await expect(visibleNames(page)).toHaveText([/^Angebot/, /^Protokoll/, "export.csv"]);
  await kind(page, "Andere").click();
  await expect(visibleNames(page)).toHaveText(["archiv.zip", "Unbenannte Datei", "bericht.pdf"]);
  await shot(page, testInfo, "andere");

  await search(page).fill("übergabe");
  await expect(visibleNames(page)).toHaveCount(0);
  await expect(page.getByText("Keiner der 7 geladenen Anhänge passt zu Suche und Dateityp.")).toBeVisible();
  await shot(page, testInfo, "keine-treffer");
  await page.getByRole("status").filter({ hasText: "Keiner der" }).getByRole("button", { name: "Filter zurücksetzen" }).click();
  await expect(search(page)).toHaveValue("");
  await expect(kind(page, "Alle")).toHaveAttribute("aria-checked", "true");
  await expect(visibleNames(page)).toHaveCount(7);

  expect(await httpCalls(page)).toBe(before);
});

test("Dateiaktionen und Upload bleiben bei aktivem Filter nutzbar", async ({ page }) => {
  await openAttachments(page);
  await search(page).fill("bericht");
  await page.getByRole("button", { name: "bericht.pdf" }).click();
  await expect.poll(() => page.evaluate(() => window.__qa.opened)).toEqual(["https://example.atlassian.net/rest/api/3/attachment/content/att-7"]);

  await search(page).fill("screenshot");
  await page.getByRole("button", { name: "Screenshot Übergabe.png" }).click();
  const preview = page.getByRole("dialog", { name: "Screenshot Übergabe.png", exact: true });
  await expect(preview.getByRole("img", { name: "Screenshot Übergabe.png" })).toBeVisible();
  await expect(preview.getByRole("button", { name: "Close", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(preview).toHaveCount(0);
  await expect(search(page)).toHaveValue("screenshot");
  await expect(list(page)).toBeVisible();

  await page.evaluate(() => (window.__qa.delayMs = 800));
  const upload = page.getByRole("button", { name: "Datei anhängen" });
  await page.locator('input[type="file"]').setInputFiles({ name: "qa.txt", mimeType: "text/plain", buffer: Buffer.from("lokal") });
  await expect(upload).toBeDisabled();
  await search(page).fill("angebot");
  await kind(page, "Dokumente").click();
  await expect(upload).toBeDisabled();
  await expect(upload).toBeEnabled();
  const writes = await page.evaluate(() => window.__qa.writes.map((write) => write.path));
  expect(writes).toEqual(["/issue/DEMO-1/attachments"]);
});

test("per Tastatur bedienbar und bei 390 px ohne Überlauf", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAttachments(page);
  await search(page).focus();
  await page.keyboard.type("export");
  await expect(visibleNames(page)).toHaveText(["export.csv"]);
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Backspace");
  await expect(search(page)).toHaveValue("");
  await kind(page, "Alle").focus();
  await page.keyboard.press("ArrowRight");
  await expect(kind(page, "Bilder")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(kind(page, "Bilder")).toHaveAttribute("aria-checked", "true");
  await expect(visibleNames(page)).toHaveCount(1);
  await page.keyboard.press("ArrowRight");
  await expect(kind(page, "Dokumente")).toBeFocused();
  await page.keyboard.press("Space");
  await expect(visibleNames(page)).toHaveText([/^Angebot/, /^Protokoll/, "export.csv"]);

  const overflow = await page.getByRole("tabpanel").evaluate((panel) => {
    const box = panel.getBoundingClientRect();
    return [...panel.querySelectorAll("*")].some((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && !node.closest("[hidden]") && (rect.right > box.right + 1 || rect.left < box.left - 1);
    });
  });
  expect(overflow).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await shot(page, testInfo, "390");
});
