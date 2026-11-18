import { expect, test, type Page } from "@playwright/test";

const mail = "/ticket_articles/by_ticket/41?expand=true";
const manual = '"Team, Nord" <TEAM@example.test>,  Manual@example.test';
const firstTicket = /Anmeldung am Kundenportal nicht möglich/;
const otherTicket = /Berechtigungen für das Support-Team/;
const mailDialog = (page: Page) =>
  page.getByRole("dialog", { name: "CC aus der Quellmail" });
const trigger = (page: Page) =>
  page.getByRole("button", { name: "CC aus Quellmail prüfen" });
const insert = (page: Page) =>
  mailDialog(page).getByRole("button", { name: "Auswahl übernehmen" });
const cc = (page: Page) =>
  page.getByRole("textbox", { name: "CC", exact: true });
const body = (page: Page) =>
  page.getByRole("textbox", { name: "Nachricht", exact: true });
const reply = (page: Page, name = "Sam Kunde") =>
  page.getByRole("button", { name: `Auf Nachricht von ${name} antworten` });
const choice = (page: Page, address: string) =>
  mailDialog(page).getByRole("checkbox", { name: address, exact: true });

async function open(page: Page) {
  await page.goto(
    "/tests/browser/fixture.html?scenario=zammad-source-cc&route=/helpdesk",
  );
  const first = page.getByRole("link", { name: firstTicket });
  await expect(first).toBeVisible();
  await page.evaluate(() => {
    const state = Reflect.get(window, "__qaZammad");
    const [source, note] = state.articles;
    source.cc =
      '"Team, Nord" <Team@Example.test>, qa@example.test, QA@EXAMPLE.TEST, invalid, skip@example.test, sam@example.com';
    source.bcc = "hidden@example.test";
    note.cc = "internal@example.test";
    state.links.push({
      link_type: "child",
      link_object: "Ticket",
      link_object_value: 42,
    });
    for (const [id, name, cc, type, ticketId] of [
      [13, "Ohne CC", undefined, "email", 41],
      [14, "Unklare Daten", ["array@example.test"], "email", 41],
      [15, "Ungültig", "no-address, angestueckelt@@example.test", "email", 41],
      [16, "Webnachricht", "web@example.test", "web", 41],
      [17, "Zweite Quelle", "other@example.test", "email", 41],
      [18, "Split-Ticket", undefined, "email", 42],
    ] as const) {
      state.articles.push({
        ...source,
        id,
        ticket_id: ticketId,
        created_by_id: undefined,
        type,
        cc,
        from: `${name} <second-${id}@example.test>`,
        subject: name,
        body: `${name} mit text-only@example.test im Inhalt`,
        content_type: "text/plain",
        message_id: `${id}@example.test`,
      });
    }
    state.scopedArticleReads = [];
    state.beforeArticleResponse = async (args: {
      path: string;
      connectionScope?: { baseUrl: string; revision: string };
    }) => {
      if (!args.connectionScope) return;
      state.scopedArticleReads.push({
        path: args.path,
        ...args.connectionScope,
      });
      if (!state.holdNextSource) return;
      state.holdNextSource = false;
      await new Promise<void>((release) => {
        state.releaseSource = release;
      });
      state.releasedSources = (state.releasedSources ?? 0) + 1;
    };
  });
  await first.click();
  await expect(reply(page)).toBeEnabled();
}

async function hold(page: Page) {
  await page.evaluate(() => {
    Reflect.get(window, "__qaZammad").holdNextSource = true;
  });
  await trigger(page).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => typeof Reflect.get(window, "__qaZammad").releaseSource,
      ),
    )
    .toBe("function");
  await expect(
    mailDialog(page).getByRole("status", { name: "Quellmail wird geprüft" }),
  ).toBeVisible();
}

async function release(page: Page) {
  await page.evaluate(() => {
    Reflect.get(window, "__qaZammad").releaseSource();
  });
  await expect
    .poll(() =>
      page.evaluate(() => Reflect.get(window, "__qaZammad").releasedSources),
    )
    .toBe(1);
}

