import { expect, test, type Page } from "@playwright/test";

type Fixture = {
  __qa: {
    accountId?: string;
    reads: string[];
    writes: unknown[];
    issues: { key: string; fields: { worklog: { total: number; worklogs: unknown[] } } }[];
  };
  __qaReadRule: (path: string, params: URLSearchParams) => void;
  n08Accounts: string[];
};
const date = new Date("2026-11-18T12:00:00+01:00");
const issue = (key: string) => `/issue/${key}?bereich=zeit`;
const fixture = (key: string) => `/tests/browser/fixture.html?${new URLSearchParams({ route: issue(key) })}`;
const trigger = (page: Page) => page.getByRole("button", { name: "Einzelne Tage planen", exact: true });
const popup = (page: Page) => page.getByRole("dialog", { name: "Zeitbuchungen vorbereiten", exact: true });
const inputDay = (page: Page) => popup(page).getByLabel("Einzelnen Tag wählen", { exact: true });
const localTime = (page: Page) => popup(page).getByLabel("Lokale Startzeit", { exact: true });
const duration = (page: Page) => popup(page).getByLabel("Dauer je Tag", { exact: true });
const chosen = (page: Page) => popup(page).getByRole("list", { name: "Gewählte Tage", exact: true });
const preview = (page: Page) => popup(page).getByRole("region", { name: "Geplante Zeitbuchungen", exact: true });
const rows = (page: Page) => preview(page).getByRole("listitem");
const check = (page: Page) => popup(page).getByRole("button", { name: "Vorschau prüfen", exact: true });
const writes = (page: Page) => page.evaluate(() => (window as unknown as Fixture).__qa.writes);

const open = async (page: Page) => {
  await expect(trigger(page)).toBeEnabled();
  await trigger(page).press("Enter");
  await expect(inputDay(page)).toBeFocused();
};
const add = async (page: Page, day: string) => {
  await inputDay(page).fill(day);
  await popup(page).getByRole("button", { name: "Tag hinzufügen", exact: true }).press("Enter");
};
const seed = async (page: Page, time = "09:15") => {
  await duration(page).fill("1h 30m");
  await localTime(page).fill(time);
};
const navigate = (page: Page, key: string) => page.evaluate((target) => {
  const state = history.state as { __TSR_index: number };
  const key = `qa-n08-${state.__TSR_index + 1}`;
  history.pushState({ __TSR_index: state.__TSR_index + 1, key, __TSR_key: key }, "", target);
  dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
}, issue(key));

test.beforeEach(async ({ page }, info) => {
  await page.clock.setFixedTime(date);
  if (info.project.name === "narrow-dark-reduced") await page.setViewportSize({ width: 390, height: 720 });
  page.on("pageerror", (error) => { throw error; });
  await page.route("**/*", (request) => new URL(request.request().url()).hostname === "127.0.0.1" ? request.continue() : request.abort());
  await page.addInitScript(() => {
    const qa = window as unknown as Fixture;
    qa.n08Accounts = [];
    qa.__qaReadRule = (path, params) => {
      if (path === "/myself") qa.n08Accounts.push(qa.__qa.accountId ?? "qa-user");
      if (path !== "/issue/DEMO-1" || params.get("fields") !== "*all") return;
      const target = qa.__qa.issues.find((entry) => entry.key === "DEMO-1");
      if (!target) return;
      const worklog = (id: string, accountId: string, started: string) => ({
        id, started, timeSpent: "30m", author: { accountId, displayName: accountId, avatarUrls: { "48x48": "" } },
      });
      target.fields.worklog = {
        total: 4,
        worklogs: [
          worklog("n08-mine", "qa-user", "2026-11-10T08:15:30.000+0000"),
          worklog("n08-foreign", "qa-other", "2026-11-11T09:15:00.000+0100"),
        ],
      };
    };
  });
});

test.afterEach(async ({ page }, info) => {
  if (!page.isClosed() && await page.evaluate(() => Reflect.has(window, "__qa"))) {
    const data = await page.evaluate(() => {
      const { __qa, n08Accounts } = window as unknown as Fixture;
      return { writes: __qa.writes, reads: __qa.reads, accounts: n08Accounts };
    });
    await info.attach("n08-ledger", { body: JSON.stringify(data), contentType: "application/json" });
  }
});

