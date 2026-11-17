import { expect, test, type Page } from "@playwright/test";
import type { MultiLinkQa } from "./multi-link-hook-fixture";
type LinkInput = {
  inwardIssue: { key: string };
  outwardIssue: { key: string };
};
const writes = (page: Page) =>
  page.evaluate(() =>
    Reflect.get(window, "__qa").writes.filter(
      (row: { path: string }) => row.path === "/issueLink",
    ),
  );
const popup = (page: Page) =>
  page.getByRole("dialog", { name: "Mehrere Tickets verknüpfen", exact: true });
const open = async (page: Page, direction = "blocks · outward") => {
  await page.goto(
    "/tests/browser/fixture.html?scenario=multi-links&route=/issue/DEMO-4",
  );
  await page
    .getByRole("button", { name: "Mehrere Tickets verknüpfen", exact: true })
    .click();
  await popup(page).getByRole("combobox").click();
  await page.getByRole("option", { name: direction, exact: true }).click();
};
const preview = async (page: Page, input = "demo-2; DEMO-3") => {
  await popup(page).getByLabel("Explizite Zielkeys").fill(input);
  await popup(page)
    .getByRole("button", { name: "Vorschau prüfen", exact: true })
    .click();
  await expect(
    popup(page).getByRole("button", {
      name: "Geprüfte Verknüpfungen bestätigen",
    }),
  ).toBeEnabled();
};

test("Explizite Vorschau schreibt nicht; Doppelaktivierung sendet genau einen outward-Link je Ziel", async ({
  page,
}) => {
  await open(page);
  await preview(page);
  await expect(popup(page)).toContainText("DEMO-4 blocks … (outward)");
  await expect(popup(page).getByLabel("Geprüfte Zielmenge")).toContainText(
    "DEMO-2",
  );
  expect(await writes(page)).toEqual([]);
  await popup(page).getByLabel("Explizite Zielkeys").press("Control+Enter");
  expect(await writes(page)).toEqual([]);
  await popup(page)
    .getByRole("button", { name: "Geprüfte Verknüpfungen bestätigen" })
    .evaluate((button) => {
      if (button instanceof HTMLButtonElement) {
        button.click();
        button.click();
      }
    });
  await expect(popup(page).getByRole("status")).toContainText("2 Bestätigt");
  const posts = await writes(page);
  expect(posts.map((row: { input: unknown }) => row.input)).toEqual([
    {
      type: { id: "10000" },
      inwardIssue: { key: "DEMO-4" },
      outwardIssue: { key: "DEMO-2" },
    },
    {
      type: { id: "10000" },
      inwardIssue: { key: "DEMO-4" },
      outwardIssue: { key: "DEMO-3" },
    },
  ]);
  await popup(page)
    .getByRole("button", { name: "Vorschau prüfen", exact: true })
    .click();
  await expect(popup(page)).toContainText("0 von 2 Zielen");
  await expect(
    popup(page).getByRole("button", {
      name: "Geprüfte Verknüpfungen bestätigen",
    }),
  ).toBeDisabled();
  expect(await writes(page)).toHaveLength(2);
});

test("Inward stammt aus Metadaten und erzeugt einen einzelnen korrekt gerichteten API-Payload", async ({
  page,
}) => {
  await open(page, "is blocked by · inward");
  await preview(page, "DEMO-2");
  await popup(page)
    .getByRole("button", { name: "Geprüfte Verknüpfungen bestätigen" })
    .click();
  await expect(popup(page).getByRole("status")).toContainText("1 Bestätigt");
  expect((await writes(page))[0].input).toEqual({
    type: { id: "10000" },
    inwardIssue: { key: "DEMO-2" },
    outwardIssue: { key: "DEMO-4" },
  });
  expect(await writes(page)).toHaveLength(1);
});

