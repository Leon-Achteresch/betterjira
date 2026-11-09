import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

const fixture = (route: string, scenario?: string) =>
  `/tests/browser/fixture.html?${new URLSearchParams({ route, ...(scenario && { scenario }) })}`;

const TABLE = fixture("/bereiche/DEMO");
const REFRESH_TITLE = "Aktualisierung fehlgeschlagen. Angezeigt wird der zuletzt geladene Stand.";

const row = (page: Page, key: string) => page.getByRole("cell", { name: key, exact: true });
const notice = (page: Page, text: string) => page.getByRole("alert").filter({ hasText: text });

const setSearchRule = (page: Page, body: string | null) =>
  page.evaluate((source) => {
    Object.assign(window, { __qaSearchRule: source === null ? undefined : new Function("jql", "token", source) });
  }, body);

const useLargestText = (page: Page) =>
  page.addInitScript(() => {
    localStorage.setItem("betterjira-readability", JSON.stringify({ state: { textSize: "x-large" }, version: 1 }));
  });

const failRefresh = async (page: Page) => {
  await setSearchRule(page, "return { status: 503 };");
  await page.getByRole("button", { name: "Aktualisieren" }).click();
  const alert = notice(page, "zuletzt geladene Stand");
  await expect(alert).toContainText("Test: Jira antwortet mit 503");
  return alert;
};

const geometry = (alert: Locator) =>
  alert.evaluate((root) => {
    type Box = { left: number; right: number; top: number; bottom: number };
    const textLines = (element: Element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return [...range.getClientRects()].filter((rect) => rect.width > 1 && rect.height > 1);
    };
    const parts: { name: string; boxes: Box[] }[] = [];
    for (const icon of root.querySelectorAll(":scope > svg")) parts.push({ name: "Icon", boxes: [icon.getBoundingClientRect()] });
    for (const [name, slot] of [["Titel", "alert-title"], ["Beschreibung", "alert-description"]] as const) {
      const element = root.querySelector(`[data-slot=${slot}]`);
      if (element) parts.push({ name, boxes: textLines(element) });
    }
    const buttons = [...root.querySelectorAll("button")];
    for (const button of buttons) parts.push({ name: `Aktion „${button.textContent?.trim()}“`, boxes: [button.getBoundingClientRect()] });

    const bounds = root.getBoundingClientRect();
    const problems: string[] = [];
    for (const [index, part] of parts.entries()) {
      for (const box of part.boxes) {
        if (box.left < bounds.left - 1 || box.right > bounds.right + 1 || box.top < bounds.top - 1 || box.bottom > bounds.bottom + 1)
          problems.push(`${part.name} ragt aus dem Hinweis`);
        for (const other of parts.slice(index + 1)) {
          for (const rect of other.boxes) {
            const x = Math.min(box.right, rect.right) - Math.max(box.left, rect.left);
            const y = Math.min(box.bottom, rect.bottom) - Math.max(box.top, rect.top);
            if (x > 1 && y > 1) problems.push(`${part.name} überdeckt ${other.name}`);
          }
        }
      }
    }
    for (const button of buttons) {
      const rect = button.getBoundingClientRect();
      if (rect.height < 32) problems.push("Aktionsziel ist niedriger als 32 px");
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      if (!hit || !button.contains(hit)) problems.push(`Aktion „${button.textContent?.trim()}“ nicht anklickbar`);
    }
    const text = parts.filter((part) => !part.name.startsWith("Aktion")).flatMap((part) => part.boxes);
    const action = buttons[0]?.getBoundingClientRect();
    return {
      problems,
      textRight: Math.max(...text.map((box) => box.right)),
      textBottom: Math.max(...text.map((box) => box.bottom)),
      firstLineBottom: Math.min(...text.map((box) => box.bottom)),
      action: action && { left: action.left, top: action.top, bottom: action.bottom },
      bottom: bounds.bottom,
      paddingBottom: Number.parseFloat(getComputedStyle(root).paddingBottom),
    };
  });

const pageOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const expectReadable = async (alert: Locator) => {
  await alert.scrollIntoViewIfNeeded();
  const layout = await geometry(alert);
  expect(layout.problems).toEqual([]);
  return layout;
};

const expectStacked = async (alert: Locator) => {
  const layout = await expectReadable(alert);
  expect(layout.action!.top).toBeGreaterThanOrEqual(layout.textBottom);
};

const expectCompact = async (alert: Locator) => {
  const layout = await expectReadable(alert);
  expect(layout.action!.left).toBeGreaterThanOrEqual(layout.textRight);
  expect(layout.action!.top).toBeLessThan(layout.firstLineBottom);
  expect(layout.bottom - Math.max(layout.textBottom, layout.action!.bottom)).toBeLessThanOrEqual(layout.paddingBottom + 2);
};

