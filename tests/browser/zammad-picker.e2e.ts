import { expect, test } from "@playwright/test";

test("Profilvorschauen blockieren weder Personenauswahl noch Suchtreffer", async ({ page }) => {
  await page.goto("/tests/browser/fixture.html?scenario=zammad&route=/helpdesk/41");
  const trigger = page.getByRole("button", { name: "Zuständig auswählen" });
  await expect(trigger).toContainText("Alex Support");
  await page.clock.install();
  await trigger.hover();
  await page.clock.runFor(1000);
  await expect(page.locator('[data-slot="hover-card-content"]')).toHaveCount(0);
  await trigger.click();
  await page.getByLabel("Zuständig suchen").fill("Alex");
  const result = page.getByRole("button", { name: /Alex Support/ });
  await result.hover();
  await page.clock.runFor(1000);
  await expect(page.locator('[data-slot="hover-card-content"]')).toHaveCount(0);
  await result.click();
  await expect(page.getByLabel("Zuständig suchen")).toHaveCount(0);
});