test("Selbstbezug, Duplikate und Mengenlimit bleiben vor der Vorschau; Eingabeänderung entfernt alte Freigabe", async ({
  page,
}) => {
  await open(page);
  const input = popup(page).getByLabel("Explizite Zielkeys");
  for (const [value, error] of [
    ["DEMO-4", "selbst"],
    ["demo-2 DEMO-2", "doppelt"],
    [
      Array.from({ length: 21 }, (_, i) => `X-${i + 1}`).join(" "),
      "Maximal 20",
    ],
    ["https://example.atlassian.net/browse/DEMO-2", "Nur Ticket-Keys"],
  ]) {
    await input.fill(value!);
    await expect(popup(page).getByRole("alert")).toContainText(error!);
    await expect(
      popup(page).getByRole("button", { name: "Vorschau prüfen" }),
    ).toBeDisabled();
  }
  await preview(page, "DEMO-2");
  await input.fill("DEMO-3");
  await expect(
    popup(page).getByRole("button", {
      name: "Geprüfte Verknüpfungen bestätigen",
    }),
  ).toHaveCount(0);
  expect(await writes(page)).toEqual([]);
});

test("Teilergebnisse und unklarer Ausgang bleiben ehrlich; nur abgelehntes Ziel kann nach neuer Vorschau bestätigt werden", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() =>
    Reflect.set(window, "__qaMultiLinkWriteRule", async (input: LinkInput) => {
      await new Promise((resolve) => setTimeout(resolve, 40));
      if (input.outwardIssue.key === "DEMO-3") return { status: 403, body: {} };
      if (input.outwardIssue.key === "DEMO-5")
        throw new Error("Synthetisch: Antwort verloren");
    }),
  );
  await preview(page, "DEMO-2 DEMO-3 DEMO-5");
  await popup(page)
    .getByRole("button", { name: "Geprüfte Verknüpfungen bestätigen" })
    .click();
  await expect(popup(page).getByRole("status")).toContainText(
    "1 Bestätigt · 1 Abgelehnt · 1 Unklar",
  );
  expect(await writes(page)).toHaveLength(3);
  await page.evaluate(() =>
    Reflect.set(window, "__qaMultiLinkWriteRule", undefined),
  );
  await popup(page)
    .getByRole("button", { name: "Vorschau prüfen", exact: true })
    .click();
  await expect(popup(page)).toContainText("1 von 3 Zielen");
  await expect(popup(page)).toContainText("Früherer Ausgang unklar");
  await popup(page)
    .getByRole("button", { name: "Geprüfte Verknüpfungen bestätigen" })
    .click();
  await expect(popup(page).getByRole("status")).toContainText("1 Bestätigt");
  const posts = await writes(page);
  expect(posts).toHaveLength(4);
  expect(
    posts.filter(
      (row: { input: LinkInput }) => row.input.outwardIssue.key === "DEMO-5",
    ),
  ).toHaveLength(1);
});

test("Abbruch hält neue Abgaben zurück; die zwei laufenden Antworten bleiben als bestätigt sichtbar", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() =>
    Reflect.set(window, "__qaMultiLinkWriteRule", async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    }),
  );
  await preview(page, "DEMO-1 DEMO-2 DEMO-3 DEMO-5 DEMO-6");
  await popup(page)
    .getByRole("button", { name: "Geprüfte Verknüpfungen bestätigen" })
    .click();
  await expect.poll(() => writes(page).then((rows) => rows.length)).toBe(2);
  await popup(page)
    .getByRole("button", { name: "Weitere Abgaben stoppen" })
    .click();
  await expect(popup(page).getByRole("status")).toContainText(
    "2 Bestätigt · 0 Abgelehnt · 0 Unklar · 3 Nicht begonnen",
  );
  expect(await writes(page)).toHaveLength(2);
});

