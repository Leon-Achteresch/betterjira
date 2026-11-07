import { expect, test, type Page } from "@playwright/test";

type SettingsProjectRule = {
  status?: number;
  delayMs?: number;
  values?: { id: string; key: string; name: string; projectTypeKey: string; avatarUrls: { "48x48": string } }[];
};

declare global {
  interface Window {
    __qa: { sessionFailure: boolean };
    __qaProjectRule?: () => SettingsProjectRule;
    __qaProjectRuleValue?: SettingsProjectRule;
    __qaReads?: string[];
    __qaPrefsWrites?: number;
  }
}

const shots = process.env.PROJECT_SETTINGS_SHOTS;

const open = (page: Page, route = "/settings/bereiche", scenario = "projects") =>
  page.goto(`/tests/browser/fixture.html?${new URLSearchParams({ route, scenario })}`);

const setRule = (page: Page, rule: SettingsProjectRule) =>
  page.evaluate((value) => {
    window.__qaProjectRuleValue = value;
  }, rule);

const main = (page: Page) => page.getByRole("main");
const list = (page: Page) => main(page).getByRole("list", { name: "Bereiche" });
const rows = (page: Page) => list(page).getByRole("listitem");
const search = (page: Page) => main(page).getByRole("searchbox", { name: "Bereiche durchsuchen" });
const prefs = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("betterjira-favorites") ?? "{}").state);
const projectReads = (page: Page) =>
  page.evaluate(() => (window.__qaReads ?? []).filter((path) => path.startsWith("/project/search")).length);
const prefsWrites = (page: Page) => page.evaluate(() => window.__qaPrefsWrites ?? 0);

const sidebar = async (page: Page) => {
  if ((page.viewportSize()?.width ?? 0) < 768) await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  const content = page.locator('[data-sidebar="content"]:visible');
  await expect(content).toBeVisible();
  return content;
};

const closeSidebar = async (page: Page) => {
  if ((page.viewportSize()?.width ?? 0) < 768) await page.keyboard.press("Escape");
};

const settle = async (page: Page) => {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every((animation) => animation.effect?.getTiming().iterations === Infinity || animation.playState !== "running"),
  );
  await page.waitForFunction(
    () =>
      new Promise<boolean>((resolve) => {
        const box = () => JSON.stringify(document.querySelector("main")?.getBoundingClientRect());
        const before = box();
        requestAnimationFrame(() => requestAnimationFrame(() => resolve(before === box())));
      }),
  );
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.addInitScript(() => {
    window.__qaReads = [];
    window.__qaPrefsWrites = 0;
    window.__qaProjectRule = () => window.__qaProjectRuleValue ?? {};
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === "betterjira-favorites") window.__qaPrefsWrites = (window.__qaPrefsWrites ?? 0) + 1;
      setItem.call(this, key, value);
    };
  });
});

test("Direktlink übernimmt gültige Suche, ungültige Werte zeigen alle Bereiche", async ({ page }) => {
  await open(page, "/settings/bereiche?q=ops");
  await expect(search(page)).toHaveValue("ops");
  await expect(rows(page)).toHaveCount(1);
  await expect(main(page).getByText("1 von 7 Bereichen")).toBeVisible();

  await open(page, "/settings/bereiche?q=2024");
  await expect(search(page)).toHaveValue("2024");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText("Archiv 2024");

  for (const value of ["false", '{"query":"ops"}', "   ", ""]) {
    await open(page, `/settings/bereiche?${new URLSearchParams({ q: value })}`);
    await expect(search(page)).toHaveValue("");
    await expect(rows(page)).toHaveCount(7);
    await expect(main(page).getByText("7 Bereiche", { exact: true })).toBeVisible();
  }
});

