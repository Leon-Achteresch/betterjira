import { expect, type Locator } from "@playwright/test";

export async function expectMinimumTargetSize(target: Locator, minimum = 32) {
  await expect.poll(async () => {
    const box = await target.boundingBox();
    return box ? Math.round(Math.min(box.width, box.height)) : 0;
  }).toBeGreaterThanOrEqual(minimum);
}
