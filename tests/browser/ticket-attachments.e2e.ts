import { expect, test, type Page, type TestInfo } from "@playwright/test";

type QaWindow = { __qa: { opened?: string[]; commands: string[] } };

const ISSUE = (key: string) => `/tests/browser/fixture.html?scenario=attachments&route=/issue/${key}`;
const section = (page: Page) => page.locator("section").filter({ has: page.getByRole("heading", { name: /^Anhänge/ }) });
const list = (page: Page) => page.getByRole("list", { name: "Anhänge am Ticket" });
const names = (page: Page) => list(page).locator("li button span.truncate");
const showAll = (page: Page) => section(page).getByRole("button", { name: "Alle anzeigen" });
const opened = (page: Page) => page.evaluate(() => (window as unknown as QaWindow).__qa.opened ?? []);

const attachment = (id: string, filename: string, mimeType: string, created: string) => ({
  id,
  filename,
  mimeType,
  size: 2048,
  created,
  author: { accountId: "qa-user", displayName: "Alex Beispiel", avatarUrls: { "48x48": "/logo.svg" } },
});

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  const dir = process.env.TICKET_ATTACHMENTS_SHOTS;
  if (dir) await page.screenshot({ path: `${dir}/${testInfo.project.name}-${name}.png` });
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("zeigt Anhänge direkt unter der Beschreibung und führt zur vollständigen Liste", async ({ page }, testInfo) => {
  await page.goto(ISSUE("DEMO-1"));
  await expect(section(page).getByRole("heading", { name: "Anhänge · 7" })).toBeVisible();
  await expect(names(page)).toHaveText([
    "Screenshot Übergabe.png",
    "Angebot (final) [v2].pdf",
    /^Protokoll_Abstimmung/,
    "export.csv",
    "archiv.zip",
    "Unbenannte Datei",
  ]);
  await expect(list(page).locator("img")).toHaveCount(1);

  const order = await page.evaluate(() =>
    [...document.querySelectorAll("section h2")].map((heading) => heading.textContent?.replace(/ · .*/, "") ?? ""),
  );
  expect(order.indexOf("Anhänge")).toBe(order.indexOf("Beschreibung") + 1);
  await shot(page, testInfo, "abschnitt");

  await showAll(page).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("tab", { name: /^Anhänge · 7/ })).toHaveAttribute("aria-selected", "true");
  await expect(drawer.getByRole("list", { name: "Anhänge", exact: true }).getByRole("listitem")).toHaveCount(7);
});

test("öffnet Bilder in der Großansicht und Dateien extern", async ({ page }) => {
  await page.goto(ISSUE("DEMO-1"));
  await list(page).getByRole("button", { name: /^Screenshot Übergabe\.png/ }).click();
  const preview = page.getByRole("dialog", { name: "Screenshot Übergabe.png", exact: true });
  await expect(preview.getByRole("img", { name: "Screenshot Übergabe.png" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(preview).toHaveCount(0);
  expect(await opened(page)).toEqual([]);

  await list(page).getByRole("button", { name: /^export\.csv/ }).focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => opened(page)).toEqual(["https://example.atlassian.net/rest/api/3/attachment/content/att-4"]);
});

test("blendet die Kacheln auch ein, wenn das Ticket aus dem Cache öffnet", async ({ page }) => {
  await page.goto(ISSUE("DEMO-1"));
  const opacities = () => list(page).locator("li").evaluateAll((items) => items.map((item) => getComputedStyle(item).opacity));
  await expect.poll(opacities).toEqual(Array(6).fill("1"));
  await page.locator("section").filter({ has: page.getByRole("heading", { name: /^Verknüpfungen/ }) })
    .getByRole("link", { name: /DEMO-2/ }).first().click();
  await expect(page).toHaveURL(/\/issue\/DEMO-2$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/issue\/DEMO-1$/);
  await expect(names(page)).toHaveCount(6);
  await expect.poll(opacities).toEqual(Array(6).fill("1"));
});

test("zeigt die neuesten zuerst und bei wenigen Anhängen keinen Verweis", async ({ page }) => {
  await page.addInitScript((files) => Object.assign(window, { __qaAttachments: files }), [
    attachment("att-alt", "alt.txt", "text/plain", "2026-11-01T09:00:00.000+0100"),
    attachment("att-neu", "neu.txt", "text/plain", "2026-11-05T09:00:00.000+0100"),
  ]);
  await page.goto(ISSUE("DEMO-1"));
  await expect(section(page).getByRole("heading", { name: "Anhänge · 2" })).toBeVisible();
  await expect(names(page)).toHaveText(["neu.txt", "alt.txt"]);
  await expect(showAll(page)).toHaveCount(0);
});

test("lässt den Abschnitt ohne Anhänge weg", async ({ page }) => {
  await page.addInitScript(() => Object.assign(window, { __qaAttachments: [] }));
  await page.goto(ISSUE("DEMO-1"));
  await expect(page.getByRole("heading", { name: /^Kommentare/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Anhänge/ })).toHaveCount(0);
  await expect(list(page)).toHaveCount(0);
});

test("bleibt bei 390 px ohne Überlauf", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(ISSUE("DEMO-1"));
  await expect(names(page)).toHaveCount(6);
  const overflow = await list(page).evaluate((element) => {
    const box = element.getBoundingClientRect();
    return [...element.querySelectorAll("*")].some((node) => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0 && (rect.right > box.right + 1 || rect.left < box.left - 1);
    });
  });
  expect(overflow).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await shot(page, testInfo, "390");
});