test("Suche filtert lokal, schreibt die URL und folgt Zurück und Vorwärts", async ({ page }) => {
  await open(page);
  await expect(rows(page)).toHaveCount(7);
  const reads = await projectReads(page);
  const writes = await prefsWrites(page);
  const before = await prefs(page);

  expect((await search(page).boundingBox())?.height).toBeGreaterThanOrEqual(32);
  await search(page).fill("MOB");
  await expect(page).toHaveURL(/\/settings\/bereiche\?q=MOB$/);
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText("Mobile App");
  await expect(main(page).getByText("1 von 7 Bereichen")).toBeVisible();

  await search(page).fill("ops");
  await expect(page).toHaveURL(/\/settings\/bereiche\?q=ops$/);
  await expect(rows(page)).toHaveCount(1);

  await page.getByRole("link", { name: "Darstellung" }).click();
  await expect(page).toHaveURL(/\/settings\/darstellung$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/settings\/bereiche\?q=ops$/);
  await expect(search(page)).toHaveValue("ops");
  await expect(rows(page)).toHaveCount(1);
  await page.goForward();
  await expect(page).toHaveURL(/\/settings\/darstellung$/);
  await page.goBack();
  await expect(search(page)).toHaveValue("ops");

  await search(page).fill("zzz");
  await expect(main(page).getByText("Keine Treffer", { exact: true })).toBeVisible();
  await expect(main(page).getByText("0 von 7 Bereichen")).toBeVisible();
  const reset = main(page).getByRole("button", { name: "Suche zurücksetzen" });
  expect((await reset.boundingBox())?.height).toBeGreaterThanOrEqual(32);
  await reset.click();
  await expect(search(page)).toHaveValue("");
  await expect(rows(page)).toHaveCount(7);
  await expect(page).toHaveURL(/\/settings\/bereiche$/);

  expect(await projectReads(page)).toBe(reads);
  expect(await prefsWrites(page)).toBe(writes);
  expect(await prefs(page)).toEqual(before);
});

test("Stern und Sichtbarkeit wirken im Filter sofort in der Seitenleiste", async ({ page }) => {
  await open(page);
  expect(await prefs(page)).toEqual({ projectIds: ["2"], hiddenProjectIds: ["3"] });

  await search(page).fill("mob");
  const mobile = rows(page).filter({ hasText: "Mobile App" });
  await mobile.getByRole("button", { name: "Mobile App favorisieren" }).click();
  await expect(mobile.getByRole("button", { name: "Mobile App aus Favoriten entfernen" })).toHaveAttribute("aria-pressed", "true");

  await search(page).fill("arch");
  const archive = rows(page).filter({ hasText: "Archiv 2024" });
  const visibility = archive.getByRole("switch", { name: "Archiv 2024 in Sidebar anzeigen" });
  await expect(visibility).toHaveAttribute("aria-checked", "false");
  await visibility.click();
  await expect(visibility).toHaveAttribute("aria-checked", "true");
  await expect(rows(page)).toHaveCount(1);

  const bar = await sidebar(page);
  const favorites = bar.locator('[data-sidebar="group"]').filter({ hasText: "Favoriten" });
  await expect(favorites.getByRole("link", { name: /Mobile App/ })).toBeVisible();
  await expect(bar.getByRole("link", { name: /Archiv 2024/ })).toBeVisible();
  await favorites.getByRole("link", { name: /Betrieb/ }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Aus Favoriten entfernen" }).click();
  await closeSidebar(page);

  await search(page).fill("ops");
  await expect(rows(page).getByRole("button", { name: "Betrieb favorisieren" })).toHaveAttribute("aria-pressed", "false");
  expect(await prefs(page)).toEqual({ projectIds: ["4"], hiddenProjectIds: [] });
});

test("Tastatur: Suche, Stern, Sichtbarkeit und Escape", async ({ page }) => {
  await open(page);
  await expect(rows(page)).toHaveCount(7);
  await search(page).focus();
  await page.keyboard.type("betr");
  await expect(rows(page)).toHaveCount(1);

  await page.keyboard.press("Tab");
  await expect(main(page).getByRole("button", { name: "Suche leeren" })).toBeFocused();
  await page.keyboard.press("Tab");
  const star = rows(page).getByRole("button", { name: "Betrieb aus Favoriten entfernen" });
  await expect(star).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(rows(page).getByRole("button", { name: "Betrieb favorisieren" })).toHaveAttribute("aria-pressed", "false");

  await page.keyboard.press("Tab");
  const visibility = rows(page).getByRole("switch", { name: "Betrieb in Sidebar anzeigen" });
  await expect(visibility).toBeFocused();
  await page.keyboard.press("Space");
  await expect(visibility).toHaveAttribute("aria-checked", "false");
  expect(await prefs(page)).toEqual({ projectIds: [], hiddenProjectIds: ["3", "2"] });

  await search(page).focus();
  await expect(search(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(search(page)).toHaveValue("");
  await expect(rows(page)).toHaveCount(7);
  await expect(page).toHaveURL(/\/settings\/bereiche$/);
});

test("Leere Bereichsliste ist kein Suchergebnis, Laden zeigt Platzhalter", async ({ page }) => {
  await page.addInitScript(() => {
    window.__qaProjectRuleValue = { delayMs: 1200, values: [] };
  });
  await open(page, "/settings/bereiche?q=ops");
  await expect(main(page).getByRole("status", { name: "Bereiche werden geladen" })).toBeVisible();
  await expect(main(page).getByText("Keine Bereiche", { exact: true })).toBeVisible();
  await expect(main(page).getByText("Keine Treffer", { exact: true })).toHaveCount(0);
  await expect(main(page).getByRole("button", { name: "Suche zurücksetzen" })).toHaveCount(0);
  await expect(main(page).getByText(/von \d+ Bereichen/)).toHaveCount(0);
  await expect(search(page)).toHaveValue("ops");
});

test("Ladefehler bietet Retry, eine fehlgeschlagene Aktualisierung behält gefilterte Liste", async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => {
    window.__qaProjectRuleValue = { status: 403 };
  });
  await open(page, "/settings/bereiche?q=o");
  const failed = main(page).getByRole("alert").filter({ hasText: "Bereiche konnten nicht geladen werden" });
  await expect(failed).toContainText("Test: Jira antwortet mit 403");
  await expect(main(page).getByText("Nicht angemeldet")).toHaveCount(0);
  await setRule(page, {});
  await failed.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(rows(page)).toHaveCount(5);
  await expect(main(page).getByText("5 von 7 Bereichen")).toBeVisible();

  await setRule(page, { status: 400 });
  await page.clock.setSystemTime(Date.now() + 31_000);
  await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
  const refresh = main(page).getByRole("alert").filter({ hasText: "Aktualisierung fehlgeschlagen" });
  await expect(refresh).toBeVisible();
  await expect(rows(page)).toHaveCount(5);
  await expect(search(page)).toHaveValue("o");
  if (shots) {
    await page.mouse.move(0, 0);
    await settle(page);
    await page.screenshot({ path: `${shots}/aktualisierung-${test.info().project.name}.png` });
  }

  await setRule(page, {});
  await refresh.getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(refresh).toHaveCount(0);
  await expect(rows(page)).toHaveCount(5);
});

test("Sitzungs-Lesefehler ist keine Abmeldung und lädt nach Retry die Suche", async ({ page }) => {
  await open(page, "/settings/bereiche?q=demo", "session-error");
  await expect(main(page).getByText("Anmeldung konnte nicht geprüft werden", { exact: true })).toBeVisible();
  await expect(main(page).getByRole("button", { name: "Mit Atlassian verbinden" })).toHaveCount(0);
  await expect(search(page)).toHaveCount(0);

  await page.evaluate(() => {
    window.__qa.sessionFailure = false;
  });
  await main(page).getByRole("button", { name: "Erneut versuchen" }).click();
  await expect(search(page)).toHaveValue("demo");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page)).toContainText("Produktentwicklung");
});

