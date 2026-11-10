import { expect, test } from "@playwright/test";

for (const port of [8743, 49152]) {
  test(`Briefing verwendet den tatsächlichen Rückkanal auf Port ${port}`, async ({ page }) => {
    await page.goto(`/tests/browser/fixture.html?attentionPort=${port}&route=/settings/briefing`);
    const callbackUrl = `http://127.0.0.1:${port}/attention`;
    await expect(page.getByText("Lokaler Endpunkt bereit:")).toContainText(callbackUrl);
    const prompt = page.locator('[data-slot="code-block-content"]');
    await expect(prompt).toContainText('curl -sS --fail-with-body -X POST "{{body.callbackUrl}}"');
    await expect(prompt).not.toContainText("8743");

    await page.getByLabel("Webhook-URL").fill("https://example.test/briefing");
    const run = page.getByRole("button", { name: "Jetzt ausführen" });
    await expect(run).toBeEnabled();
    await run.click();

    await expect.poll(() => page.evaluate("window.__qa.attentionRequest?.callbackUrl ?? null")).toBe(callbackUrl);
    await expect.poll(() => page.evaluate("window.__qa.attentionRequest?.runId ?? null")).toBeTruthy();
    await expect(page.getByText("Briefing konnte nicht gestartet werden", { exact: true })).toHaveCount(0);
  });
}
