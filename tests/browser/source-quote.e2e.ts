import { expect, test, type Page } from "@playwright/test";
import { Buffer } from "node:buffer";
import type { QuoteQa } from "./source-quote-hook-fixture";

const open = async (page: Page) => {
  await page.goto(
    "/tests/browser/fixture.html?scenario=zammad&route=/helpdesk/41",
  );
  await expect(
    page.getByRole("button", { name: "Als interne Notiz zitieren" }).first(),
  ).toBeEnabled();
};
const composer = (page: Page) =>
  page.getByRole("textbox", { name: "Nachricht", exact: true });
const writes = (page: Page) =>
  page.evaluate(() =>
    Reflect.get(window, "__qaZammad").requests.filter(
      (row: { method: string }) => row.method !== "GET",
    ),
  );
const prepare = async (page: Page, index = 0) => {
  await page
    .getByRole("button", { name: "Als interne Notiz zitieren" })
    .nth(index)
    .click();
  await expect(
    page.getByRole("button", { name: "In internen Entwurf übernehmen" }),
  ).toBeEnabled();
};

test("Bewusste Übernahme erhält E-Mailentwurf und sendet erst manuell ausschließlich intern", async ({
  page,
}) => {
  const external: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("tracker.invalid")) external.push(request.url());
  });
  await open(page);
  await page.getByRole("button", { name: "Kommunikationsart wählen" }).click();
  await page.getByRole("menuitem", { name: /^E-Mail/ }).click();
  await composer(page).fill("Meine ungesendete Kundenantwort");
  await page.getByLabel("Datei anhängen", { exact: true }).setInputFiles({
    name: "kundenentwurf.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Lokaler Anhang"),
  });
  await page
    .getByRole("textbox", { name: "CC", exact: true })
    .fill("team@example.com");
  await prepare(page);
  const preview = page.getByRole("dialog", {
    name: "Interne Notiz mit Quellzitat vorbereiten",
  });
  await expect(preview).toContainText("Sam Kunde <sam@example.com>");
  await expect(preview).toContainText("2026-11-09T09:00:00Z");
  await expect(preview).toContainText(
    "Seit heute kann ich mich nicht mehr am Kundenportal anmelden.",
  );
  await expect(preview).toContainText("Quellbeitrag 11");
  expect(await writes(page)).toEqual([]);
  await page
    .getByRole("button", { name: "In internen Entwurf übernehmen" })
    .click();
  await expect(composer(page)).toHaveValue(/Zitat von Sam Kunde/);
  expect(await composer(page).inputValue()).not.toMatch(
    /<p>|<script>|tracker|Quellbeitrag 11|Meine ungesendete/,
  );
  await expect(
    page.getByRole("button", { name: "Kommunikationsart wählen" }),
  ).toBeDisabled();
  await composer(page).fill(
    `${await composer(page).inputValue()}Meine interne Antwort`,
  );
  await page.getByRole("button", { name: "Zum bisherigen Entwurf" }).click();
  await expect(composer(page)).toHaveValue("Meine ungesendete Kundenantwort");
  await expect(
    page.getByText("kundenentwurf.txt", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "CC", exact: true }),
  ).toHaveValue("team@example.com");
  await expect(
    page.getByRole("textbox", { name: "An", exact: true }),
  ).toHaveValue("sam@example.com");
  await page
    .getByRole("button", { name: "Internen Zitatentwurf öffnen" })
    .click();
  await expect(composer(page)).toHaveValue(/Meine interne Antwort$/);
  expect(await writes(page)).toEqual([]);
  await page
    .getByRole("button", { name: "Intern kommentieren", exact: true })
    .click();
  await expect(composer(page)).toHaveValue("");
  const posts = await writes(page);
  expect(posts).toHaveLength(1);
  expect(posts[0].body).toMatchObject({
    ticket_id: 41,
    type: "note",
    internal: true,
    content_type: "text/plain",
  });
  expect(posts[0].body).not.toHaveProperty("to");
  expect(posts[0].body).not.toHaveProperty("cc");
  expect(posts[0].body).not.toHaveProperty("in_reply_to");
  expect(posts[0].body.attachments).toEqual([]);
  await page.getByRole("button", { name: "Zum bisherigen Entwurf" }).click();
  await expect(composer(page)).toHaveValue("Meine ungesendete Kundenantwort");
  expect(external).toEqual([]);
});

