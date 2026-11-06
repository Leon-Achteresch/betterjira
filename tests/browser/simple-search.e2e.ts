import { expect, test, type Page, type TestInfo } from "@playwright/test";

declare global {
  interface Window {
    __qaProjects?: { id: string; key: string; name: string; projectTypeKey: string; avatarUrls: { "48x48": string } }[];
    __qa: { searches: string[]; sessionFailure: boolean };
  }
}

const open = (page: Page, route: string, scenario?: string) =>
  page.goto(`/tests/browser/fixture.html?${new URLSearchParams({ route, ...(scenario && { scenario }) })}`);

const modes = (page: Page) => page.getByRole("navigation", { name: "Suchmodus" });
const mode = (page: Page, name: "Einfach" | "JQL") => modes(page).getByRole("link", { name, exact: true });
const textField = (page: Page) => page.getByRole("searchbox", { name: "Volltextsuche" });
const projectField = (page: Page) => page.getByRole("combobox", { name: "Projekt" });
const jqlField = (page: Page) => page.getByRole("textbox", { name: "JQL", exact: true });
const row = (page: Page, key: string) => page.getByRole("cell", { name: key, exact: true });
const searches = (page: Page) => page.evaluate(() => window.__qa.searches);
const sent = (page: Page, jql: string) =>
  expect.poll(async () => (await searches(page)).some((entry) => entry.includes(jql))).toBe(true);
const searchParam = (page: Page, name: string) => new URL(page.url()).searchParams.get(name);

const ALL = 'project in projectsWhereUserHasPermission("Browse Projects")';

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  const dir = process.env.SIMPLE_SEARCH_SHOTS;
  if (dir) await page.screenshot({ path: `${dir}/${testInfo.project.name}-${name}.png` });
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.addInitScript(() => {
    const avatarUrls = { "48x48": "/logo.svg" };
    window.__qaProjects = [
      { id: "1", key: "DEMO", name: "Produktentwicklung", projectTypeKey: "software", avatarUrls },
      { id: "2", key: "OPS", name: "Betrieb", projectTypeKey: "software", avatarUrls },
    ];
  });
});

test("Ohne JQL startet die einfache Suche über alle Projekte, Text landet in der URL", async ({ page }, testInfo) => {
  await open(page, "/suche");
  await expect(mode(page, "Einfach")).toHaveAttribute("aria-current", "page");
  await expect(row(page, "DEMO-1")).toBeVisible();
  await sent(page, `${ALL} ORDER BY updated DESC`);
  await expect(projectField(page)).toHaveValue("Alle Projekte");
  await expect(textField(page)).toHaveAttribute("placeholder", "Alle Vorgänge durchsuchen");
  await shot(page, testInfo, "start");

  await textField(page).fill('Login "Fehler" *');
  await sent(page, `${ALL} AND text ~ "Login Fehler*" ORDER BY updated DESC`);
  await expect.poll(() => searchParam(page, "q")).toContain("Login");
  await expect(textField(page)).toHaveValue('Login "Fehler" *');
  expect(new Set((await searches(page)).filter((jql) => jql.includes("text ~"))).size).toBe(1);

  await textField(page).fill("***");
  await expect.poll(() => searchParam(page, "q")).toBe("***");
  await expect(row(page, "DEMO-1")).toBeVisible();
  expect((await searches(page)).some((jql) => jql.includes('"***'))).toBe(false);

  await open(page, "/suche?q=Übergabe");
  await expect(textField(page)).toHaveValue("Übergabe");
  await sent(page, 'text ~ "Übergabe*"');
});

test("Projektwahl grenzt ein und folgt Zurück und Vor", async ({ page }) => {
  await open(page, "/suche");
  await expect(row(page, "DEMO-1")).toBeVisible();
  await projectField(page).click();
  await page.getByRole("option", { name: /Betrieb/ }).click();
  await expect.poll(() => searchParam(page, "projekt")).toBe("OPS");
  await sent(page, 'project = "OPS" ORDER BY updated DESC');
  await expect(projectField(page)).toHaveValue("Betrieb");

  await page.goBack();
  await expect.poll(() => searchParam(page, "projekt")).toBeNull();
  await expect(projectField(page)).toHaveValue("Alle Projekte");
  await page.goForward();
  await expect(projectField(page)).toHaveValue("Betrieb");
});

