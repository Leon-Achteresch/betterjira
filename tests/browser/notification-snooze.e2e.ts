import { expect, test, type Page } from "@playwright/test";

const open = (page: Page, route = "/benachrichtigungen") =>
  page.goto(
    `/tests/browser/fixture.html?${new URLSearchParams({ route, scenario: "notifications" })}`,
  );
const row = (page: Page, key: string) =>
  page
    .locator("#app-scroll")
    .getByRole("listitem")
    .filter({
      has: page.getByRole("button", { name: `${key} öffnen`, exact: true }),
    });
const shelf = (page: Page, name: RegExp) =>
  page
    .getByRole("tablist", { name: "Ablage der Benachrichtigungen" })
    .getByRole("tab", { name });
const bell = (page: Page) =>
  page.getByRole("button", { name: /^Benachrichtigungen(, \d+ ungelesen)?$/ });

test("Zurückstellen synchronisiert Badge, Undo, Persistenz und Zurückholen", async ({
  page,
}) => {
  await open(page);
  await expect(bell(page)).toHaveAccessibleName(
    "Benachrichtigungen, 9 ungelesen",
  );
  await row(page, "DEMO-2")
    .getByRole("button", { name: "DEMO-2 zurückstellen" })
    .click();
  await page
    .getByRole("button", { name: "Morgen um 9 Uhr", exact: true })
    .click();
  await expect(row(page, "DEMO-2")).toHaveCount(0);
  await expect(bell(page)).toHaveAccessibleName(
    "Benachrichtigungen, 8 ungelesen",
  );
  await expect(shelf(page, /Zurückgestellt/)).toHaveText("Zurückgestellt1");
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(row(page, "DEMO-2")).toBeVisible();
  await expect(bell(page)).toHaveAccessibleName(
    "Benachrichtigungen, 9 ungelesen",
  );
  await row(page, "DEMO-2")
    .getByRole("button", { name: "DEMO-2 zurückstellen" })
    .click();
  await page
    .getByRole("button", { name: "Morgen um 9 Uhr", exact: true })
    .click();
  await open(page, "/benachrichtigungen?ablage=spaeter");
  await expect(shelf(page, /Zurückgestellt/)).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(
    row(page, "DEMO-2").getByText(/Zurückgestellt bis/),
  ).toBeVisible();
  await row(page, "DEMO-2")
    .getByRole("button", { name: "DEMO-2 zurückstellen" })
    .click();
  await page
    .getByRole("button", { name: "Jetzt zurückholen", exact: true })
    .click();
  await shelf(page, /^Eingang$/).click();
  await expect(row(page, "DEMO-2")).toBeVisible();
  await expect(bell(page)).toHaveAccessibleName(
    "Benachrichtigungen, 9 ungelesen",
  );
});

test("Eigener Zeitpunkt wird bei Fälligkeit auch ohne Jira-Abruf wieder ungelesen", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-13T08:00:00Z"));
  await open(page);
  await row(page, "DEMO-3")
    .getByRole("button", { name: "DEMO-3 zurückstellen" })
    .click();
  await page.getByLabel("Eigener Zeitpunkt").fill("2026-11-13T09:01");
  await page
    .getByRole("button", { name: "Zurückstellen", exact: true })
    .click();
  await shelf(page, /Zurückgestellt/).click();
  await expect(row(page, "DEMO-3")).toBeVisible();
  await page.clock.setFixedTime(new Date("2026-11-13T08:01:01Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(row(page, "DEMO-3")).toHaveCount(0);
  await shelf(page, /^Eingang$/).click();
  await expect(
    row(page, "DEMO-3").getByRole("button", {
      name: "Als gelesen markieren",
      exact: true,
    }),
  ).toBeVisible();
  await expect(bell(page)).toHaveAccessibleName(
    "Benachrichtigungen, 10 ungelesen",
  );
});

test("Schmale Ansicht ist tastaturbedienbar und ohne Überlauf", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await row(page, "DEMO-2")
    .getByRole("button", { name: "DEMO-2 zurückstellen" })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Eigener Zeitpunkt")).toBeVisible();
  await page.getByRole("button", { name: "In 3 Stunden", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(shelf(page, /^Eingang$/)).toBeFocused();
  await shelf(page, /Zurückgestellt/).click();
  await expect(row(page, "DEMO-2")).toBeVisible();
  expect(
    await page
      .locator("#app-scroll")
      .evaluate((element) => element.scrollWidth - element.clientWidth),
  ).toBeLessThanOrEqual(0);
  if (process.env.SNOOZE_SHOTS)
    await page.screenshot({
      path: `${process.env.SNOOZE_SHOTS}/snooze-${test.info().project.name}.png`,
    });
});

test("Bestehende Wiedervorlage ist vorausgefüllt und Änderungen bleiben nach Neustart erhalten", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-13T08:00:00Z"));
  await open(page);
  await row(page, "DEMO-2")
    .getByRole("button", { name: "DEMO-2 zurückstellen" })
    .click();
  await page.getByLabel("Eigener Zeitpunkt").fill("2026-11-16T10:30");
  await page
    .getByRole("button", { name: "Zurückstellen", exact: true })
    .click();
  await open(page, "/benachrichtigungen?ablage=spaeter");
  await row(page, "DEMO-2")
    .getByRole("button", { name: "DEMO-2 zurückstellen" })
    .click();
  await expect(page.getByLabel("Eigener Zeitpunkt")).toHaveValue(
    "2026-11-16T10:30",
  );
  await page.getByLabel("Eigener Zeitpunkt").fill("2026-11-17T11:15");
  await page
    .getByRole("button", { name: "Zurückstellen", exact: true })
    .click();
  await open(page, "/benachrichtigungen?ablage=spaeter");
  await row(page, "DEMO-2")
    .getByRole("button", { name: "DEMO-2 zurückstellen" })
    .click();
  await expect(page.getByLabel("Eigener Zeitpunkt")).toHaveValue(
    "2026-11-17T11:15",
  );
});

test("Ungültiger Zeitpunkt wird am Feld erklärt und verworfene Änderungen werden zurückgesetzt", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-13T08:00:00Z"));
  await open(page);
  const trigger = row(page, "DEMO-2").getByRole("button", {
    name: "DEMO-2 zurückstellen",
  });
  await trigger.click();
  const field = page.getByLabel("Eigener Zeitpunkt");
  await field.fill("2026-11-12T10:00");
  await page
    .getByRole("button", { name: "Zurückstellen", exact: true })
    .click();
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(field).toHaveAccessibleDescription(
    "Wähle einen Zeitpunkt in der Zukunft.",
  );
  await expect(row(page, "DEMO-2")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(field).toHaveValue("");
  await expect(field).toHaveAttribute("aria-invalid", "false");
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveCount(0);
});