test("Mehrfachaktivierung dupliziert kein Zitat; jüngere Eingaben und weitere Quellen bleiben erhalten", async ({
  page,
}) => {
  await open(page);
  await composer(page).fill("Ursprünglicher interner Entwurf");
  await prepare(page);
  await page
    .getByRole("button", { name: "In internen Entwurf übernehmen" })
    .evaluate((button) => {
      if (button instanceof HTMLButtonElement) {
        button.click();
        button.click();
      }
    });
  const first = await composer(page).inputValue();
  expect(first.match(/Zitat von Sam/g)).toHaveLength(1);
  await composer(page).fill(`${first}Neuere Eingabe`);
  await page
    .getByRole("button", { name: "Als interne Notiz zitieren" })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Zitatentwurf öffnen" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Zitatentwurf öffnen" }).click();
  await expect(composer(page)).toHaveValue(`${first}Neuere Eingabe`);
  await prepare(page, 1);
  await page
    .getByRole("button", { name: "In internen Entwurf übernehmen" })
    .click();
  await expect(composer(page)).toHaveValue(
    /Neuere Eingabe\n\nZitat von Alex Support/,
  );
  await page.getByRole("button", { name: "Zum bisherigen Entwurf" }).click();
  await expect(composer(page)).toHaveValue("Ursprünglicher interner Entwurf");
  expect(await writes(page)).toEqual([]);
});

