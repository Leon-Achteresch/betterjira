import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __qa: {
      sessionFailure: boolean;
    };
  }
}

const open = (page: Page, route: string, scenario: string) =>
  page.goto(`/tests/browser/fixture.html?${new URLSearchParams({ route, scenario })}`);

const main = (page: Page) => page.getByRole("main");

const sidebarFooter = async (page: Page) => {
  if ((page.viewportSize()?.width ?? 0) < 768) await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  const footer = page.locator('[data-sidebar="footer"]:visible');
  await expect(footer).toBeVisible();
  return footer;
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("Eine verzögerte Sitzung zeigt Laden statt Anmeldung", async ({ page }) => {
  await open(page, "/", "session-slow");
  await expect(main(page).getByRole("status")).toBeVisible();
  await expect(page.getByRole("button", { name: "Mit Atlassian verbinden" })).toHaveCount(0);
  await expect(main(page).getByRole("heading", { level: 1 })).toContainText("Alex");
  await expect(page.getByText("Anmeldung konnte nicht geprüft werden")).toHaveCount(0);
});

test("Ohne Sitzung bleibt der Anmeldefluss, ein Abbruch bleibt verständlich", async ({ page }) => {
  await open(page, "/", "calendar-offline");
  const login = main(page).getByRole("button", { name: "Mit Atlassian verbinden" });
  await expect(login).toBeVisible();
  await login.click();
  await expect(main(page).getByRole("alert")).toBeVisible();
  await expect(login).toBeEnabled();
  await expect(page.getByText("Anmeldung konnte nicht geprüft werden")).toHaveCount(0);
  const footer = await sidebarFooter(page);
  await expect(footer.getByRole("button", { name: "Mit Atlassian verbinden" })).toBeVisible();
});

test("Ein Lesefehler ist auf Übersicht und Seitenleiste keine Abmeldung, Retry verbindet", async ({ page }) => {
  await open(page, "/", "session-error");
  await expect(main(page).getByText("Anmeldung konnte nicht geprüft werden", { exact: true })).toBeVisible();
  await expect(main(page).getByText("Anmeldedaten konnten nicht gelesen werden", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mit Atlassian verbinden" })).toHaveCount(0);

  const footer = await sidebarFooter(page);
  const retry = footer.getByRole("button", { name: "Anmeldung nicht geprüft Erneut prüfen", exact: true });
  await expect(retry).toBeVisible();
  await expect(footer.getByRole("button", { name: "Mit Atlassian verbinden" })).toHaveCount(0);

  await page.evaluate(() => {
    window.__qa.sessionFailure = false;
  });
  await retry.click();
  await expect(footer.getByText("Alex Beispiel")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(main(page).getByRole("heading", { level: 1 })).toContainText("Alex");
  await expect(page.getByText("Anmeldung konnte nicht geprüft werden")).toHaveCount(0);
});
