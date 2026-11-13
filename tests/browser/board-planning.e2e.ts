import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __qaPlan: {
      order: number[];
      locations: Record<string, string>;
      fail: number;
    };
    __qaPlanningWrite: (
      path: string,
      input: {
        issues: string[];
        rankBeforeIssue?: string;
        rankAfterIssue?: string;
      },
    ) => { status: number; body?: unknown };
  }
}

const planning = (page: Page) =>
  page.getByRole("region", { name: "Sprint-Planung", exact: true });
const keys = (page: Page) =>
  planning(page)
    .getByRole("listitem")
    .evaluateAll((rows) =>
      rows.map((row) => row.querySelector("a span")?.textContent),
    );
const action = async (page: Page, key: string, label: string) => {
  await planning(page)
    .getByRole("button", { name: `${key} planen`, exact: true })
    .click();
  await page.getByRole("menuitem", { name: label, exact: true }).click();
};

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.addInitScript(() => {
    window.__qaBoardType = "scrum";
    window.__qaPlan = {
      order: [1, 2, 3],
      locations: { "1": "backlog", "2": "backlog", "3": "backlog" },
      fail: 0,
    };
    window.__qaSearchRule = (jql) => {
      if (!jql.startsWith("filter = 100")) return {};
      const location = jql.includes("sprint = 5")
        ? "5"
        : jql.includes("sprint is EMPTY")
          ? "backlog"
          : "active";
      return {
        issues: window.__qaPlan.order
          .filter((id) => window.__qaPlan.locations[id] === location)
          .map((id) => ({
            id: String(id),
            key: `DEMO-${id}`,
            fields: {
              summary: `Planungsaufgabe ${id}`,
              status: {
                id: "3",
                name: "In Arbeit",
                statusCategory: { key: "indeterminate", colorName: "yellow" },
              },
              assignee: null,
              created: "2026-11-01T09:00:00Z",
              issuetype: { name: "Aufgabe" },
              customfield_10016: id,
            },
          })),
      };
    };
    window.__qaPlanningWrite = (path, input) => {
      if (window.__qaPlan.fail)
        return {
          status: window.__qaPlan.fail,
          body: { errorMessages: ["Planung nicht erlaubt"] },
        };
      const id = Number(input.issues[0]?.split("-").at(-1));
      if (path === "/issue/rank") {
        const order = window.__qaPlan.order.filter((entry) => entry !== id);
        const neighbor = Number(input.rankBeforeIssue ?? input.rankAfterIssue);
        const index = order.indexOf(neighbor) + Number(!!input.rankAfterIssue);
        order.splice(index, 0, id);
        window.__qaPlan.order = order;
      } else
        window.__qaPlan.locations[id] = path.includes("/sprint/")
          ? "5"
          : "backlog";
      return { status: 204 };
    };
  });
  await page.goto(
    `/tests/browser/fixture.html?${new URLSearchParams({ scenario: "board", route: "/bereiche/DEMO?board=1&sprint=backlog" })}`,
  );
  await page
    .getByRole("button", { name: "Sprint-Planung", exact: true })
    .click();
  await expect(planning(page).getByRole("listitem")).toHaveCount(3);
});

test("Reihenfolge wird in Jira gespeichert, Sprint-Zuweisung und Rückkehr ins Backlog funktionieren", async ({
  page,
}, testInfo) => {
  await expect.poll(() => keys(page)).toEqual(["DEMO-1", "DEMO-2", "DEMO-3"]);
  await page.screenshot({ path: testInfo.outputPath("board-planning.png") });
  await action(page, "DEMO-2", "Nach oben");
  await expect.poll(() => keys(page)).toEqual(["DEMO-2", "DEMO-1", "DEMO-3"]);
  await expect(
    page.getByText("Reihenfolge gespeichert", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => window.__qa.writes.at(-1))).toMatchObject({
    path: "/issue/rank",
    method: "PUT",
    input: { issues: ["DEMO-2"], rankBeforeIssue: "1" },
  });
  await action(page, "DEMO-2", "Sprint 5 Aktiv");
  await expect.poll(() => keys(page)).toEqual(["DEMO-1", "DEMO-3"]);
  await planning(page)
    .getByRole("combobox", { name: "Planungsliste wählen" })
    .click();
  await page.getByRole("option", { name: "Sprint 5", exact: true }).click();
  await expect.poll(() => keys(page)).toEqual(["DEMO-2"]);
  await action(page, "DEMO-2", "Backlog");
  await expect(
    planning(page).getByText("Keine Vorgänge in dieser Planungsliste."),
  ).toBeVisible();
  const paths = await page.evaluate(() =>
    window.__qa.writes.map((write) => write.path),
  );
  expect(paths).toEqual(["/issue/rank", "/sprint/5/issue", "/backlog/issue"]);
});

test("fehlende Planungsrechte rollen die Reihenfolge zurück und erklären erneute Anmeldung", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.__qaPlan.fail = 403;
    window.__qa.delayMs = 350;
  });
  await action(page, "DEMO-2", "Nach oben");
  await expect(page.getByText(/Nach dem Update erneut anmelden/)).toBeVisible();
  await expect.poll(() => keys(page)).toEqual(["DEMO-1", "DEMO-2", "DEMO-3"]);
  expect(
    await page.evaluate(
      () =>
        window.__qa.writes.filter((write) => write.path === "/issue/rank")
          .length,
    ),
  ).toBe(1);
  await page.evaluate(() => {
    window.__qaPlan.fail = 0;
  });
  await action(page, "DEMO-2", "Nach oben");
  await expect.poll(() => keys(page)).toEqual(["DEMO-2", "DEMO-1", "DEMO-3"]);
});