test("Unbekannte oder manipulierte Projekte starten keine Suche", async ({ page }) => {
  await open(page, "/suche?projekt=NOPE");
  await expect(page.getByText("Projekt „NOPE“ ist nicht verfügbar")).toBeVisible();
  expect((await searches(page)).some((jql) => jql.includes("NOPE") || jql.includes(ALL))).toBe(false);
  await page.getByRole("button", { name: "Alle Projekte durchsuchen" }).click();
  await expect(row(page, "DEMO-1")).toBeVisible();
  await expect.poll(() => searchParam(page, "projekt")).toBeNull();

  await open(page, `/suche?${new URLSearchParams({ projekt: 'DEMO" OR project = "OPS', foo: "bar" })}`);
  await expect(row(page, "DEMO-1")).toBeVisible();
  await sent(page, `${ALL} ORDER BY updated DESC`);
});

test("Wechsel zu JQL übernimmt die erzeugte Abfrage, Expertentext geht nicht verloren", async ({ page }, testInfo) => {
  await open(page, "/suche?projekt=DEMO");
  await expect(row(page, "DEMO-1")).toBeVisible();
  await textField(page).fill("alpha");
  await expect.poll(() => searchParam(page, "q")).toBe("alpha");

  await mode(page, "JQL").click();
  const generated = 'project = "DEMO" AND text ~ "alpha*" ORDER BY updated DESC';
  await expect(jqlField(page)).toHaveValue(generated);
  await expect(mode(page, "JQL")).toHaveAttribute("aria-current", "page");
  await sent(page, generated);
  await expect(page.getByRole("button", { name: "Als Filter speichern…" })).toBeEnabled();
  await shot(page, testInfo, "jql");

  const expert = "assignee = currentUser() ORDER BY created DESC";
  await jqlField(page).fill(expert);
  await mode(page, "Einfach").click();
  await expect(mode(page, "Einfach")).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("JQL gemerkt:")).toBeVisible();
  await expect(textField(page)).toHaveValue("alpha");
  await expect(projectField(page)).toHaveValue("Produktentwicklung");
  expect(searchParam(page, "jql")).toBe(expert);

  await mode(page, "JQL").click();
  await expect(jqlField(page)).toHaveValue(expert);
  await page.goBack();
  await expect(mode(page, "Einfach")).toHaveAttribute("aria-current", "page");
  await page.goBack();
  await expect(jqlField(page)).toHaveValue(generated);

  await page.goForward();
  await page.getByRole("button", { name: "Gemerkte JQL verwerfen" }).click();
  await expect(page.getByText("JQL gemerkt:")).toHaveCount(0);
  await mode(page, "JQL").click();
  await expect(jqlField(page)).toHaveValue(generated);
});

test("Gespeicherte JQL-Direktlinks zeigen weiter ihre Abfrage", async ({ page }) => {
  const jql = 'status = "In Arbeit" ORDER BY updated DESC';
  await open(page, `/suche?${new URLSearchParams({ jql })}`);
  await expect(mode(page, "JQL")).toHaveAttribute("aria-current", "page");
  await expect(jqlField(page)).toHaveValue(jql);
  await expect(row(page, "DEMO-1")).toBeVisible();
  await sent(page, jql);
  expect((await searches(page)).some((entry) => entry.includes(ALL))).toBe(false);

  await open(page, "/suche?modus=jql");
  await expect(jqlField(page)).toHaveValue("");
  await expect(page.getByText("Frei mit JQL suchen")).toBeVisible();
});

test("Ohne Anmeldung oder bei Sitzungsfehler keine Suche", async ({ page }) => {
  await open(page, "/suche", "calendar-offline");
  await expect(page.getByText("Nicht angemeldet", { exact: true })).toBeVisible();
  await expect(modes(page)).toHaveCount(0);

  await open(page, "/suche?q=alpha", "session-error");
  await expect(page.getByText("Anmeldung konnte nicht geprüft werden", { exact: true })).toBeVisible();
  await expect(modes(page)).toHaveCount(0);
  expect(await searches(page)).toEqual([]);
  await page.evaluate(() => {
    window.__qa.sessionFailure = false;
  });
  await page.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(textField(page)).toHaveValue("alpha");
  await sent(page, 'text ~ "alpha*"');
});

test.describe("schmal, dunkel, reduzierte Bewegung", () => {
  test.use({ viewport: { width: 390, height: 844 }, colorScheme: "dark", reducedMotion: "reduce" });

  test("Einfachsuche bleibt ohne Seitenüberlauf bedienbar", async ({ page }, testInfo) => {
    await open(page, "/suche");
    await expect(row(page, "DEMO-1")).toBeVisible();
    await textField(page).fill("Übergabe");
    await sent(page, 'text ~ "Übergabe*"');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    for (const target of [mode(page, "JQL"), projectField(page), textField(page)]) {
      const box = await target.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(32);
    }
    await shot(page, testInfo, "schmal-dunkel");
  });
});