test("Quellfehler und Schreibfehler erhalten beide Entwürfe", async ({
  page,
}) => {
  await open(page);
  await composer(page).fill("Bestehender Entwurf");
  await page.evaluate(
    () =>
      (Reflect.get(window, "__qaZammad").denied = [
        "/ticket_articles/by_ticket/41",
      ]),
  );
  await page
    .getByRole("button", { name: "Als interne Notiz zitieren" })
    .first()
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Keine Berechtigung",
  );
  await expect(
    page.getByRole("button", { name: "In internen Entwurf übernehmen" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(composer(page)).toHaveValue("Bestehender Entwurf");
  await page.evaluate(() => (Reflect.get(window, "__qaZammad").denied = []));
  await prepare(page);
  await page
    .getByRole("button", { name: "In internen Entwurf übernehmen" })
    .click();
  const body = await composer(page).inputValue();
  await page.evaluate(
    () => (Reflect.get(window, "__qaZammad").denied = ["/ticket_articles"]),
  );
  await page
    .getByRole("button", { name: "Intern kommentieren", exact: true })
    .click();
  await expect(
    page.getByText("Keine Berechtigung für diese Zammad-Funktion.").first(),
  ).toBeVisible();
  await expect(composer(page)).toHaveValue(body);
  await page.getByRole("button", { name: "Zum bisherigen Entwurf" }).click();
  await expect(composer(page)).toHaveValue("Bestehender Entwurf");
});

test("Native Verbindungsrevision blockiert einen manuellen Zitatsend vor dem Transport", async ({
  page,
}) => {
  await open(page);
  await composer(page).fill("Bestehender lokaler Entwurf");
  await page.evaluate(
    () => (Reflect.get(window, "__qaZammad").connection.revision = "1"),
  );
  await page
    .getByRole("button", { name: "Als interne Notiz zitieren" })
    .first()
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Zammad-Verbindung wurde gewechselt",
  );
  await expect(
    page.getByRole("button", { name: "In internen Entwurf übernehmen" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(composer(page)).toHaveValue("Bestehender lokaler Entwurf");
  await page.evaluate(
    () => (Reflect.get(window, "__qaZammad").connection.revision = "0"),
  );
  await prepare(page);
  await page
    .getByRole("button", { name: "In internen Entwurf übernehmen" })
    .click();
  const body = await composer(page).inputValue();
  await page.evaluate(
    () => (Reflect.get(window, "__qaZammad").connection.revision = "1"),
  );
  await page
    .getByRole("button", { name: "Intern kommentieren", exact: true })
    .click();
  await expect(
    page.getByText(
      "Zammad-Verbindung wurde gewechselt. Es wurde keine Anfrage gesendet.",
    ),
  ).toBeVisible();
  await expect(composer(page)).toHaveValue(body);
  expect(await writes(page)).toEqual([]);
});

test("390px: Tastatur, gekürzte Quelle, unbekannte Metadaten und sichere Leerzustände", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() =>
    Object.defineProperty(window, "__qaZammad", {
      configurable: true,
      set(state) {
        state.articles[0].body = "Ein langer Quelltext. ".repeat(150);
        state.articles[0].content_type = "text/plain";
        state.articles[0].from = "";
        state.articles[0].created_at = "";
        state.articles[1].body = '{"type":"doc"}';
        state.articles[1].content_type = "application/json";
        Object.defineProperty(window, "__qaZammad", {
          value: state,
          writable: true,
        });
      },
    }),
  );
  await open(page);
  const action = page
    .getByRole("button", { name: "Als interne Notiz zitieren" })
    .first();
  await action.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toContainText("Autor unbekannt");
  await expect(page.getByRole("dialog")).toContainText("Quellzeit unbekannt");
  await expect(page.getByRole("dialog")).toContainText(
    "Auf die ersten 2.000 Zeichen begrenzt.",
  );
  const insert = page.getByRole("button", {
    name: "In internen Entwurf übernehmen",
  });
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Geprüfter Quelltext")).toBeFocused();
  await page.keyboard.press("PageDown");
  await expect
    .poll(() =>
      page.getByLabel("Geprüfter Quelltext").evaluate((node) => node.scrollTop),
    )
    .toBeGreaterThan(0);
  await page.keyboard.press("Tab");
  await expect(insert).toBeFocused();
  await page.screenshot({
    path: info.outputPath("source-quote-390.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Enter");
  await expect(composer(page)).toHaveValue(
    /Autor unbekannt · Quellzeit unbekannt/,
  );
  await expect(composer(page)).toHaveValue(/auf 2.000 Zeichen gekürzt/);
  await page
    .getByRole("button", { name: "Als interne Notiz zitieren" })
    .nth(1)
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "keinen sicher übernehmbaren Text",
  );
  await expect(insert).toBeDisabled();
  expect(await writes(page)).toEqual([]);
});

const hook = async (page: Page) => {
  await page.goto(
    "/tests/browser/source-quote-hook-fixture.html?scenario=zammad",
  );
  await expect(page.getByTestId("model")).toContainText('"ready":true');
};

test("Lange belegte Autorennamen bleiben bei 390px lesbar", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() =>
    Object.defineProperty(window, "__qaZammad", {
      configurable: true,
      set(state) {
        state.articles[0].from =
          "Kundendienst_" + "SehrLangerQuellname".repeat(15);
        Object.defineProperty(window, "__qaZammad", {
          value: state,
          writable: true,
        });
      },
    }),
  );
  await open(page);
  await prepare(page);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Kundendienst_SehrLangerQuellname");
  expect(
    await dialog.evaluate((node) =>
      [...node.querySelectorAll<HTMLElement>("*")]
        .filter(
          (element) =>
            element.clientWidth > 0 &&
            element.scrollWidth > element.clientWidth + 1,
        )
        .map((element) => element.tagName),
    ),
  ).toEqual([]);
  await page.screenshot({
    path: info.outputPath("source-quote-long-author-390.png"),
    fullPage: true,
  });
  expect(await writes(page)).toEqual([]);
});

test("Unbekanntes Konto sperrt die Zitataktion und erhält den bisherigen manuellen Notizweg", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "__qaZammad", {
      configurable: true,
      set(state) {
        state.denied = ["/users/me"];
        Object.defineProperty(window, "__qaZammad", {
          value: state,
          writable: true,
        });
      },
    }),
  );
  await page.goto(
    "/tests/browser/fixture.html?scenario=zammad&route=/helpdesk/41",
  );
  await expect(
    page.getByRole("button", { name: "Als interne Notiz zitieren" }).first(),
  ).toBeDisabled();
  await composer(page).fill("Manuell erstellte interne Notiz");
  await expect(composer(page)).toHaveValue("Manuell erstellte interne Notiz");
  await page
    .getByRole("button", { name: "Intern kommentieren", exact: true })
    .click();
  await expect(composer(page)).toHaveValue("");
  expect((await writes(page))[0].body).toMatchObject({
    body: "Manuell erstellte interne Notiz",
    internal: true,
    type: "note",
  });
});
const quoteReady = async (page: Page) => {
  await page.evaluate(() =>
    (Reflect.get(window, "__quoteQa") as QuoteQa).model!.quote.open(11),
  );
  await expect(page.getByTestId("model")).toContainText(
    '"preview":"Seit heute',
  );
};