test("390px: Auswahl und Freigabe per Tastatur, fünf/alle Ziele, Hell/Dunkel ohne Überlauf", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    "/tests/browser/fixture.html?scenario=multi-links&route=/issue/DEMO-4",
  );
  const trigger = page.getByRole("button", {
    name: "Mehrere Tickets verknüpfen",
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await popup(page).getByRole("combobox").focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await preview(page, "DEMO-1 DEMO-2 DEMO-3 DEMO-5 DEMO-6 DEMO-7");
  await expect(
    popup(page).getByLabel("Geprüfte Zielmenge").getByRole("listitem"),
  ).toHaveCount(5);
  const all = popup(page).getByRole("button", { name: "Alle Ziele anzeigen" });
  await expect(all).toHaveAttribute("aria-expanded", "false");
  await all.focus();
  await page.keyboard.press("Enter");
  await expect(
    popup(page).getByLabel("Geprüfte Zielmenge").getByRole("listitem"),
  ).toHaveCount(6);
  expect(
    await popup(page).evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("multi-links-390.png"),
    fullPage: true,
  });
  expect(await writes(page)).toEqual([]);
  await popup(page)
    .getByRole("button", { name: "Geprüfte Verknüpfungen bestätigen" })
    .focus();
  await page.keyboard.press("Enter");
  await expect(popup(page).getByRole("status")).toContainText("6 Bestätigt");
});

const openHook = async (page: Page) => {
  await page.goto(
    "/tests/browser/multi-link-hook-fixture.html?scenario=multi-links",
  );
  await page.evaluate(() =>
    (Reflect.get(window, "__multiLinkQa") as MultiLinkQa).state!.setOpen(true),
  );
  await expect(page.getByTestId("state")).toContainText("10000:outward");
  await page.evaluate(() =>
    (Reflect.get(window, "__multiLinkQa") as MultiLinkQa).state!.setChoice(
      "10000:outward",
    ),
  );
  await expect(page.getByTestId("state")).toContainText(
    '"choiceId":"10000:outward"',
  );
  await page.evaluate(() =>
    (Reflect.get(window, "__multiLinkQa") as MultiLinkQa).state!.setInput(
      "DEMO-2 DEMO-3 DEMO-5 DEMO-6",
    ),
  );
  await expect(page.getByTestId("state")).toContainText('"ready":true');
};

test("Geöffnete Vorschau bleibt nach Viewportwechsel vollständig im Bild", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page, "is blocked by · inward");
  await preview(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(
      () =>
        popup(page).evaluate((node) => {
          const box = node.getBoundingClientRect();
          return box.top >= 15 && box.bottom <= innerHeight - 15;
        }),
      { timeout: 2000 },
    )
    .toBe(true);
  expect(await writes(page)).toEqual([]);
});

test("Veränderte Metadaten halten alle Abgaben zurück; Typen lassen sich bewusst neu laden", async ({
  page,
}) => {
  await open(page);
  await preview(page, "DEMO-2");
  await page.evaluate(() =>
    Reflect.set(window, "__qaLinkTypes", [
      {
        id: "10000",
        name: "Blocks",
        inward: "is blocked by",
        outward: "blocks v2",
      },
    ]),
  );
  await popup(page)
    .getByRole("button", { name: "Geprüfte Verknüpfungen bestätigen" })
    .click();
  await expect(popup(page).getByRole("status")).toContainText(
    "1 Nicht begonnen",
  );
  expect(await writes(page)).toEqual([]);
  await popup(page)
    .getByRole("button", { name: "Typen neu laden", exact: true })
    .click();
  await expect(popup(page).getByRole("combobox")).toContainText("blocks v2");
  await expect(
    popup(page).getByRole("button", {
      name: "Geprüfte Verknüpfungen bestätigen",
    }),
  ).toHaveCount(0);
  await popup(page)
    .getByRole("button", { name: "Vorschau prüfen", exact: true })
    .click();
  await expect(popup(page)).toContainText("DEMO-4 blocks v2 … (outward)");
  await popup(page)
    .getByRole("button", { name: "Geprüfte Verknüpfungen bestätigen" })
    .click();
  await expect(popup(page).getByRole("status")).toContainText("1 Bestätigt");
  expect(await writes(page)).toHaveLength(1);
});

