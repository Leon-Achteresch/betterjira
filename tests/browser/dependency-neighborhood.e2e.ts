import { expect, test, type Page } from "@playwright/test";

const ticket = (key: string) => `/tests/browser/fixture.html?scenario=multi-links&route=/issue/${key}`;
const trigger = (page: Page) => page.getByRole("button", { name: "Abhängigkeiten ansehen", exact: true });
const popup = (page: Page) => page.getByRole("dialog", { name: "Abhängigkeiten ansehen" });
const load = (page: Page) => popup(page).getByRole("button", { name: "Abhängigkeiten laden" });
const row = (page: Page, key: string) => popup(page).locator(`[data-ticket-key="${key}"]`);
const linkReads = (page: Page) => page.evaluate(() => {
  const qa: { issueReads: string[] } = Reflect.get(window, "__qa");
  return qa.issueReads.filter((path) => path.endsWith("?fields=issuelinks"));
});
const writes = (page: Page) => page.evaluate(() => Reflect.get(window, "__qa").writes);
const choose = async (page: Page, direction: "ausgehend" | "eingehend") => {
  await popup(page).getByRole("combobox", { name: "Beziehung und Richtung" }).press("Enter");
  await page.getByRole("option", { name: new RegExp(`Blocks .*\\(${direction}\\)`) }).press("Enter");
};
type FixtureRelation = [key: string, direction?: "outward" | "inward", type?: string];
type FixtureIssue = { links?: FixtureRelation[]; status?: number; delayMs?: number };
const fixture = (page: Page, issues: Record<string, FixtureIssue>) => page.addInitScript((records) => {
  Reflect.set(window, "__qaIssueLinksRule", (key: string) => {
    const rule = records[key];
    return {
      status: rule?.status,
      delayMs: rule?.delayMs,
      issuelinks: (rule?.links ?? []).map(([target, direction = "outward", id = "10000"], index) => ({
        id: `${index + 1}`,
        type: { id, name: "Blocks", outward: "blocks", inward: "is blocked by" },
        [`${direction}Issue`]: { key: target },
      })),
    };
  });
}, issues);

test("liest gewählte Richtungen, zeigt Mehrfachpfade und Zyklen einmal und meldet fehlende Rechte", async ({ page }, info) => {
  if (info.project.name === "narrow-dark-reduced") await page.setViewportSize({ width: 390, height: 844 });
  await fixture(page, {
    "DEMO-1": { links: [["DEMO-2"], ["DEMO-2"], ["DEMO-3"], ["DEMO-6"], ["DEMO-4", "inward"], ["DEMO-8", "outward", "unselected"]] },
    "DEMO-2": { links: [["OPS-7"], ["DEMO-1"]] },
    "DEMO-3": { links: [["OPS-7"], ["DEMO-7", "inward"]] },
    "DEMO-4": { links: [["DEMO-5", "inward"]] },
    "DEMO-6": { status: 403 },
  });
  await page.goto(ticket("DEMO-1"));
  await expect.poll(() => linkReads(page)).toEqual(["/issue/DEMO-1?fields=issuelinks"]);
  await trigger(page).press("Enter");
  await expect(popup(page)).toContainText("Ausgangsticket DEMO-1");
  await expect(load(page)).toBeDisabled();
  await choose(page, "ausgehend");
  expect(await linkReads(page)).toHaveLength(1);
  await load(page).press("Enter");
  await expect(popup(page).getByRole("status")).toContainText("4 verbundene Tickets · 6 Beziehungen · 4 von 8 Abrufen");
  await expect(row(page, "DEMO-1")).toContainText("DEMO-2 → DEMO-1");
  await expect(row(page, "OPS-7")).toHaveCount(1);
  await expect(row(page, "OPS-7")).toContainText("DEMO-2 → OPS-7 · DEMO-3 → OPS-7");
  await expect(row(page, "OPS-7")).toContainText("Tiefengrenze erreicht");
  await expect(row(page, "DEMO-6")).toContainText("Kein Lesezugriff");
  await expect(popup(page)).toContainText("Teilabdeckung");
  expect(await linkReads(page)).toEqual(["DEMO-1", "DEMO-1", "DEMO-2", "DEMO-3", "DEMO-6"].map((key) => `/issue/${key}?fields=issuelinks`));
  const shots = process.env.DEPENDENCY_SHOTS;
  if (shots) await popup(page).screenshot({ path: `${shots}/${info.project.name}-outward.png` });
  await choose(page, "eingehend");
  await expect(row(page, "OPS-7")).toHaveCount(0);
  await load(page).press("Enter");
  await expect(row(page, "DEMO-4")).toContainText("DEMO-4 → DEMO-1");
  await expect(row(page, "DEMO-5")).toContainText("DEMO-5 → DEMO-4");
  await page.keyboard.press("Escape");
  await expect(popup(page)).toHaveCount(0);
  await expect(trigger(page)).toBeFocused();
  expect(await writes(page)).toEqual([]);
});

test("zeigt Abruf- und Knotengrenze und hält beim Ticketwechsel laufende Zweige an", async ({ page }) => {
  await fixture(page, {
    "DEMO-1": { links: [["DEMO-2"], ...Array.from({ length: 24 }, (_, i): FixtureRelation => [`OPS-${i + 1}`])] },
    "DEMO-2": { links: [["DEMO-3"], ["DEMO-4"]] },
    "DEMO-3": { delayMs: 850, links: [["OPS-40"]] },
  });
  await page.goto(ticket("DEMO-1"));
  await trigger(page).click();
  await choose(page, "ausgehend");
  await expect(load(page)).toBeInViewport({ ratio: 1 });
  await load(page).click();
  await expect(popup(page).getByRole("status")).toContainText("19 verbundene Tickets · 19 Beziehungen · 8 von 8 Abrufen");
  await expect(popup(page)).toContainText("Ticketlimit erreicht");
  await expect(popup(page)).toContainText("Abruflimit erreicht");
  await popup(page).getByRole("button", { name: "Alle Tickets anzeigen" }).press("Enter");
  await expect(popup(page).getByRole("listitem")).toHaveCount(19);
  await expect(popup(page).getByText("Nicht weiter gelesen", { exact: true })).toHaveCount(12);
  await page.keyboard.press("Escape");

  const links = page.locator("section").filter({ has: page.getByRole("heading", { name: /^Verknüpfungen/ }) });
  await links.getByRole("link", { name: /DEMO-2/ }).click();
  await expect(page).toHaveURL(/\/issue\/DEMO-2$/);
  await trigger(page).click();
  await choose(page, "ausgehend");
  await load(page).click();
  await expect.poll(() => linkReads(page)).toContain("/issue/DEMO-3?fields=issuelinks");
  await page.goBack();
  await expect(page).toHaveURL(/\/issue\/DEMO-1$/);
  await expect(popup(page)).toHaveCount(0);
  await page.waitForTimeout(900);
  expect(await linkReads(page)).not.toContain("/issue/DEMO-4?fields=issuelinks");
  await trigger(page).click();
  await expect(popup(page)).toContainText("Ausgangsticket DEMO-1");
  await expect(popup(page).getByRole("list", { name: "Tickets im Umfeld" })).toHaveCount(0);
  await expect(load(page)).toBeDisabled();
  expect(await writes(page)).toEqual([]);
});
