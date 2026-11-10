import { expect, test } from "@playwright/test";

const fixture = (route: string, scenario = "zammad") =>
  `/tests/browser/fixture.html?scenario=${scenario}&route=${encodeURIComponent(route)}`;

test("Zammad-Tickets haben echte Profilbilder, klare Kanäle und gemeinsame Jira-Tabs", async ({
  page,
}, testInfo) => {
  await page.goto(fixture("/issue/DEMO-1"));
  await page
    .getByRole("region", { name: "Helpdesk-Tickets" })
    .getByRole("link", { name: "Öffnen", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Anmeldung am Kundenportal nicht möglich",
    }),
  ).toBeVisible();
  const tabs = page.getByRole("tablist", { name: "Geöffnete Tickets" });
  await expect(tabs.getByRole("tab", { name: /DEMO-1/ })).toBeAttached();
  await expect(tabs.getByRole("tab", { name: /20043776/ })).toHaveAttribute(
    "href",
    "/helpdesk/41",
  );
  await expect(
    page.getByRole("img", { name: "Profilbild von Sam Kunde" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Profilbild von Alex Support" }).first(),
  ).toBeVisible();
  const internal = page.getByRole("article", {
    name: "Interner Kommentar",
    exact: true,
  });
  await expect(
    internal.getByRole("button", { name: /antworten/i }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Intern kommentieren", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Nachricht", exact: true })
    .fill("Dieser Kommentar bleibt beim Ticketwechsel erhalten.");
  await tabs.getByRole("tab", { name: /DEMO-1/ }).click();
  await tabs.getByRole("tab", { name: /20043776/ }).click();
  await expect(
    page.getByRole("textbox", { name: "Nachricht", exact: true }),
  ).toHaveValue("Dieser Kommentar bleibt beim Ticketwechsel erhalten.");
  await page.getByRole("textbox", { name: "Nachricht", exact: true }).fill("");
  await page.getByRole("navigation", { name: "Ticketpfad" }).click();
  await page.screenshot({
    path: testInfo.outputPath("zammad-redesigned-ticket.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Auf Nachricht von Sam Kunde antworten" })
    .click();
  await expect(page.getByLabel("An", { exact: true })).toHaveValue(
    "sam@example.com",
  );
  await expect(page.getByLabel("Betreff", { exact: true })).toHaveValue(
    "Re: Anmeldung schlägt fehl",
  );
  await page.getByRole("button", { name: "Antwortbezug entfernen" }).click();
  await expect(
    page.getByRole("button", { name: "E-Mail senden", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Auf Nachricht von Sam Kunde antworten" })
    .click();
  await tabs.getByRole("tab", { name: /DEMO-1/ }).click();
  await tabs.getByRole("tab", { name: /20043776/ }).click();
  await expect(
    page.getByText(/Antwort auf „Anmeldung schlägt fehl“/),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Nachricht", exact: true })
    .fill("Wir haben den Zugang wiederhergestellt.");
  await page
    .getByRole("button", { name: "E-Mail senden", exact: true })
    .click();
  await expect(
    page.getByText("E-Mail versendet", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        Reflect.get(window, "__qaZammad")
          .requests.filter(
            (row: { path: string; method: string }) =>
              row.path === "/ticket_articles" && row.method === "POST",
          )
          .at(-1).body,
    ),
  ).toMatchObject({
    internal: false,
    type: "email",
    to: "sam@example.com",
    in_reply_to: "customer-message@example.com",
  });
});

test("Zammad-Liste zeigt Personen; Einrichtung erklärt fehlenden Token-Zugriff", async ({
  page,
}, testInfo) => {
  await page.goto(fixture("/helpdesk"));
  await expect(
    page.getByRole("heading", { name: "Zammad-Tickets", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Profilbild von Sam Kunde" }).first(),
  ).toBeAttached();
  await page.screenshot({
    path: testInfo.outputPath("zammad-redesigned-list.png"),
    fullPage: true,
  });
  await page.goto(fixture("/settings/verbindungen", "zammad-unconnected"));
  const section = page.getByRole("region", { name: "Zammad", exact: true });
  await section
    .getByText("Kein Token-Zugriff im Profil?", { exact: true })
    .click();
  await expect(
    section.getByText(/user_preferences.access_token/),
  ).toBeVisible();
  await section.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("zammad-redesigned-connection.png"),
    fullPage: true,
  });
});

test("390 px: Zammad-Tab bleibt über das Ticketmenü erreichbar", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(fixture("/helpdesk/41"));
  await expect(
    page.getByRole("heading", {
      name: "Anmeldung am Kundenportal nicht möglich",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Weitere Aktionen", exact: true })
    .click();
  await expect(
    page.getByRole("menuitemradio", { name: /#20043776/ }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.screenshot({
    path: testInfo.outputPath("zammad-redesigned-mobile.png"),
    fullPage: true,
  });
});

test("Gesendete Kommentare bleiben nach einem Ticketwechsel nicht als Entwurf stehen", async ({
  page,
}) => {
  await page.goto(fixture("/issue/DEMO-1"));
  await page
    .getByRole("region", { name: "Helpdesk-Tickets" })
    .getByRole("link", { name: "Öffnen", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "Profilbild von Sam Kunde" }).first(),
  ).toBeVisible();
  await page.evaluate(() => {
    Reflect.get(window, "__qaZammad").delay = 400;
  });
  await page
    .getByRole("textbox", { name: "Nachricht", exact: true })
    .fill("Einmal gespeichert, auch wenn ich sofort wechsle.");
  await page
    .getByRole("button", { name: "Intern kommentieren", exact: true })
    .click();
  const tabs = page.getByRole("tablist", { name: "Geöffnete Tickets" });
  await tabs.getByRole("tab", { name: /DEMO-1/ }).click();
  await expect(
    page.getByText("Beitrag gespeichert", { exact: true }),
  ).toBeVisible();
  await tabs.getByRole("tab", { name: /20043776/ }).click();
  await expect(
    page.getByRole("textbox", { name: "Nachricht", exact: true }),
  ).toHaveValue("");
});