test("Unbekanntes Konto und alter Metadaten-Retry dürfen keine neue Abgabe oder versteckte Reads auslösen", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Profilunabhängiger unbekannter Scopevertrag",
  );
  await openHook(page);
  await page.evaluate(() =>
    (Reflect.get(window, "__multiLinkQa") as MultiLinkQa).scope("qa-cloud", ""),
  );
  await expect(page.getByTestId("state")).toContainText(
    "Jira-Konto noch nicht bestätigt",
  );
  await page.evaluate(() => {
    const qa = Reflect.get(window, "__multiLinkQa") as MultiLinkQa;
    qa.old = qa.state;
    qa.scope("qa-cloud", "qa-user");
  });
  await expect(page.getByTestId("state")).not.toContainText(
    "Jira-Konto noch nicht bestätigt",
  );
  const before = await page.evaluate(
    () => Reflect.get(window, "__qa").reads.length,
  );
  await page.evaluate(() => {
    const qa = Reflect.get(window, "__multiLinkQa") as MultiLinkQa;
    qa.old!.retryMetadata();
    qa.old!.confirm();
  });
  expect(await writes(page)).toEqual([]);
  expect(
    await page.evaluate(() => Reflect.get(window, "__qa").reads.length),
  ).toBe(before);
});
const hookPreview = async (page: Page) => {
  await page.evaluate(() =>
    (
      Reflect.get(window, "__multiLinkQa") as MultiLinkQa
    ).state!.requestPreview(),
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (Reflect.get(window, "__multiLinkQa") as MultiLinkQa).state!
            .canConfirm,
      ),
    )
    .toBe(true);
};

for (const boundary of [
  "account",
  "host",
  "issue",
  "A-B-A",
  "input-A-B-A",
  "type-A-B-A",
  "close-reopen",
  "unmount",
] as const) {
  test(`Vorschau und alte Bestätigung bleiben nach ${boundary} ungültig`, async ({
    page,
  }, info) => {
    test.skip(
      info.project.name !== "desktop",
      "Profilunabhängiger Scope-/Hookvertrag",
    );
    await openHook(page);
    await hookPreview(page);
    await page.evaluate(() => {
      const qa = Reflect.get(window, "__multiLinkQa") as MultiLinkQa;
      qa.old = qa.state;
    });
    await page.evaluate((boundary) => {
      const qa = Reflect.get(window, "__multiLinkQa") as MultiLinkQa;
      if (boundary === "account") qa.scope("qa-cloud", "other-user");
      if (boundary === "host")
        qa.scope("qa-cloud", "qa-user", "https://other.example.atlassian.net");
      if (boundary === "issue" || boundary === "A-B-A") qa.change!("DEMO-3");
      if (boundary === "input-A-B-A") qa.state!.setInput("DEMO-7");
      if (boundary === "type-A-B-A") qa.state!.setChoice("10000:inward");
      if (boundary === "close-reopen") qa.state!.setOpen(false);
      if (boundary === "unmount") qa.change!("DEMO-4", false);
    }, boundary);
    if (boundary === "unmount")
      await expect(page.getByTestId("unmounted")).toBeVisible();
    else
      await expect(page.getByTestId("state")).toContainText('"preview":null');
    await page.evaluate((boundary) => {
      const qa = Reflect.get(window, "__multiLinkQa") as MultiLinkQa;
      if (boundary === "A-B-A") qa.change!("DEMO-4");
      if (boundary === "input-A-B-A")
        qa.state!.setInput("DEMO-2 DEMO-3 DEMO-5 DEMO-6");
      if (boundary === "type-A-B-A") qa.state!.setChoice("10000:outward");
      if (boundary === "close-reopen") qa.state!.setOpen(true);
    }, boundary);
    if (boundary !== "unmount")
      await expect(page.getByTestId("state")).toContainText('"preview":null');
    const before = await page.evaluate(
      () => Reflect.get(window, "__qa").reads.length,
    );
    await page.evaluate(() => {
      const qa = Reflect.get(window, "__multiLinkQa") as MultiLinkQa;
      qa.old!.confirm();
      qa.old!.requestPreview();
      qa.old!.setInput("DEMO-8");
    });
    expect(await writes(page)).toEqual([]);
    expect(
      await page.evaluate(() => Reflect.get(window, "__qa").reads.length),
    ).toBe(before);
    if (boundary !== "unmount")
      await expect(page.getByTestId("state")).not.toContainText(
        '"input":"DEMO-8"',
      );
  });
}

