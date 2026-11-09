import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __qaBoardPages: { tokens: (string | null)[]; fail: boolean };
  }
}

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => { throw error; });
  await page.addInitScript(() => {
    window.__qaBoardPages ??= { tokens: [], fail: false };
    window.__qaSearchRule = (jql, token) => {
      if (!jql.startsWith("filter = 100")) return {};
      window.__qaBoardPages.tokens.push(token);
      if (token && window.__qaBoardPages.fail) return { status: 503 };
      const issue = (id: number, statusId: string, name: string) => ({
        id: String(id),
        key: `DEMO-${id}`,
        fields: {
          summary: `Support Request ${id}`,
          status: { id: statusId, name, statusCategory: { key: "indeterminate", colorName: "yellow" } },
          assignee: null,
          created: "2026-11-01T09:00:00Z",
          issuetype: { name: "Support Request" },
        },
      });
      return token
        ? { issues: [issue(101, "3", "In Arbeit")] }
        : { issues: Array.from({ length: 100 }, (_, index) => issue(index + 1, "10", "Triage")), nextPageToken: "support-page-2" };
    };
  });
});

test("Board lädt mehr als 100 Tickets und befüllt die Spalten aus Folgeseiten", async ({ page }) => {
  await page.goto("/tests/browser/fixture.html?scenario=board&route=/bereiche/DEMO?board=1");
  const main = page.getByRole("main");
  await expect(main.getByText("101 Vorgänge", { exact: true })).toBeVisible();
  await expect(main.getByRole("link", { name: "Support Request 100", exact: true })).toHaveCount(1);
  await expect(main.getByRole("link", { name: "Support Request 101", exact: true })).toHaveCount(1);
  const columns = main.locator("section").filter({ has: page.getByRole("heading", { name: /In Arbeit/ }) });
  await expect(columns.getByRole("link", { name: "Support Request 101", exact: true })).toHaveCount(1);
  expect(await page.evaluate(() => window.__qaBoardPages.tokens)).toEqual([null, "support-page-2"]);
  await expect(main.getByRole("alert")).toHaveCount(0);
});

test("Folgeseitenfehler zeigt Retry und niemals ein erfolgreiches Teilboard", async ({ page }) => {
  await page.addInitScript(() => {
    window.__qaBoardPages = { tokens: [], fail: true };
  });
  await page.goto("/tests/browser/fixture.html?scenario=board&route=/bereiche/DEMO?board=1");
  const main = page.getByRole("main");
  const error = main.getByRole("alert").filter({ hasText: "Board konnte nicht geladen werden" });
  await expect(error).toBeVisible();
  await expect(main.getByRole("link", { name: "Support Request 1", exact: true })).toHaveCount(0);
  await page.evaluate(() => { window.__qaBoardPages.fail = false; });
  await error.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(main.getByText("101 Vorgänge", { exact: true })).toBeVisible();
  await expect(error).toHaveCount(0);
});
