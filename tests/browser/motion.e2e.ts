import { expect, test, type Locator } from "@playwright/test";

const scale = (element: Locator) =>
  element.evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).a);

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.goto("/tests/browser/motion-fixture.html");
});

test("Druckfeedback führt Maus- und Tastaturaktionen genau einmal aus", async ({
  page,
}) => {
  const button = page.getByRole("button", { name: "Aktion", exact: true });
  const reduced = await page.evaluate(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  await button.hover();
  await page.mouse.down();
  if (reduced) expect(await scale(button)).toBe(1);
  else await expect.poll(() => scale(button)).toBeLessThan(1);
  await page.mouse.up();
  await expect(page.getByLabel("Aktionen")).toHaveText("1");
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Aktionen")).toHaveText("2");
  await page.keyboard.press("Space");
  await expect(page.getByLabel("Aktionen")).toHaveText("3");
  await page.getByRole("button", { name: "Deaktiviert", exact: true }).hover({ force: true });
  expect(
    await scale(page.getByRole("button", { name: "Deaktiviert", exact: true })),
  ).toBe(1);
});

for (const kind of ["Dialog", "Sheet", "Popover"] as const) {
  test(`${kind} bewahrt Fokus, Glas und sichere Exit-Zustände`, async ({
    page,
  }) => {
    const trigger = page.getByRole("button", { name: `${kind} öffnen` });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const action = page.getByRole("button", { name: `${kind}-Aktion` });
    await expect(action).toBeVisible();
    const surface = page.locator(
      `[data-slot=${kind === "Popover" ? "popover" : kind.toLowerCase()}-content]`,
    );
    expect(
      await surface.evaluate((node) => getComputedStyle(node).backdropFilter),
    ).toContain("blur");
    await action.focus();
    await page.keyboard.press("Escape");
    await expect(action).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(surface).toHaveCount(0);
    await trigger.click();
    await expect(action).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(page.locator("body")).not.toHaveCSS("pointer-events", "none");
  });
}

test("Menüs und Untermenüs bleiben per Tastatur bedienbar", async ({
  page,
}) => {
  const trigger = page.getByRole("button", { name: "Menü öffnen" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("menuitem", { name: "Ausführen", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("menuitem", { name: "Untermenü", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowRight");
  const action = page.getByRole("menuitem", {
    name: "Weitere Aktion",
    exact: true,
  });
  await expect(action).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Aktionen")).toHaveText("1");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("Schalter, gemischte Auswahl und Fortschritt bleiben synchron", async ({
  page,
}) => {
  const controlled = page.getByRole("switch", {
    name: "Kontrollierter Schalter",
  });
  const free = page.getByRole("switch", { name: "Freier Schalter" });
  await expect(controlled).not.toBeChecked();
  await expect(free).toBeChecked();
  await controlled.click();
  await expect(controlled).toBeChecked();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "80",
  );
  await free.focus();
  await page.keyboard.press("Space");
  await expect(free).not.toBeChecked();
  const checkbox = page.getByRole("checkbox", { name: "Auswahl" });
  await expect(checkbox).toHaveAttribute("aria-checked", "mixed");
  await checkbox.click();
  await expect(checkbox).toBeChecked();
  await checkbox.click();
  await expect(checkbox).not.toBeChecked();
});

test("Einklappen entfernt Inhalte aus Fokus- und Klickreihenfolge", async ({
  page,
}) => {
  const trigger = page.getByRole("button", { name: "Abschnitt", exact: true });
  const action = page.getByRole("button", { name: "Abschnitt-Aktion" });
  await expect(action).toBeVisible();
  await trigger.click();
  await expect(action).toBeHidden();
  await expect(page.locator("[data-slot=collapsible-content]")).toHaveCount(0);
  await trigger.click();
  await expect(action).toBeVisible();
});

for (const theme of ["light", "dark"]) {
  test(`Glas und Reduced Motion im ${theme}-Modus`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(
      (theme) => (document.documentElement.className = theme),
      theme,
    );
    await page.getByRole("button", { name: "Popover öffnen" }).click();
    const surface = page.locator("[data-slot=popover-content]");
    await expect(surface).toBeVisible();
    const state = await surface.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        transform: new DOMMatrix(style.transform).toFloat64Array().join(),
        radius: parseFloat(style.borderRadius),
        background: style.backgroundColor,
      };
    });
    expect(state.transform).toBe("1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1");
    expect(state.radius).toBeGreaterThanOrEqual(16);
    expect(state.background).not.toBe("rgba(0, 0, 0, 0)");
  });
}