test("Fehlgeschlagene Aktualisierung erhält die Planung und lässt sich gezielt wiederholen", async ({
  page,
}) => {
  await page.evaluate(() => {
    const original = window.__qaSearchRule;
    window.__qaSearchRule = (jql, token) =>
      jql.startsWith("filter = 100") && window.__qaPlan.fail
        ? { status: 503 }
        : (original?.(jql, token) ?? {});
  });
  await action(page, "DEMO-2", "Nach oben");
  await expect.poll(() => keys(page)).toEqual(["DEMO-2", "DEMO-1", "DEMO-3"]);
  await page.evaluate(() => {
    window.__qaPlan.fail = 503;
  });
  await planning(page)
    .getByRole("button", { name: "Planung aktualisieren", exact: true })
    .click();
  await expect(
    planning(page).getByText("Aktualisierung fehlgeschlagen", { exact: true }),
  ).toBeVisible();
  await expect(planning(page).getByRole("listitem")).toHaveCount(3);
  await page.evaluate(() => {
    window.__qaPlan.fail = 0;
  });
  await planning(page)
    .getByRole("button", { name: "Planung erneut laden", exact: true })
    .click();
  await expect(planning(page).getByRole("alert")).toHaveCount(0);
  await expect.poll(() => keys(page)).toEqual(["DEMO-2", "DEMO-1", "DEMO-3"]);
});

test("Fehlgeschlagene Folgeseite erhält Zeilen und wiederholt nur die fehlende Seite", async ({
  page,
}) => {
  await page.evaluate(() => {
    const original = window.__qaSearchRule;
    window.__qaSearchRule = (jql, token) => {
      if (!jql.startsWith("filter = 100")) return original?.(jql, token) ?? {};
      if (!token) return { ...original?.(jql, token), nextPageToken: "p2" };
      return { status: 503 };
    };
  });
  await action(page, "DEMO-2", "Nach oben");
  const more = planning(page).getByRole("button", {
    name: "Weitere Vorgänge laden",
    exact: true,
  });
  await expect(more).toBeEnabled();
  await more.click();
  await expect(
    planning(page).getByText("Weitere Vorgänge konnten nicht geladen werden", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(planning(page).getByRole("listitem")).toHaveCount(3);
  await page.evaluate(() => {
    const original = window.__qaSearchRule;
    window.__qaSearchRule = (jql, token) =>
      jql.startsWith("filter = 100") && token === "p2"
        ? {
            issues: [
              {
                id: "4",
                key: "DEMO-4",
                fields: {
                  summary: "Nachgeladene Aufgabe",
                  status: { name: "Offen" },
                },
              },
            ],
          }
        : (original?.(jql, token) ?? {});
  });
  await planning(page)
    .getByRole("button", { name: "Weitere Vorgänge erneut laden", exact: true })
    .click();
  await expect
    .poll(() => keys(page))
    .toEqual(["DEMO-2", "DEMO-1", "DEMO-3", "DEMO-4"]);
  await expect(planning(page).getByRole("alert")).toHaveCount(0);
  await expect(more).toHaveCount(0);
});

test("Tastaturfokus bleibt nach Rangänderung und Sprint-Verschiebung in der Planung", async ({
  page,
}) => {
  const trigger = planning(page).getByRole("button", {
    name: "DEMO-2 planen",
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("menuitem", { name: "Nach oben", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    planning(page).getByRole("link", { name: /DEMO-2/ }),
  ).toBeFocused();
  await expect(trigger).toBeEnabled();
  await page.keyboard.press("Tab");
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Enter");
  await page
    .getByRole("menuitem", { name: "Sprint 5 Aktiv", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    planning(page).getByRole("link", { name: /DEMO-1/ }),
  ).toBeFocused();
  await action(page, "DEMO-1", "Sprint 5 Aktiv");
  await action(page, "DEMO-3", "Sprint 5 Aktiv");
  await expect(
    planning(page).getByRole("button", { name: "Sprint-Planung", exact: true }),
  ).toBeFocused();
});

test("Lange Tickettexte bleiben bei 390 px innerhalb der Planung", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    const original = window.__qaSearchRule;
    window.__qaSearchRule = (jql, token) => {
      return jql.startsWith("filter = 100")
        ? {
            issues: window.__qaPlan.order.map((id) => ({
              id: String(id),
              key: `DEMO-${id}`,
              fields: {
                summary: "TicketmitsehrlangemzusammenhängendemTitel".repeat(8),
                status: { name: "Offen" },
              },
            })),
          }
        : (original?.(jql, token) ?? {});
    };
  });
  await action(page, "DEMO-2", "Nach oben");
  await expect(planning(page).getByRole("link").first()).toContainText(
    "Ticketmitsehrlangem",
  );
  expect(
    await planning(page).evaluate(
      (element) => element.scrollWidth - element.clientWidth,
    ),
  ).toBeLessThanOrEqual(0);
  expect(
    await planning(page)
      .getByRole("link")
      .first()
      .evaluate((element) => element.getBoundingClientRect().height),
  ).toBeLessThanOrEqual(64);
  await page.screenshot({
    path: testInfo.outputPath("planning-long-title.png"),
  });
});