test("Verspätete Vorschau nach Kontowechsel erzeugt keine Freigabe", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop",
    "Profilunabhängiger Transportvertrag",
  );
  await openHook(page);
  await page.evaluate(() =>
    Reflect.set(window, "__qaIssueLinksRule", () => ({ delayMs: 250 })),
  );
  await page.evaluate(() =>
    (
      Reflect.get(window, "__multiLinkQa") as MultiLinkQa
    ).state!.requestPreview(),
  );
  await expect(page.getByTestId("state")).toContainText('"pending":true');
  await page.evaluate(() =>
    (Reflect.get(window, "__multiLinkQa") as MultiLinkQa).scope(
      "qa-cloud",
      "other-user",
    ),
  );
  await expect(page.getByTestId("state")).toContainText('"pending":false');
  await expect(page.getByTestId("state")).toContainText('"preview":null');
  expect(await writes(page)).toEqual([]);
});

for (const boundary of ["issue", "account", "unmount"] as const) {
  test(`Laufende Antworten nach ${boundary} starten keine neuen Links und überschreiben keine neue Sicht`, async ({
    page,
  }, info) => {
    test.skip(
      info.project.name !== "desktop",
      "Profilunabhängiger laufender Writevertrag",
    );
    await openHook(page);
    await hookPreview(page);
    await page.evaluate(() =>
      Reflect.set(window, "__qaMultiLinkWriteRule", async () => {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }),
    );
    await page.evaluate(() =>
      (Reflect.get(window, "__multiLinkQa") as MultiLinkQa).state!.confirm(),
    );
    await expect.poll(() => writes(page).then((rows) => rows.length)).toBe(2);
    await page.evaluate((boundary) => {
      const qa = Reflect.get(window, "__multiLinkQa") as MultiLinkQa;
      if (boundary === "account") qa.scope("qa-cloud", "other-user");
      else qa.change!("DEMO-3", boundary !== "unmount");
    }, boundary);
    await page.waitForTimeout(350);
    expect(await writes(page)).toHaveLength(2);
    if (boundary !== "unmount") {
      await expect(page.getByTestId("state")).toContainText('"results":[]');
      await expect(page.getByTestId("state")).toContainText('"preview":null');
    } else await expect(page.getByTestId("unmounted")).toBeVisible();
  });
}

