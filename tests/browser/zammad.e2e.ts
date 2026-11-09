import { expect, test, type Page } from "@playwright/test";

const open = (page: Page, route = "/helpdesk", scenario = "zammad") =>
  page.goto(
    `/tests/browser/fixture.html?scenario=${scenario}&route=${encodeURIComponent(route)}`,
  );
const main = (page: Page) => page.getByRole("main").last();

test("Jira-Helpdesk-Verweis löst Ticketnummer auf und öffnet die API-ID", async ({
  page,
}) => {
  await open(page, "/issue/DEMO-1");
  const references = page.getByRole("region", { name: "Helpdesk-Tickets" });
  await expect(
    references.getByText("Anmeldung am Kundenportal nicht möglich"),
  ).toBeVisible();
  await expect(references.getByText(/20043776/)).toBeVisible();
  await references.getByRole("link", { name: "Öffnen", exact: true }).click();
  await expect(page).toHaveURL(/\/helpdesk\/41$/);
  await expect(
    page.getByRole("heading", {
      name: "Anmeldung am Kundenportal nicht möglich",
    }),
  ).toBeVisible();
});

test("Ticket bearbeiten, Antwort und Anhänge, Tags mit Undo, Zeit und Verknüpfung", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await open(page, "/helpdesk/41");
  await expect(
    page.getByRole("heading", {
      name: "Anmeldung am Kundenportal nicht möglich",
    }),
  ).toBeVisible();
  await page
    .getByLabel("Titel", { exact: true })
    .fill("Kundenportal-Zugang wiederherstellen");
  await page.getByLabel("Titel", { exact: true }).press("Tab");
  await expect(
    page.getByRole("button", { name: "Priorität ändern" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Priorität ändern" }).click();
  await page.getByRole("menuitemradio", { name: "Hoch", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Kundenportal-Zugang wiederherstellen" }),
  ).toBeVisible();
  await expect(
    page.getByText("Ticket gespeichert", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Nachricht", exact: true })
    .fill("Die Ursache ist gefunden.");
  await page.getByLabel("Datei anhängen", { exact: true }).setInputFiles({
    name: "diagnose.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Testdiagnose"),
  });
  await page.getByRole("button", { name: "Intern kommentieren" }).click();
  await expect(
    page.getByText("Die Ursache ist gefunden.", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Neuer Tag", { exact: true }).fill("geprüft");
  await page.getByRole("button", { name: "Hinzufügen", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "geprüft entfernen" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "geprüft entfernen" }).click();
  await expect(
    page.getByRole("button", { name: "geprüft entfernen" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "geprüft entfernen" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Zeit", exact: true }).click();
  await page.getByLabel("Zeiteinheiten", { exact: true }).fill("30");
  await page.getByRole("button", { name: "Zeit buchen", exact: true }).click();
  await expect(
    page.getByText("45 Zeiteinheiten", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Verknüpfungen", exact: true }).click();
  await page.getByLabel("Ticketnummer verknüpfen").fill("20043777");
  await page.getByRole("button", { name: "Verknüpfen", exact: true }).click();
  await expect(
    page.getByRole("link", { name: /Berechtigungen für das Support-Team/ }),
  ).toBeVisible();
  const requests = await page.evaluate(
    () => Reflect.get(window, "__qaZammad").requests,
  );
  expect(
    requests.find(
      (row: { path: string; method: string }) =>
        row.path === "/ticket_articles" && row.method === "POST",
    ).body,
  ).toMatchObject({
    internal: true,
    type: "note",
    content_type: "text/plain",
    attachments: [{ filename: "diagnose.txt", data: "VGVzdGRpYWdub3Nl" }],
  });
  expect(
    requests.find((row: { path: string }) => row.path === "/links/add").body
      .link_object_source_number,
  ).toBe("20043777");
  const download = page.waitForEvent("download");
  await page.getByRole("tab", { name: /^Verlauf/ }).click();
  await page.getByRole("button", { name: "fehler.txt", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("fehler.txt");
});

test("Fehler erhält Entwurf und optimistische Ticketänderung wird zurückgerollt", async ({
  page,
}) => {
  await open(page, "/helpdesk/41");
  await expect(
    page.getByRole("heading", {
      name: "Anmeldung am Kundenportal nicht möglich",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("article", { name: "Interner Kommentar" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: "Profilbild von Alex Support" }).first(),
  ).toBeVisible();
  await page.evaluate(() => {
    Reflect.get(window, "__qaZammad").failNext = 403;
  });
  await page.getByLabel("Titel", { exact: true }).fill("Nicht gespeichert");
  await page.getByLabel("Titel", { exact: true }).press("Tab");
  await expect(
    page.getByText("Keine Berechtigung für diese Zammad-Funktion.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Anmeldung am Kundenportal nicht möglich",
    }),
  ).toBeVisible();
  await page.evaluate(() => {
    Reflect.get(window, "__qaZammad").failNext = 500;
  });
  await page
    .getByRole("textbox", { name: "Nachricht", exact: true })
    .fill("Dieser Entwurf muss bleiben.");
  await page.getByRole("button", { name: "Intern kommentieren" }).click();
  await expect(
    page.getByRole("textbox", { name: "Nachricht", exact: true }),
  ).toHaveValue("Dieser Entwurf muss bleiben.");
});

test("Zammad verbinden, erstellen und trennen ohne Jira-Abhängigkeit", async ({
  page,
}) => {
  await open(page, "/settings/verbindungen", "zammad-unconnected");
  const settings = page.getByRole("region", { name: "Zammad", exact: true });
  await settings
    .getByLabel("Zammad-Adresse")
    .fill("https://helpdesk.example.com/api/v1");
  await settings.getByLabel("API-Token").fill("mock-token");
  await settings.getByRole("button", { name: "Zammad verbinden" }).click();
  await expect(settings.getByText("Verbunden", { exact: true })).toBeVisible();
  await settings.getByRole("link", { name: "Zammad-Tickets öffnen" }).click();
  await main(page)
    .getByRole("link", { name: "Ticket erstellen", exact: true })
    .click();
  await page.getByLabel("Titel", { exact: true }).fill("Neuer Supportfall");
  await expect(
    page.getByRole("combobox", { name: "Priorität", exact: true }),
  ).toHaveValue("2");
  await page
    .getByLabel("Beschreibung", { exact: true })
    .fill("Bitte Berechtigungen prüfen.");
  await page
    .getByRole("button", { name: "Kunde auswählen", exact: true })
    .click();
  await page.getByLabel("Kunde suchen").fill("Sam");
  await page.getByRole("button", { name: /Sam Kunde/ }).click();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Ticket erstellen", exact: true })
    .click();
  await expect(page).toHaveURL(/\/helpdesk\/43$/);
  await expect(
    page.getByRole("heading", { name: "Neuer Supportfall" }),
  ).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "mock-token",
  );
});

test("HTML-Nachrichten sind isoliert; Oberflächen funktionieren schmal und mit reduziertem Motion", async ({
  page,
}, testInfo) => {
  const external: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("tracker.invalid")) external.push(request.url());
  });
  await open(page, "/helpdesk/41");
  const frame = page.frameLocator('iframe[title="Nachricht 11"]');
  await expect(frame.getByText(/Seit heute/)).toBeVisible();
  expect(
    await page.evaluate(() => Reflect.get(window, "__xss")),
  ).toBeUndefined();
  expect(external).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("zammad-detail.png"),
    fullPage: true,
  });
});

test("Status bleibt nach Metadaten-Laden korrekt; Personenauswahl speichert nicht versehentlich", async ({
  page,
}) => {
  await open(page, "/helpdesk/41");
  await expect(
    page.getByRole("button", { name: "Status ändern" }),
  ).toContainText("Offen");
  await expect(
    page.getByRole("button", { name: "Priorität ändern" }),
  ).toContainText("Normal");
  await page.getByRole("button", { name: "Zuständig auswählen" }).click();
  await page.getByLabel("Zuständig suchen").fill("Alex");
  await page.getByRole("button", { name: /Alex Support/ }).click();
  await expect(page.getByLabel("Zuständig suchen")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      Reflect.get(window, "__qaZammad").requests.filter(
        (row: { method: string }) => row.method === "PUT",
      ),
    ),
  ).toHaveLength(0);
});

test("Entwurf überlebt Tabwechsel und Doppelclick erzeugt nur einen Beitrag", async ({
  page,
}) => {
  await open(page, "/helpdesk/41");
  await page
    .getByRole("textbox", { name: "Nachricht", exact: true })
    .fill("Eine einzige Nachricht");
  await page.getByRole("tab", { name: "Zeit", exact: true }).click();
  await page.getByRole("tab", { name: /^Verlauf/ }).click();
  await expect(
    page.getByRole("textbox", { name: "Nachricht", exact: true }),
  ).toHaveValue("Eine einzige Nachricht");
  await page.evaluate(() => {
    Reflect.get(window, "__qaZammad").delay = 350;
  });
  await page
    .getByRole("button", { name: "Intern kommentieren", exact: true })
    .dblclick();
  await expect(
    page.getByText("Beitrag gespeichert", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      Reflect.get(window, "__qaZammad").requests.filter(
        (row: { method: string; path: string }) =>
          row.method === "POST" && row.path === "/ticket_articles",
      ),
    ),
  ).toHaveLength(1);
});

test("Optionale Berechtigungsfehler blockieren den Nachrichtenverlauf nicht", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "__qaZammad", {
      configurable: true,
      set(value) {
        value.denied = ["/tags", "/links", "/tickets/41/time_accountings"];
        Object.defineProperty(window, "__qaZammad", { value, writable: true });
      },
    });
  });
  await open(page, "/helpdesk/41");
  await expect(
    page.getByRole("article", { name: "Interner Kommentar" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Tags" }).getByRole("alert"),
  ).toContainText("Keine Berechtigung");
});

test("Ohne Jira-Anmeldung bleiben Helpdesk-Tickets bedienbar; Trennen leert den Cache", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "__qa", {
      configurable: true,
      set(value) {
        value.signedOut = true;
        Object.defineProperty(window, "__qa", { value, writable: true });
      },
    });
  });
  await open(page, "/helpdesk/41");
  await expect(
    page.getByRole("heading", {
      name: "Anmeldung am Kundenportal nicht möglich",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("tablist", { name: "Geöffnete Tickets" }).getByRole("tab", { name: /20043776/ }),
  ).toHaveAttribute("href", "/helpdesk/41");
  await page.getByRole("link", { name: "Einstellungen", exact: true }).click();
  await page.getByRole("link", { name: "Verbindungen", exact: true }).click();
  const settings = page.getByRole("region", { name: "Zammad", exact: true });
  await settings.getByRole("button", { name: "Trennen", exact: true }).click();
  await expect(
    settings.getByRole("button", { name: "Zammad verbinden", exact: true }),
  ).toBeVisible();
  const helpdeskLink = page.getByRole("link", {
    name: "Zammad-Tickets",
    exact: true,
  });
  if (!(await helpdeskLink.isVisible()))
    await page.getByRole("button", { name: "Toggle Sidebar" }).click();
  await helpdeskLink.click();
  await expect(
    page.getByRole("heading", { name: "Verbinde Zammad" }),
  ).toBeVisible();
  await expect(
    page.getByText("Anmeldung am Kundenportal nicht möglich", { exact: true }),
  ).toHaveCount(0);
});

test("Command-Palette findet Helpdesk-Tickets nach öffentlicher Nummer", async ({
  page,
}) => {
  await open(page, "/helpdesk");
  await page.getByRole("button", { name: "Suchen", exact: true }).click();
  await page.getByRole("dialog").getByRole("combobox").fill("20043776");
  const result = page.getByRole("option", {
    name: /Anmeldung am Kundenportal nicht möglich/,
  });
  await expect(result).toBeVisible();
  await result.click();
  await expect(page).toHaveURL(/\/helpdesk\/41$/);
});