const tabFromText = async (page: Page, alert: Locator, text: string, button: string) => {
  await alert.getByText(text, { exact: true }).click();
  await page.keyboard.press("Tab");
  const action = alert.getByRole("button", { name: button });
  await expect(action).toBeFocused();
  await expect(action).toBeInViewport({ ratio: 1 });
  return action;
};

const shot = async (page: Page, testInfo: TestInfo, name: string) => {
  const dir = process.env.ALERT_ACTIONS_SHOTS;
  if (!dir) return;
  await page.evaluate(() => document.fonts.ready);
  const geist = await page.evaluate(() =>
    [...document.fonts].some((font) => font.family.replaceAll('"', "") === "Geist Variable" && font.status === "loaded"),
  );
  expect(geist, "Geist geladen").toBe(true);
  await page.screenshot({ path: `${dir}/${name}.png` });
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test.describe("Desktop hell", () => {
  test.use({ viewport: { width: 1440, height: 1000 }, colorScheme: "light", reducedMotion: "no-preference" });

  test("Aktion bleibt kompakt neben dem Text und lädt per Maus neu", async ({ page }, testInfo) => {
    await page.goto(TABLE);
    await expect(row(page, "DEMO-3")).toBeVisible();
    const alert = await failRefresh(page);
    await expect(alert).toContainText(REFRESH_TITLE);
    await expectCompact(alert);
    await shot(page, testInfo, "desktop-hell-aktualisierung");

    await setSearchRule(page, `return { keys: ["DEMO-1", "DEMO-2"] };`);
    await alert.getByRole("button", { name: "Erneut versuchen" }).click();
    await expect(alert).toHaveCount(0);
    await expect(row(page, "DEMO-2")).toBeVisible();
    await expect(row(page, "DEMO-3")).toHaveCount(0);
  });
});

test.describe("390 px dunkel, reduzierte Bewegung", () => {
  test.use({ viewport: { width: 390, height: 844 }, colorScheme: "dark", reducedMotion: "reduce" });

  test("Refreshfehler ist vollständig lesbar und Retry per Tastatur stellt die Zeilen her", async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      Object.assign(window, { __qaSearchRule: () => ({ keys: [] }) });
    });
    await page.goto(TABLE);
    await expect(page.getByText("Keine Vorgänge", { exact: true })).toBeVisible();
    const alert = await failRefresh(page);
    await expectStacked(alert);
    expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    await shot(page, testInfo, "390-dunkel-aktualisierung");

    await setSearchRule(page, null);
    const retry = await tabFromText(page, alert, REFRESH_TITLE, "Erneut versuchen");
    await retry.press("Enter");
    await expect(alert).toHaveCount(0);
    for (const key of ["DEMO-1", "DEMO-2", "DEMO-3"]) await expect(row(page, key)).toBeVisible();
  });

  test("Sehr große Schrift: Hinweis ohne Icon bleibt lesbar und prüft erneut", async ({ page }, testInfo) => {
    await useLargestText(page);
    await page.addInitScript(() => {
      Object.assign(window, { __qaSearchRule: (jql: string) => (jql.includes("updated >=") ? { status: 503 } : {}) });
    });
    await page.goto(fixture("/benachrichtigungen", "notifications"));
    const alert = notice(page, "Jira konnte zuletzt nicht geprüft werden");
    await expect(alert).toBeVisible();
    await expectStacked(alert);
    expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    await shot(page, testInfo, "390-dunkel-gross-ohne-icon");

    await setSearchRule(page, null);
    const retry = await tabFromText(page, alert, "Jira konnte zuletzt nicht geprüft werden", "Erneut prüfen");
    await retry.press("Enter");
    await expect(alert).toHaveCount(0);
  });

  test("Sehr große Schrift: lange Aktionsbeschriftung bleibt erreichbar", async ({ page }, testInfo) => {
    await useLargestText(page);
    await page.goto(fixture("/suche?projekt=NOPE"));
    const alert = notice(page, "Projekt „NOPE“ ist nicht verfügbar");
    await expect(alert).toBeVisible();
    await expectStacked(alert);
    expect(await pageOverflow(page)).toBeLessThanOrEqual(0);
    await shot(page, testInfo, "390-dunkel-gross-lange-aktion");

    const action = await tabFromText(page, alert, "Projekt „NOPE“ ist nicht verfügbar", "Alle Projekte durchsuchen");
    await action.press("Enter");
    await expect(row(page, "DEMO-1")).toBeVisible();
    await expect(alert).toHaveCount(0);
  });
});