test("Nur einzeln hinzugefügte Tage erscheinen mit Ziel, Dauer und lokaler Zeit", async ({ page }, info) => {
  await page.goto(fixture("DEMO-1"));
  const normalDuration = page.getByLabel("Dauer", { exact: true });
  const normalStart = page.getByLabel("Beginn", { exact: true });
  await normalDuration.fill("1h 30m");
  await normalStart.fill("2026-11-17T09:15");
  await open(page);
  await expect(duration(page)).toHaveValue("1h 30m");
  await expect(localTime(page)).toHaveValue("09:15");
  await expect(chosen(page)).toHaveCount(0);
  await expect(check(page)).toBeDisabled();
  await inputDay(page).fill("2026-10-27");
  await expect(check(page)).toBeDisabled();
  await popup(page).getByRole("button", { name: "Tag hinzufügen", exact: true }).press("Enter");
  await add(page, "2026-10-22");
  await inputDay(page).fill("2026-10-25");
  await check(page).press("Enter");
  await expect(rows(page)).toHaveCount(2);
  await expect(rows(page)).toHaveText([
    /2026-10-22 · 09:15 \(UTC\+02:00\).*DEMO-1 · 1h 30m/,
    /2026-10-27 · 09:15 \(UTC\+01:00\).*DEMO-1 · 1h 30m/,
  ]);
  await expect(rows(page).first().locator("time")).toHaveAttribute("datetime", "2026-10-22T09:15+02:00");
  await expect(popup(page).getByRole("button", { name: "Zeit erfassen", exact: true })).toHaveCount(0);
  await expect(popup(page)).toContainText("Suche für den Arbeitsalltag vereinfachen");
  expect(await popup(page).evaluate((panel) => panel.scrollWidth <= panel.clientWidth && panel.getBoundingClientRect().right <= innerWidth)).toBe(true);
  await rows(page).last().scrollIntoViewIfNeeded();
  await expect(rows(page).last()).toBeInViewport({ ratio: 0.97 });
  await expect(popup(page).getByText("Abgleich nur mit geladenen eigenen Buchungen.")).toBeInViewport({ ratio: 0.97 });
  await popup(page).screenshot({ path: info.outputPath("tagesvorschau.png"), animations: "disabled" });

  await localTime(page).fill("08:45");
  await expect(preview(page)).toHaveCount(0);
  await popup(page).getByRole("button", { name: "2026-10-22 entfernen", exact: true }).press("Enter");
  await expect(inputDay(page)).toBeFocused();
  await check(page).press("Enter");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("2026-10-27 · 08:45");
  await page.keyboard.press("Escape");
  await expect(trigger(page)).toBeFocused();
  await expect(popup(page)).toHaveCount(0);
  await expect(normalDuration).toHaveValue("1h 30m");
  await expect(normalStart).toHaveValue("2026-11-17T09:15");
  expect(await writes(page)).toEqual([]);
});

test("Doppelte Tage und bekannte eigene Startzeiten werden markiert", async ({ page }) => {
  await page.goto(fixture("DEMO-1"));
  await open(page);
  await seed(page);
  await add(page, "2026-11-10");
  await add(page, "2026-11-10");
  await expect(popup(page).getByRole("alert")).toContainText("bereits ausgewählt");
  await expect(chosen(page).getByRole("listitem")).toHaveCount(1);
  await add(page, "2026-11-11");
  await check(page).press("Enter");
  await expect(rows(page).first()).toContainText("Eigene Buchung mit diesem Beginn vorhanden.");
  await expect(rows(page).last()).not.toContainText("Eigene Buchung");
  await expect(preview(page)).toHaveAccessibleDescription("Abgleich nur mit geladenen eigenen Buchungen.");
  expect(await writes(page)).toEqual([]);
});

test("Ungültige Dauer, leere Uhrzeit, Sommerzeitlücke, doppelte Uhrzeit und Zukunft werden abgewiesen", async ({ page }) => {
  await page.goto(fixture("DEMO-1"));
  await open(page);
  await add(page, "2026-03-29");
  await add(page, "2026-10-25");
  await add(page, "2026-11-19");
  await duration(page).fill("0m");
  await check(page).press("Enter");
  await expect(popup(page).getByRole("alert")).toContainText("Gib eine Dauer");
  await expect(preview(page)).toHaveCount(0);
  await duration(page).fill("30m");
  await localTime(page).fill("");
  await check(page).press("Enter");
  await expect(popup(page).getByRole("alert")).toContainText("gültige lokale Startzeit");
  await expect(preview(page)).toHaveCount(0);
  await localTime(page).fill("02:30");
  await check(page).press("Enter");
  await expect(rows(page)).toHaveCount(3);
  await expect(rows(page).nth(0)).toContainText("an diesem Tag ungültig");
  await expect(rows(page).nth(1)).toContainText("an diesem Tag zweimal");
  await expect(rows(page).nth(2)).toContainText("nicht in der Zukunft");
  expect(await writes(page)).toEqual([]);
});

test("Ticketwechsel und Rückkehr verwerfen den Entwurf", async ({ page }) => {
  await page.goto(fixture("DEMO-1"));
  await open(page);
  await seed(page);
  await add(page, "2026-11-12");
  await check(page).press("Enter");
  await expect(rows(page)).toHaveCount(1);
  await navigate(page, "DEMO-2");
  await expect(page).toHaveURL(/\/issue\/DEMO-2\?bereich=zeit$/);
  await expect(popup(page)).toHaveCount(0);
  await open(page);
  await expect(popup(page)).toContainText("DEMO-2");
  await expect(chosen(page)).toHaveCount(0);
  await expect(preview(page)).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/\/issue\/DEMO-1\?bereich=zeit$/);
  await expect(popup(page)).toHaveCount(0);
  await open(page);
  await expect(chosen(page)).toHaveCount(0);
  expect(await writes(page)).toEqual([]);
});

test("Kontowechsel und Rückkehr verwerfen den Entwurf im selben Ticket", async ({ page }) => {
  await page.goto(fixture("DEMO-1"));
  await open(page);
  await seed(page);
  await add(page, "2026-11-12");
  await check(page).press("Enter");
  await expect(rows(page)).toHaveCount(1);
  const switchAccount = async (id: string, minutes: number) => {
    await page.evaluate((accountId) => { (window as unknown as Fixture).__qa.accountId = accountId; }, id);
    await page.clock.setFixedTime(new Date(date.getTime() + minutes * 60_000));
    await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
    await expect.poll(() => page.evaluate(() => (window as unknown as Fixture).n08Accounts.at(-1))).toBe(id);
    await expect(popup(page)).toHaveCount(0);
  };
  await switchAccount("qa-n08-other", 5);
  await open(page);
  await expect(chosen(page)).toHaveCount(0);
  await expect(preview(page)).toHaveCount(0);
  await switchAccount("qa-user", 10);
  await open(page);
  await expect(chosen(page)).toHaveCount(0);
  await expect(preview(page)).toHaveCount(0);
  expect(await writes(page)).toEqual([]);
});
