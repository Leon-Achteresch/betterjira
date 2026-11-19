import { expect, test, type Page } from "@playwright/test";

const open = (page: Page, route: string) =>
  page.goto(`/tests/browser/fixture.html?${new URLSearchParams({ route })}`);

test("Studio bleibt aktiv und das klassische Design lässt sich wieder auswählen", async ({ page }) => {
  await open(page, "/settings/darstellung");
  const studio = page.getByRole("radio", { name: "Studio" });
  const light = page.getByRole("radio", { name: "Hell" });
  const html = page.locator("html");
  const create = page.getByRole("link", { name: "Ticket erstellen" });

  await expect(light.locator(".light")).toHaveCSS("color-scheme", "light");
  await expect(studio.locator(".studio")).toHaveCSS("background-color", "rgb(16, 19, 22)");
  await studio.click();
  await expect(html).toHaveClass(/\bstudio\b/);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(16, 19, 22)");
  await expect(create).toHaveCSS("background-color", "rgb(132, 229, 190)");
  await create.click();
  await expect(create).toHaveAttribute("aria-current", "page");
  await expect(create).not.toHaveCSS("background-color", "rgb(132, 229, 190)");
  await open(page, "/settings/darstellung");
  await expect(studio).toBeChecked();
  await light.click();
  await expect(light).toBeChecked();
  await expect(html).toHaveClass(/\blight\b/);
  await expect(create).not.toHaveCSS("background-color", "rgb(132, 229, 190)");
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