const reads = (page: Page) =>
  page.evaluate(() => Reflect.get(window, "__qaZammad").scopedArticleReads);

test.afterEach(async ({ page }, info) => {
  const ledger = await page.evaluate(() => {
    const state = Reflect.get(window, "__qaZammad");
    return {
      requests: state.requests as {
        path: string;
        method: string;
        body: unknown;
      }[],
      scopedArticleReads: state.scopedArticleReads,
    };
  });
  await info.attach("n16-ledger", {
    contentType: "application/json",
    body: JSON.stringify(ledger),
  });
  expect(ledger.requests.filter((request) => request.method !== "GET")).toEqual(
    [],
  );
});

test("N16 übernimmt nur gewählte echte CCs und erhält den lokalen Entwurf", async ({
  page,
}, info) => {
  if (info.project.name.includes("narrow"))
    await page.setViewportSize({ width: 390, height: 760 });
  await open(page);
  await expect(trigger(page)).toHaveCount(0);
  await reply(page).press("Enter");
  await expect(body(page)).toBeFocused();
  expect(await reads(page)).toEqual([]);
  await cc(page).fill(manual);
  await body(page).fill("Meine Antwort bleibt erhalten.");
  await trigger(page).press("Enter");
  await expect(mailDialog(page).getByRole("checkbox")).toHaveCount(4);
  await expect(mailDialog(page).getByRole("heading")).toBeFocused();
  await expect(insert(page)).toBeDisabled();
  await expect(cc(page)).toHaveValue(manual);
  for (const address of [
    "team@example.test",
    "qa@example.test",
    "skip@example.test",
    "sam@example.com",
  ]) {
    await expect(choice(page, address)).not.toBeChecked();
  }
  await page.keyboard.press("Tab");
  await expect(choice(page, "team@example.test")).toBeFocused();
  await page.keyboard.press("Space");
  await page.keyboard.press("Tab");
  await expect(choice(page, "qa@example.test")).toBeFocused();
  await page.keyboard.press("Space");
  await choice(page, "sam@example.com").press("Space");
  await expect(cc(page)).toHaveValue(manual);
  expect(
    await mailDialog(page).evaluate((dialog) => {
      const bounds = dialog.getBoundingClientRect();
      return bounds.left >= 0 && bounds.right <= innerWidth;
    }),
  ).toBe(true);
  await mailDialog(page).screenshot({ path: info.outputPath("source-cc.png") });
  await insert(page).press("Enter");
  await expect(mailDialog(page)).toHaveCount(0);
  await expect(cc(page)).toHaveValue(`${manual}, qa@example.test`);
  await expect(body(page)).toHaveValue("Meine Antwort bleibt erhalten.");
  await expect(
    page.getByRole("textbox", { name: "An", exact: true }),
  ).toHaveValue("sam@example.com");
  await expect(
    page.getByRole("textbox", { name: "Betreff", exact: true }),
  ).toHaveValue("Re: Anmeldung schlägt fehl");
  expect(await reads(page)).toEqual([
    { path: mail, baseUrl: "https://helpdesk.example.com", revision: "0" },
  ]);
});

test("N16 sperrt fehlende, ungültige oder unklare Daten und fremde Quellen", async ({
  page,
}) => {
  await open(page);
  await expect(
    page
      .getByRole("article", { name: "Interner Kommentar" })
      .getByRole("button", { name: /antworten/i }),
  ).toHaveCount(0);
  await reply(page, "Webnachricht").click();
  await expect(trigger(page)).toHaveCount(0);
  for (const name of ["Ohne CC", "Unklare Daten", "Ungültig"]) {
    await reply(page, name).click();
    await trigger(page).click();
    await expect(mailDialog(page).getByRole("status")).toHaveText(
      "Keine sicher lesbaren CC-Adressen in dieser Quellmail.",
    );
    await expect(mailDialog(page).getByRole("checkbox")).toHaveCount(0);
    await expect(insert(page)).toHaveCount(0);
    await mailDialog(page).getByRole("button", { name: "Abbrechen" }).click();
    await expect(cc(page)).toHaveValue("");
  }
  await page.goBack();
  await page.getByRole("link", { name: otherTicket }).click();
  await reply(page, "Split-Ticket").click();
  await trigger(page).click();
  await expect(mailDialog(page).getByRole("status")).toHaveText(
    /Keine sicher lesbaren/,
  );
  await expect(mailDialog(page).getByRole("checkbox")).toHaveCount(0);
  expect(
    (await reads(page)).map((read: { path: string }) => read.path),
  ).toEqual([mail, mail, mail, "/ticket_articles/by_ticket/42?expand=true"]);
});

