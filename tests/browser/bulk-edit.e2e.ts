import { expect, test } from "@playwright/test";

const table = "/tests/browser/fixture.html?route=/bereiche/DEMO";

test("Sammeländerung erhält andere Labels und wiederholt nur Teilausfälle", async ({
  page,
}) => {
  await page.goto(table);
  await expect(
    page.getByRole("cell", { name: "DEMO-1", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    const qa = window as unknown as {
      __qa: { issues: { fields: { labels: string[] } }[] };
      __qaBulkWriteRule?: (path: string) => unknown;
    };
    qa.__qa.issues[0]!.fields.labels = ["bestehend"];
    let failed = false;
    qa.__qaBulkWriteRule = (path) => {
      if (path === "/issue/DEMO-2" && !failed) {
        failed = true;
        return {
          status: 403,
          body: { errorMessages: ["Keine Berechtigung im Test"] },
        };
      }
    };
  });
  await page.locator("thead").getByRole("checkbox").click();
  await page.getByRole("button", { name: "Bearbeiten", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Sammelbearbeitung" });
  await dialog.getByLabel("Änderung", { exact: true }).click();
  await page.getByRole("option", { name: "Labels hinzufügen" }).click();
  await dialog
    .getByLabel("Labels, durch Komma getrennt")
    .fill("release, release");
  await dialog.getByRole("button", { name: "Änderung anwenden" }).click();
  await expect(dialog.getByRole("status")).toHaveText(
    "2 von 3 geändert · 1 fehlgeschlagen",
  );
  await dialog
    .getByRole("button", { name: "Nur fehlgeschlagene wiederholen" })
    .click();
  await expect(dialog.getByRole("status")).toHaveText("3 von 3 geändert");
  const result = await page.evaluate(() => {
    const qa = window as unknown as {
      __qa: {
        issues: { fields: { labels: string[] } }[];
        writes: { path: string; method: string }[];
      };
    };
    return {
      labels: qa.__qa.issues[0]!.fields.labels,
      paths: qa.__qa.writes
        .filter(({ method }) => method === "PUT")
        .map(({ path }) => path),
    };
  });
  expect(result.labels).toEqual(["bestehend", "release"]);
  expect(result.paths.sort()).toEqual([
    "/issue/DEMO-1",
    "/issue/DEMO-2",
    "/issue/DEMO-2",
    "/issue/DEMO-3",
  ]);
});

test("Tastaturbedienung und schnelle Mehrfachklicks senden nur einmal", async ({
  page,
}) => {
  await page.goto(table);
  await expect(
    page.getByRole("cell", { name: "DEMO-1", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    (window as unknown as { __qa: { delayMs: number } }).__qa.delayMs = 700;
  });
  await page.locator("tbody tr").first().getByRole("checkbox").click();
  await page.getByRole("button", { name: "Bearbeiten", exact: true }).click();
  const apply = page.getByRole("button", { name: "Änderung anwenden" });
  await expect(apply).toBeEnabled();
  await apply.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog").getByRole("status")).toHaveText(
    "1 von 1 geändert",
  );
  expect(
    await page.evaluate(
      () =>
        (
          window as unknown as { __qa: { writes: { method: string }[] } }
        ).__qa.writes.filter(({ method }) => method === "PUT").length,
    ),
  ).toBe(1);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Bearbeiten", exact: true }),
  ).toBeFocused();
});

test("Sammelstatus nutzt die zulässige Transition jedes Tickets", async ({
  page,
}) => {
  await page.goto(table);
  await expect(
    page.getByRole("cell", { name: "DEMO-1", exact: true }),
  ).toBeVisible();
  await page.locator("thead").getByRole("checkbox").click();
  await page.getByRole("button", { name: "Bearbeiten", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Sammelbearbeitung" });
  await dialog.getByLabel("Änderung", { exact: true }).click();
  await page
    .getByRole("option", { name: "Status ändern", exact: true })
    .click();
  await dialog.getByLabel("Neuer Status").click();
  await page.getByRole("option", { name: "Erledigt", exact: true }).click();
  await dialog.getByRole("button", { name: "Änderung anwenden" }).click();
  await expect(dialog.getByRole("status")).toHaveText("3 von 3 geändert");
  expect(
    await page.evaluate(
      () =>
        (
          window as unknown as { __qa: { writes: { path: string }[] } }
        ).__qa.writes.filter(({ path }) => path.endsWith("/transitions"))
          .length,
    ),
  ).toBe(3);
});

test("Sammelbearbeitung bleibt in niedrigen Fenstern scrollbar und per Tastatur erreichbar", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 560, height: 360 });
  await page.goto(table);
  await page.locator("thead").getByRole("checkbox").click();
  await page.getByRole("button", { name: "Bearbeiten", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Sammelbearbeitung" });
  await dialog.getByLabel("Änderung", { exact: true }).click();
  await page
    .getByRole("option", { name: "Labels hinzufügen", exact: true })
    .click();
  await dialog.getByLabel("Labels, durch Komma getrennt").fill("polish");
  await dialog.getByLabel("Labels, durch Komma getrennt").focus();
  await page.keyboard.press("Tab");
  const apply = dialog.getByRole("button", { name: "Änderung anwenden" });
  await expect(apply).toBeFocused();
  await expect
    .poll(() =>
      dialog.evaluate((element) => ({
        contained:
          element.getBoundingClientRect().top >= 0 &&
          element.getBoundingClientRect().bottom <= innerHeight,
        scrollable: getComputedStyle(element).overflowY === "auto",
      })),
    )
    .toEqual({ contained: true, scrollable: true });
  await page.screenshot({ path: testInfo.outputPath("bulk-short-window.png") });
  await page.keyboard.press("Enter");
  await expect(dialog.getByRole("status")).toHaveText("3 von 3 geändert");
});