test("Abgemeldet zeigt die Anmeldung statt Suche und Bereichen", async ({ page }) => {
  await open(page, "/settings/bereiche?q=ops", "calendar-offline");
  await expect(main(page).getByText("Melde dich an, um Bereiche zu verwalten.")).toBeVisible();
  await expect(main(page).getByRole("button", { name: "Mit Atlassian verbinden" })).toBeVisible();
  await expect(search(page)).toHaveCount(0);
  await expect(main(page).getByText("Anmeldung konnte nicht geprüft werden")).toHaveCount(0);
});

test("Darstellung: Desktop hell und 390 px dunkel ohne Seitenüberlauf", async ({ page }, info) => {
  const narrow = info.project.name !== "desktop";
  await page.emulateMedia({ colorScheme: narrow ? "dark" : "light" });
  if (narrow) await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "/settings/bereiche?q=o");
  await expect(rows(page)).toHaveCount(5);
  const state = await page.evaluate(async () => {
    await document.fonts.load('500 1em "Geist Variable"');
    await document.fonts.ready;
    const firstRow = document.querySelector('[role="listitem"]');
    return {
      loaded: [...document.fonts].some((face) => face.family.includes("Geist") && face.status === "loaded"),
      family: getComputedStyle(document.querySelector("main h2")!).fontFamily,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      dark: document.documentElement.classList.contains("dark"),
      reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
      rowTransform: firstRow ? getComputedStyle(firstRow).transform : "missing",
    };
  });
  expect(state.loaded).toBe(true);
  expect(state.family).toContain("Geist");
  expect(state.overflow).toBeLessThanOrEqual(0);
  expect(state.dark).toBe(narrow);
  if (state.reduced) expect(state.rowTransform).toBe("none");
  for (const control of [search(page), rows(page).first().getByRole("button")]) expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(32);
  await page.mouse.move(0, 0);
  await settle(page);
  if (shots) await page.screenshot({ path: `${shots}/${narrow ? "390-dunkel" : "desktop-hell"}.png` });
});