test("20 Ziele mit langem Typ: Geltungsbereich und Hauptaktion bleiben sichtbar, Stop und Teilergebnisse per Tastatur", async ({
  page,
}) => {
  const long = "wartet auf eine sehr lange externe Abhängigkeit mit mehrstufigem Freigabeprozess";
  await page.addInitScript((outward) => {
    Reflect.set(window, "__qaLinkTypes", [
      { id: "10000", name: "Blocks", inward: "is blocked by", outward: "blocks" },
      { id: "10077", name: "Long", inward: "wird blockiert von", outward },
    ]);
  }, long);
  await page.goto(
    "/tests/browser/fixture.html?scenario=multi-links&route=/issue/DEMO-4",
  );
  const trigger = page.getByRole("button", { name: "Mehrere Tickets verknüpfen", exact: true });
  await trigger.evaluate((node) => node.scrollIntoView({ block: "center" }));
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(popup(page)).toBeVisible();
  expect(await popup(page).evaluate((node) => node.contains(document.activeElement))).toBe(true);
  await popup(page).getByRole("combobox").click();
  await page.getByRole("option", { name: `${long} · outward`, exact: true }).click();
  const targets = Array.from({ length: 21 }, (_, index) => `DEMO-${index + 1}`).filter((key) => key !== "DEMO-4");
  await popup(page).getByLabel("Explizite Zielkeys").fill(targets.join("\n"));
  await popup(page).getByRole("button", { name: "Vorschau prüfen", exact: true }).click();
  const confirm = popup(page).getByRole("button", { name: "Geprüfte Verknüpfungen bestätigen" });
  await expect(confirm).toBeEnabled();
  await expect(popup(page)).toContainText(`DEMO-4 ${long} … (outward)`);
  await expect(popup(page)).toContainText("Nur gelesen");
  expect(await writes(page)).toEqual([]);
  const list = popup(page).getByLabel("Geprüfte Zielmenge").getByRole("listitem");
  await expect(list).toHaveCount(5);
  const all = popup(page).getByRole("button", { name: "Alle Ziele anzeigen (20)" });
  await all.focus();
  await page.keyboard.press("Space");
  await expect(list).toHaveCount(20);
  await expect(popup(page).getByRole("button", { name: "Weniger anzeigen" })).toHaveAttribute("aria-expanded", "true");
  const inView = (locator: ReturnType<typeof popup>) =>
    locator.evaluate((node) => {
      const box = node.getBoundingClientRect();
      return box.top >= 0 && box.bottom <= innerHeight && box.left >= 0 && box.right <= innerWidth;
    });
  const scope = popup(page).locator("dl").filter({ hasText: "Quelle" });
  expect(await inView(scope)).toBe(true);
  expect(await inView(confirm)).toBe(true);
  expect(
    await popup(page).evaluate((node) =>
      [node, ...node.querySelectorAll("*")]
        .filter(
          (child) =>
            child.clientWidth > 0 &&
            child.scrollWidth > child.clientWidth + 1 &&
            getComputedStyle(child).textOverflow !== "ellipsis",
        )
        .map((child) => child.outerHTML.slice(0, 80)),
    ),
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.evaluate(() => {
    let calls = 0;
    Reflect.set(window, "__qaMultiLinkWriteRule", async () => {
      calls += 1;
      const call = calls;
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (call === 1) return { status: 403, body: {} };
      if (call === 2) throw new Error("Synthetisch: Antwort verloren");
    });
  });
  await confirm.focus();
  await page.keyboard.press("Enter");
  const stop = popup(page).getByRole("button", { name: "Weitere Abgaben stoppen" });
  await expect(stop).toBeVisible();
  expect(await inView(stop)).toBe(true);
  await expect(popup(page)).toContainText("lassen sich nicht zurückrufen");
  await expect.poll(() => writes(page).then((rows) => rows.length)).toBeGreaterThanOrEqual(3);
  await stop.focus();
  await page.keyboard.press("Enter");
  await expect(popup(page).getByRole("status")).toContainText("Nicht begonnen");
  await expect(popup(page).getByRole("status")).toContainText("1 Abgelehnt");
  await expect(popup(page).getByRole("status")).toContainText("1 Unklar");
  const sent = (await writes(page)).length;
  expect(sent).toBeLessThan(11);
  await expect(popup(page).getByRole("alert")).toContainText("nicht zurückgerufen");
  expect(await inView(scope)).toBe(true);
  expect(await inView(confirm)).toBe(true);
  await expect(confirm).toBeDisabled();
  await expect(confirm).toBeFocused();
  await page.waitForTimeout(600);
  expect(await writes(page)).toHaveLength(sent);
  await page.keyboard.press("Escape");
  await expect(popup(page)).toHaveCount(0);
  await expect(trigger).toBeFocused();
});