test("HTML-Serializer trennt Absätze/Tabellen und lässt Medien, Skripte, verborgenen Text und Linkziele weg", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Profilunabhängiger Serializervertrag",
  );
  await hook(page);
  const text = await page.evaluate(() =>
    (Reflect.get(window, "__quoteQa") as QuoteQa).text({
      content_type: "text/html",
      body: '<p>A &amp; B<br>Zwei</p><table><tr><td>C</td><td>D</td></tr></table><a href="https://secret.invalid">sichtbarer Link</a><img src="https://tracker.invalid" alt="unsichtbares Medium"><script>secret()</script><p hidden>verborgen</p><p style="display:none">auch verborgen</p><iframe src="https://frame.invalid">fremd</iframe>',
    }),
  );
  expect(text).toBe("A & B\nZwei\n\nC\tD\n\nsichtbarer Link");
});

for (const change of [
  "account",
  "host",
  "issue",
  "A-B-A",
  "unmount",
  "source",
  "source-A-B-A",
] as const) {
  test(`Alte Quellen-/Editorcallbacks nach ${change} dürfen weder einfügen noch senden`, async ({
    page,
  }, info) => {
    test.skip(
      info.project.name !== "desktop",
      "Profilunabhängiger Hook-/Lifecyclevertrag",
    );
    await hook(page);
    await quoteReady(page);
    await page.evaluate(() => {
      const qa = Reflect.get(window, "__quoteQa") as QuoteQa;
      qa.old = qa.model;
    });
    await page.evaluate((change) => {
      const qa = Reflect.get(window, "__quoteQa") as QuoteQa;
      if (change === "account") qa.scope("https://helpdesk.example.com", 8);
      if (change === "host") qa.scope("https://other.example.com", 3);
      if (change === "issue" || change === "A-B-A") qa.change!("42");
      if (change === "unmount") qa.change!("41", false);
      if (change === "source" || change === "source-A-B-A")
        qa.source(11, "Inzwischen bearbeitete Quelle");
    }, change);
    if (change === "unmount")
      await expect(page.getByTestId("unmounted")).toBeVisible();
    else
      await expect(page.getByTestId("model")).not.toContainText(
        '"preview":"Seit heute',
      );
    if (change === "A-B-A") {
      await page.evaluate(() =>
        (Reflect.get(window, "__quoteQa") as QuoteQa).change!("41"),
      );
      await expect(page.getByTestId("model")).toContainText('"id":41');
    }
    if (change === "source-A-B-A") {
      await page.evaluate(() => {
        const qa = Reflect.get(window, "__quoteQa") as QuoteQa;
        qa.source(11, qa.old!.articles[0].body);
      });
      await expect(page.getByTestId("model")).not.toContainText(
        '"preview":"Seit heute',
      );
    }
    const before = await page.evaluate(
      () => Reflect.get(window, "__qaZammad").requests.length,
    );
    await page.evaluate(() => {
      const qa = Reflect.get(window, "__quoteQa") as QuoteQa;
      qa.old!.quote.insert();
      qa.old!.quote.open(12);
      qa.submit(qa.old!);
    });
    expect(await writes(page)).toEqual([]);
    expect(
      await page.evaluate(
        () => Reflect.get(window, "__qaZammad").requests.length,
      ),
    ).toBe(before);
    if (change !== "unmount")
      await expect(page.getByTestId("model")).toContainText('"body":""');
  });
}