test("N16 verwirft Auswahl bei Abbruch und sperrt fehlende Artikelrechte", async ({
  page,
}) => {
  await open(page);
  await reply(page).click();
  await expect(body(page)).toBeFocused();
  await cc(page).fill(manual);
  await trigger(page).click();
  await choice(page, "qa@example.test").click();
  await page.keyboard.press("Escape");
  await expect(trigger(page)).toBeFocused();
  await expect(cc(page)).toHaveValue(manual);
  await trigger(page).click();
  await expect(choice(page, "qa@example.test")).not.toBeChecked();
  await expect(insert(page)).toBeDisabled();
  await mailDialog(page).getByRole("button", { name: "Abbrechen" }).click();
  await hold(page);
  await mailDialog(page).getByRole("button", { name: "Abbrechen" }).click();
  await release(page);
  await expect(mailDialog(page)).toHaveCount(0);
  await expect(cc(page)).toHaveValue(manual);
  await page.evaluate(() => {
    Reflect.get(window, "__qaZammad").denied = [
      "/ticket_articles/by_ticket/41",
    ];
  });
  await trigger(page).click();
  await expect(mailDialog(page).getByRole("alert")).toContainText(
    "Keine Berechtigung",
  );
  await expect(insert(page)).toHaveCount(0);
  await expect(cc(page)).toHaveValue(manual);
});

test("N16 liest frische CC-Daten und erhält eine halbfertige manuelle Eingabe", async ({
  page,
}) => {
  await open(page);
  await reply(page).click();
  await expect(body(page)).toBeFocused();
  await cc(page).fill("Halbfertige Adresse <");
  await page.evaluate(() => {
    Reflect.get(window, "__qaZammad").articles[0].cc = "fresh@example.test";
  });
  await trigger(page).click();
  await expect(choice(page, "fresh@example.test")).toBeVisible();
  await expect(choice(page, "qa@example.test")).toHaveCount(0);
  await choice(page, "fresh@example.test").click();
  await insert(page).click();
  await expect(mailDialog(page).getByRole("alert")).toContainText(
    "Bitte prüfe die Adressen im CC-Feld",
  );
  await expect(cc(page)).toHaveValue("Halbfertige Adresse <");
  await mailDialog(page).getByRole("button", { name: "Abbrechen" }).click();
  await cc(page).fill(manual);
  await page.evaluate(() => {
    Reflect.get(window, "__qaZammad").articles[0].message_id =
      "replaced@example.test";
  });
  await trigger(page).click();
  await expect(mailDialog(page).getByRole("alert")).toContainText(
    "Quelle oder Verbindung wurde geändert",
  );
  await expect(mailDialog(page).getByRole("checkbox")).toHaveCount(0);
  await expect(cc(page)).toHaveValue(manual);
});

for (const scope of ["Artikel", "Ticket"] as const) {
  test(`N16 verwirft gehaltene Antwort nach ${scope}wechsel`, async ({
    page,
  }) => {
    await open(page);
    await reply(page).click();
    await expect(body(page)).toBeFocused();
    await cc(page).fill(manual);
    await expect(cc(page)).toHaveValue(manual);
    await hold(page);
    if (scope === "Artikel") {
      await reply(page, "Zweite Quelle").click();
      await expect(cc(page)).toHaveValue(manual);
    } else {
      await page.goBack();
      await page.getByRole("link", { name: otherTicket }).click();
      await reply(page, "Split-Ticket").click();
      await expect(cc(page)).toHaveValue("");
    }
    await release(page);
    await expect(mailDialog(page)).toHaveCount(0);
    await trigger(page).click();
    if (scope === "Artikel")
      await expect(choice(page, "other@example.test")).toBeVisible();
    else
      await expect(mailDialog(page).getByRole("status")).toHaveText(
        /Keine sicher lesbaren/,
      );
    await expect(choice(page, "qa@example.test")).toHaveCount(0);
  });
}

