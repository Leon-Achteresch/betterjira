import { expect, test } from "@playwright/test";

const UPDATES = "/tests/browser/fixture.html?route=/settings/updates";

test("Updates-Einstellungen: Automatik, Suche und Zurückrollen", async ({ page }) => {
  await page.goto(UPDATES);
  await expect(page.getByRole("heading", { name: "Bestimmte Version installieren" })).toBeVisible();
  await expect(page.getByText("Installiert: 0.7.0")).toBeVisible();

  const autoCheck = page.getByRole("switch", { name: "Automatisch nach Updates suchen" });
  const autoInstall = page.getByRole("switch", { name: "Updates automatisch installieren" });
  await expect(autoCheck).toBeChecked();
  await autoInstall.click();
  await expect(autoInstall).toBeChecked();
  await autoCheck.click();
  await expect(autoInstall).toBeDisabled();
  await autoCheck.click();
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem("betterjira-update-preferences")))!).state).toMatchObject({
    autoCheck: true,
    autoInstall: true,
  });

  await page.getByRole("button", { name: "Nach Updates suchen" }).click();
  await expect(page.getByText("betterjira ist aktuell")).toBeVisible();

  const version = page.getByRole("combobox", { name: "Version" });
  await expect(version).toContainText("0.6.0");
  await version.click();
  await page.getByRole("option", { name: /0\.5\.0/ }).click();
  await expect(version).toContainText("0.5.0");

  await page.getByRole("button", { name: "Zurückrollen" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __qaUpdates: { installed: string[]; restarts: number } }).__qaUpdates)).toEqual(
    expect.objectContaining({ installed: ["0.5.0"], restarts: 1 }),
  );
  await expect(page.getByText("Automatische Installation pausiert")).toBeVisible();
  await expect(autoInstall).not.toBeChecked();
});
