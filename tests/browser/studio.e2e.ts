import { expect, test, type Page } from "@playwright/test";

const open = (page: Page, route: string) =>
  page.goto(`/tests/browser/fixture.html?${new URLSearchParams({ route, scenario: "studio" })}`);

test("Studio bleibt aktiv und das klassische Design lässt sich wieder auswählen", async ({ page }) => {
  await open(page, "/settings/darstellung");
  const studio = page.getByRole("radio", { name: "Studio" });
  const light = page.getByRole("radio", { name: "Hell" });
  const html = page.locator("html");
  const create = page.getByRole("link", { name: "Ticket erstellen" });

  await expect(light.locator(".light")).toHaveCSS("color-scheme", "light");
  await expect(studio.locator(".studio")).toHaveCSS("background-color", "rgb(251, 250, 248)");
  await studio.click();
  await expect(html).toHaveClass(/\bstudio\b/);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(251, 250, 248)");
  await expect(create).toHaveCSS("background-color", "rgb(81, 70, 161)");
  await create.click();
  await expect(create).toHaveAttribute("aria-current", "page");
  await expect(create).not.toHaveCSS("background-color", "rgb(81, 70, 161)");
  await open(page, "/settings/darstellung");
  await expect(studio).toBeChecked();
  await light.click();
  await expect(light).toBeChecked();
  await expect(html).toHaveClass(/\blight\b/);
  await expect(create).not.toHaveCSS("background-color", "rgb(81, 70, 161)");
});

test("Studio gruppiert Vorgänge direkt und navigiert zwischen Ticketlinks", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("theme", "studio"));
  await open(page, "/bereiche/DEMO");
  const grouping = page.getByRole("button", { name: "Nach Status", exact: true });
  const group = page.getByRole("button", { name: /In Arbeit: 3 geladene Vorgänge/ });
  const links = page.locator("[data-issue-grid] a[data-row-link]");
  await expect(links).toHaveCount(3);
  await expect(grouping).toHaveAttribute("aria-pressed", "false");
  await grouping.click();
  await expect(grouping).toHaveAttribute("aria-pressed", "true");
  await expect(group).toHaveAttribute("aria-expanded", "true");

  const first = links.nth(0);
  const second = links.nth(1);
  await first.focus();
  await first.press("ArrowDown");
  await expect(second).toBeFocused();
  await second.press("ArrowUp");
  await expect(first).toBeFocused();

  await grouping.click();
  await expect(grouping).toHaveAttribute("aria-pressed", "false");
  await expect(group).toHaveCount(0);
  expect(await page.evaluate(() => window.__qa.writes)).toEqual([]);

  await page.keyboard.press("ControlOrMeta+k");
  await page.getByPlaceholder("Vorgänge, Bereiche, Filter oder Befehle suchen…").fill("Jira-Tickets: Beobachtet");
  await page.getByRole("option", { name: "Jira-Tickets: Beobachtet", exact: true }).click();
  await expect(page).toHaveURL(/\/tickets\?ansicht=beobachtet$/);

  await page.setViewportSize({ width: 390, height: 900 });
  await expect(grouping).toBeInViewport({ ratio: 1 });
  await expect(page.getByRole("button", { name: "Ansicht und Export" })).toBeInViewport({ ratio: 1 });

  await page.setViewportSize({ width: 320, height: 900 });
  await expect(page.getByRole("link", { name: "Alle meine" })).toBeInViewport({ ratio: 1 });
  const menu = page.getByRole("button", { name: "Weitere Aktionen" });
  const minimize = page.getByRole("button", { name: "Minimieren" });
  if (await minimize.isVisible()) {
    const [menuBox, minimizeBox] = await Promise.all([menu.boundingBox(), minimize.boundingBox()]);
    expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(minimizeBox!.x);
  }
  await menu.click();
  await expect(page.getByRole("menuitem", { name: /Ticket erstellen/ })).toBeVisible();
});

test("Studio zeigt den aktuellen Bereich und offene Tickets in einer eigenen Leiste", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("theme", "studio"));
  await open(page, "/issue/DEMO-1");
  const header = page.getByRole("banner");
  const strip = page.locator('[data-slot="studio-tab-strip"]');
  const tab = strip.getByRole("tab", { name: /DEMO-1/ });
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await expect(header.getByRole("tab", { name: /DEMO-1/ })).toHaveCount(0);

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(header.getByText("Jira-Tickets", { exact: true })).toBeVisible();
  const dock = page.getByRole("complementary", { name: "Arbeitsnavigation" });
  await expect(dock.getByRole("link", { name: "Jira-Tickets", exact: true })).toHaveAttribute("data-active", "true");
  await expect(dock.getByRole("link", { name: "BetterJira", exact: true })).toBeVisible();
  const panel = header.getByRole("button", { name: "Bereiche und Filter" });
  await expect(panel).toHaveAttribute("aria-expanded", "false");
  await panel.click();
  await expect(panel).toHaveAttribute("aria-expanded", "true");
  await expect(dock.getByRole("link", { name: "Jira-Tickets", exact: true })).toBeVisible();
  await expect(tab).toBeInViewport();
  await page.setViewportSize({ width: 390, height: 900 });
  await expect(tab).toBeInViewport();
  await expect(dock).toBeHidden();

  await header.getByRole("button", { name: "Weitere Aktionen", exact: true }).click();
  await page.getByRole("menuitem", { name: "Systemdesign verwenden" }).click();
  await expect(strip).toHaveCount(0);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(header.getByRole("tab", { name: /DEMO-1/ })).toBeVisible();
});

test("Studio öffnet Jira-Tickets neben der Liste und gibt den Fokus beim Schließen zurück", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("theme", "studio"));
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, "/tickets");
  const first = page.locator("[data-row-link]").first();
  await first.press("Enter");

  const preview = page.getByRole("complementary", { name: "Ticketvorschau DEMO-1" });
  await expect(page).toHaveURL(/\/tickets$/);
  await expect(first).toBeVisible();
  await expect(preview).toBeFocused();
  await expect(preview.getByRole("heading", { name: /Suche für den Arbeitsalltag/ })).toBeVisible();
  await expect(preview.getByRole("complementary", { name: "Eigenschaften" })).toBeVisible();
  await preview.getByRole("button", { name: "Fällig bearbeiten", exact: true }).click();
  await preview.getByRole("button", { name: "Kalender öffnen" }).click();
  const calendar = page.getByRole("dialog", { name: "Datum auswählen" });
  await calendar.getByRole("button", { name: /13\..*November/ }).click();
  await expect(preview.locator("#field-duedate")).toHaveValue("2026-11-13");
  await preview.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__qa.writes)).toContainEqual(expect.objectContaining({
    method: "PUT",
    input: { fields: { duedate: "2026-11-13" } },
  }));
  await preview.getByRole("button", { name: "Vorschau schließen" }).click();
  await expect(preview).toHaveCount(0);
  await expect(first).toBeFocused();

  await first.click();
  await preview.getByRole("link", { name: "Ticket vollständig öffnen" }).click();
  await expect(page).toHaveURL(/\/issue\/DEMO-1$/);
});
