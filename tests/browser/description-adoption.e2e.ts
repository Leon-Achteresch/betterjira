import { expect, test, type Page } from "@playwright/test";
import type { FieldDraftQa } from "./field-draft-fixture";

declare global {
  interface Window {
    __fieldDraftQa: FieldDraftQa;
    __qa: { writes: unknown[] };
    __qaWriteGate?: Promise<void>;
    __releaseWrite?: () => void;
  }
}
const id = JSON.stringify(["qa-cloud", "qa-user", "DEMO-1", "description#adf"]);
const doc = (text: string) => JSON.stringify({ type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text }] }] });
const undo = (page: Page) => page.locator("[data-sonner-toast]").getByRole("button", { name: "Rückgängig" });
const drafts = (page: Page) => page.evaluate(() => window.__fieldDraftQa.store.getState().drafts);
const conflict = async (page: Page) => {
  await page.goto("/tests/browser/field-draft-fixture.html");
  await expect(page.getByTestId("editor")).toBeVisible();
  await page.evaluate(async (text) => {
    const qa = window.__fieldDraftQa;
    qa.editor!.setText(text);
    await qa.editor!.submit();
  }, doc("Lokaler Altdraft"));
  await expect(page.getByTestId("editor")).toContainText('"status":"conflict"');
};

test("echter Hook: doppelte Uebernahme und Undo erhalten den urspruenglichen basislosen Entwurf", async ({ page }) => {
  await conflict(page);
  await page.evaluate((id) => {
    const qa = window.__fieldDraftQa;
    qa.store.getState().rebase(id, qa.store.getState().drafts[id].text, undefined);
    const adopt = qa.editor!.adoptRemote!;
    adopt(); adopt();
  }, id);
  await undo(page).click();
  expect((await drafts(page))[id]).toMatchObject({ text: doc("Lokaler Altdraft") });
  expect((await drafts(page))[id]).not.toHaveProperty("basis");
});

test("echter Hook: Undo ueberschreibt keine neuere Eingabe, auch bei gleichem Text", async ({ page }) => {
  await conflict(page);
  await page.evaluate(() => window.__fieldDraftQa.editor!.adoptRemote!());
  const adopted = (await drafts(page))[id];
  await page.evaluate((text) => window.__fieldDraftQa.editor!.setText(text), adopted.text);
  const newer = (await drafts(page))[id];
  expect(newer.revision).not.toBe(adopted.revision);
  await undo(page).click();
  expect((await drafts(page))[id]).toEqual(newer);
});

for (const change of ["issue", "account", "site", "mode", "unmount", "close"] as const) {
  test(`echter Hook: alte Aktionen nach ${change} sind wirkungslos`, async ({ page }) => {
    await conflict(page);
    await page.evaluate((change) => {
      const qa = window.__fieldDraftQa;
      qa.captured = qa.editor;
      qa.editor!.adoptRemote!();
      if (change === "issue") qa.change!({ issueKey: "DEMO-2" });
      if (change === "account") qa.scope("qa-cloud", "qa-other");
      if (change === "site") qa.scope("qa-other-cloud", "qa-user");
      if (change === "mode") qa.change!({ mode: "wiki", initial: "Wiki", initialRaw: "Wiki" });
      if (change === "unmount") qa.change!({}, false);
      if (change === "close") qa.editor!.close();
    }, change);
    if (change === "unmount") await expect(page.getByTestId("editor")).toHaveCount(0);
    else if (change === "mode") await expect(page.getByTestId("editor")).toContainText('"text":"Wiki"');
    else if (["issue", "account", "site"].includes(change)) await expect(page.getByTestId("editor")).not.toContainText("weniger Kontextwechseln");
    await page.evaluate(() => window.__fieldDraftQa.editor!.setText("Neuer fremder Entwurf"));
    const before = await drafts(page);
    await undo(page).click();
    await page.evaluate(async () => {
      const old = window.__fieldDraftQa.captured!;
      old.adoptRemote?.(); old.setText("Veralteter Callback"); await old.submit();
    });
    expect(await drafts(page)).toEqual(before);
    expect(await page.evaluate(() => window.__qa.writes)).toHaveLength(0);
  });
}

for (const change of ["issue", "unmount", "close"] as const) {
  test(`echter Hook: spaeter Write nach ${change} schliesst keinen anderen Editor`, async ({ page }) => {
    await conflict(page);
    await page.evaluate(() => window.__fieldDraftQa.editor!.adoptRemote!());
    await expect(page.getByTestId("editor")).not.toContainText('"comparison"');
    await page.evaluate(() => {
      const w = window;
      w.__qaWriteGate = new Promise<void>((resolve) => { w.__releaseWrite = resolve; });
      w.__fieldDraftQa.pending = w.__fieldDraftQa.editor!.submit();
    });
    await expect.poll(() => page.evaluate(() => window.__fieldDraftQa.store.getState().saving.length)).toBe(1);
    await page.evaluate((change) => {
      const qa = window.__fieldDraftQa;
      if (change === "issue") qa.change!({ issueKey: "DEMO-2" });
      if (change === "unmount") qa.change!({}, false);
      if (change === "close") qa.editor!.close();
    }, change);
    if (change === "unmount") await expect(page.getByTestId("editor")).toHaveCount(0);
    if (change === "issue") await expect(page.getByTestId("editor")).not.toContainText("weniger Kontextwechseln");
    await page.evaluate(async () => {
      const w = window;
      w.__releaseWrite!();
      await w.__fieldDraftQa.pending;
    });
    expect(await page.evaluate(() => window.__fieldDraftQa.closes)).toEqual(change === "close" ? ["DEMO-1"] : []);
    expect(await page.evaluate(() => window.__qa.writes)).toHaveLength(1);
  });
}

test("echter Hook: Undo waehrend Write und nach erfolgreichem Save belebt keinen Altdraft", async ({ page }) => {
  await conflict(page);
  await page.evaluate(() => window.__fieldDraftQa.editor!.adoptRemote!());
  await expect(page.getByTestId("editor")).not.toContainText('"comparison"');
  const adopted = (await drafts(page))[id];
  await page.evaluate(() => {
    const w = window;
    w.__qaWriteGate = new Promise<void>((resolve) => { w.__releaseWrite = resolve; });
    w.__fieldDraftQa.pending = w.__fieldDraftQa.editor!.submit();
  });
  await expect.poll(() => page.evaluate(() => window.__fieldDraftQa.store.getState().saving.length)).toBe(1);
  await page.evaluate(() => {
    const action = document.querySelector<HTMLButtonElement>("[data-sonner-toast] [data-button]");
    if (!action) throw new Error("Undo fehlt");
    action.click(); action.click();
  });
  expect((await drafts(page))[id]).toEqual(adopted);
  await page.evaluate(async () => {
    const w = window;
    w.__releaseWrite!(); await w.__fieldDraftQa.pending;
  });
  expect((await drafts(page))[id]).toBeUndefined();
  expect(await page.evaluate(() => window.__qa.writes)).toHaveLength(1);
});