for (const boundary of [
  "account",
  "host",
  "issue",
  "A-B-A",
  "unmount",
] as const) {
  test(`Übernommener interner Entwurf bleibt bei ${boundary} von alten Sendecallbacks getrennt`, async ({
    page,
  }, info) => {
    test.skip(
      info.project.name !== "desktop",
      "Profilunabhängiger übernommener Draftvertrag",
    );
    await hook(page);
    await quoteReady(page);
    await page.evaluate(() =>
      (Reflect.get(window, "__quoteQa") as QuoteQa).model!.quote.insert(),
    );
    await expect(page.getByTestId("model")).toContainText('"active":true');
    await page.evaluate(() => {
      const qa = Reflect.get(window, "__quoteQa") as QuoteQa;
      qa.old = qa.model;
    });
    await page.evaluate((boundary) => {
      const qa = Reflect.get(window, "__quoteQa") as QuoteQa;
      if (boundary === "account") qa.scope("https://helpdesk.example.com", 8);
      if (boundary === "host") qa.scope("https://other.example.com", 3);
      if (boundary === "issue" || boundary === "A-B-A") qa.change!("42");
      if (boundary === "unmount") qa.change!("41", false);
    }, boundary);
    if (boundary === "unmount")
      await expect(page.getByTestId("unmounted")).toBeVisible();
    else
      await expect(page.getByTestId("model")).toContainText('"active":false');
    if (boundary === "A-B-A") {
      await page.evaluate(() =>
        (Reflect.get(window, "__quoteQa") as QuoteQa).change!("41"),
      );
      await expect(page.getByTestId("model")).toContainText('"id":41');
    }
    await page.evaluate(() => {
      const qa = Reflect.get(window, "__quoteQa") as QuoteQa;
      qa.old!.setBody("Veralteter fremder Text");
      qa.old!.quote.resume();
      qa.submit(qa.old!);
    });
    expect(await writes(page)).toEqual([]);
    if (boundary !== "unmount") {
      await expect(page.getByTestId("model")).toContainText('"body":""');
      if (boundary === "A-B-A") {
        await page.evaluate(() =>
          (Reflect.get(window, "__quoteQa") as QuoteQa).model!.quote.resume(),
        );
        await expect(page.getByTestId("model")).toContainText(
          "Zitat von Sam Kunde",
        );
        await expect(page.getByTestId("model")).not.toContainText(
          "Veralteter fremder Text",
        );
      }
    }
  });
}

test("Späte Quellantwort nach Kontowechsel bleibt verworfen", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Profilunabhängiger Transportvertrag",
  );
  await hook(page);
  await page.evaluate(() => {
    Reflect.get(window, "__qaZammad").delay = 250;
    (Reflect.get(window, "__quoteQa") as QuoteQa).model!.quote.open(11);
  });
  await expect(page.getByTestId("model")).toContainText('"selected":11');
  await page.evaluate(() =>
    (Reflect.get(window, "__quoteQa") as QuoteQa).scope(
      "https://helpdesk.example.com",
      8,
    ),
  );
  await page.waitForTimeout(350);
  await expect(page.getByTestId("model")).not.toContainText(
    '"preview":"Seit heute',
  );
  await expect(page.getByTestId("model")).toContainText('"body":""');
  expect(await writes(page)).toEqual([]);
});