test("N16 sperrt alte Quellen nach nativer Verbindungsrevision auch beim Übernehmen", async ({
  page,
}) => {
  await open(page);
  await reply(page).click();
  await expect(body(page)).toBeFocused();
  await cc(page).fill(manual);
  await hold(page);
  await page.evaluate(() => {
    Reflect.get(window, "__qaZammad").connection.revision = "1";
  });
  await release(page);
  await expect(mailDialog(page).getByRole("alert")).toContainText(
    "Verbindung wurde geändert",
  );
  await expect(mailDialog(page).getByRole("checkbox")).toHaveCount(0);
  await mailDialog(page).getByRole("button", { name: "Abbrechen" }).click();
  await page.evaluate(() => {
    Reflect.get(window, "__qaZammad").connection.revision = "0";
  });
  await trigger(page).click();
  await choice(page, "qa@example.test").click();
  await page.evaluate(() => {
    Reflect.get(window, "__qaZammad").connection.revision = "2";
  });
  await insert(page).click();
  await expect(mailDialog(page).getByRole("alert")).toContainText(
    "Verbindung wurde geändert",
  );
  await expect(mailDialog(page).getByRole("checkbox")).toHaveCount(0);
  await expect(cc(page)).toHaveValue(manual);
});

test("N16 verwirft offene Auswahl und isoliert den Entwurf beim Kontowechsel", async ({
  page,
}) => {
  await open(page);
  await reply(page).click();
  await expect(body(page)).toBeFocused();
  await cc(page).fill(manual);
  await hold(page);
  const before = await page.evaluate(
    () =>
      Reflect.get(window, "__qaZammad").requests.filter(
        (row: { path: string }) => row.path === "/users/me",
      ).length,
  );
  await page.clock.setFixedTime(new Date(Date.now() + 120_000));
  await page.evaluate(() => {
    Reflect.get(window, "__qaZammad").me = {
      id: 8,
      firstname: "Zweites Konto",
      active: true,
    };
    window.dispatchEvent(new Event("visibilitychange"));
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          Reflect.get(window, "__qaZammad").requests.filter(
            (row: { path: string }) => row.path === "/users/me",
          ).length,
      ),
    )
    .toBeGreaterThan(before);
  await expect(mailDialog(page)).toHaveCount(0);
  await expect(trigger(page)).toHaveCount(0);
  await release(page);
  await reply(page).click();
  await expect(cc(page)).toHaveValue("");
  await expect(mailDialog(page)).toHaveCount(0);
});

test("N16 erhält die manuelle Antwort beim erstmaligen Laden des Kontos", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "__qaZammad", {
      configurable: true,
      set(state) {
        state.scopedArticleReads = [];
        state.beforeMeResponse = () =>
          new Promise<void>((resolve) => {
            state.releaseMe = resolve;
          });
        Object.defineProperty(window, "__qaZammad", {
          value: state,
          writable: true,
        });
      },
    }),
  );
  await page.goto(
    "/tests/browser/fixture.html?scenario=zammad-source-cc&route=/helpdesk/41",
  );
  await expect
    .poll(() =>
      page.evaluate(() => typeof Reflect.get(window, "__qaZammad").releaseMe),
    )
    .toBe("function");
  await reply(page).click();
  await expect(body(page)).toBeFocused();
  await cc(page).fill(manual);
  await body(page).fill("Antwort vor der Kontoauflösung");
  await expect(cc(page)).toHaveValue(manual);
  await expect(trigger(page)).toHaveCount(0);
  await page.evaluate(() => Reflect.get(window, "__qaZammad").releaseMe());
  await expect(trigger(page)).toBeVisible();
  await expect(cc(page)).toHaveValue(manual);
  await expect(body(page)).toHaveValue("Antwort vor der Kontoauflösung");
});