test("Neuer Entwurf überlebt alte Completion; Upload nach Editorwechsel sendet nicht", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Profilunabhängiger Draft-/Mutationsvertrag",
  );
  await hook(page);
  await quoteReady(page);
  await page.evaluate(() =>
    (Reflect.get(window, "__quoteQa") as QuoteQa).model!.quote.insert(),
  );
  await expect(page.getByTestId("model")).toContainText('"active":true');
  await page.evaluate(() => {
    const qa = Reflect.get(window, "__quoteQa") as QuoteQa;
    qa.old = qa.model;
    qa.model!.setBody(`${qa.model!.body}Neue Eingabe`);
  });
  await expect(page.getByTestId("model")).toContainText("Neue Eingabe");
  await page.evaluate(() =>
    (Reflect.get(window, "__quoteQa") as QuoteQa).old!.quote.complete(),
  );
  await expect(page.getByTestId("model")).toContainText("Neue Eingabe");
  await page.evaluate(() => {
    const qa = Reflect.get(window, "__quoteQa") as QuoteQa;
    const current = qa.model!;
    const body = current.body;
    current.setBody(`${body}Vorübergehende Eingabe`);
    current.setBody(body);
    current.quote.complete();
  });
  await expect(page.getByTestId("model")).toContainText("Neue Eingabe");
  await page.evaluate(() => {
    const qa = Reflect.get(window, "__quoteQa") as QuoteQa;
    const files = new DataTransfer();
    const file = new File(["attachment"], "test.txt");
    file.arrayBuffer = async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return new ArrayBuffer(0);
    };
    files.items.add(file);
    qa.model!.onFiles(files.files);
  });
  await page.evaluate(() => {
    const qa = Reflect.get(window, "__quoteQa") as QuoteQa;
    qa.submit(qa.model!);
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => (Reflect.get(window, "__quoteQa") as QuoteQa).model!.sending,
      ),
    )
    .toBe(true);
  await page.evaluate(() =>
    (Reflect.get(window, "__quoteQa") as QuoteQa).model!.quote.leave(),
  );
  await expect
    .poll(() =>
      page.evaluate(
        () => (Reflect.get(window, "__quoteQa") as QuoteQa).model!.sending,
      ),
    )
    .toBe(false);
  expect(await writes(page)).toEqual([]);
  await page.evaluate(() =>
    (Reflect.get(window, "__quoteQa") as QuoteQa).model!.quote.resume(),
  );
  await expect(page.getByTestId("model")).toContainText("Neue Eingabe");
});

test("Alter öffentlicher Sendecallback kann nach bewusster Zitatübernahme keinen Quelltext senden", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Profilunabhängiger Editorvertrag",
  );
  await hook(page);
  await page.evaluate(() => {
    const qa = Reflect.get(window, "__quoteQa") as QuoteQa;
    qa.model!.setKind("public");
    qa.model!.setBody("Ursprünglicher öffentlicher Entwurf");
  });
  await expect(page.getByTestId("model")).toContainText(
    "Ursprünglicher öffentlicher Entwurf",
  );
  await page.evaluate(() => {
    const qa = Reflect.get(window, "__quoteQa") as QuoteQa;
    qa.old = qa.model;
  });
  await quoteReady(page);
  await page.evaluate(() =>
    (Reflect.get(window, "__quoteQa") as QuoteQa).model!.quote.insert(),
  );
  await expect(page.getByTestId("model")).toContainText('"active":true');
  await page.evaluate(() => {
    const qa = Reflect.get(window, "__quoteQa") as QuoteQa;
    qa.submit({ ...qa.old!, body: qa.model!.body });
    qa.old!.setBody("Veraltete Eingabe");
    qa.old!.setKind("email");
    qa.old!.setCc("anderes-konto@example.com");
    qa.old!.setRecipient("falscher-kunde@example.com");
  });
  expect(await writes(page)).toEqual([]);
  await expect(page.getByTestId("model")).toContainText("Zitat von Sam Kunde");
  await page.evaluate(() =>
    (Reflect.get(window, "__quoteQa") as QuoteQa).model!.quote.leave(),
  );
  await expect(page.getByTestId("model")).toContainText(
    "Ursprünglicher öffentlicher Entwurf",
  );
  expect(
    await page.evaluate(
      () => (Reflect.get(window, "__quoteQa") as QuoteQa).model!.cc,
    ),
  ).toBe("");
});
