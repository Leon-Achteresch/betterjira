import { expect, test, type Page } from "@playwright/test";

const shots = process.env.WORKSPACE_NOTES_SHOTS;
const own = JSON.stringify(["qa-cloud", "qa-user"]);
const colleague = JSON.stringify(["qa-cloud", "qa-colleague"]);
const seededNote = "QA-Notiz: vor Freigabe mit Team abstimmen";

const open = async (page: Page, route = "/arbeitsplatz") => {
  await page.goto(`/tests/browser/fixture.html?${new URLSearchParams({ scenario: "workspace", route })}`);
  await expect(page.getByRole("heading", { name: "Arbeitsplatz", level: 1 })).toBeVisible();
  await expect(page.getByRole("list", { name: "Arbeitskontexte" })).toBeVisible();
};

const list = (page: Page) => page.getByRole("list", { name: "Arbeitskontexte" });
const rows = (page: Page) => list(page).getByRole("listitem");
const row = (page: Page, key: string) => list(page).locator(`[data-workspace-entry="${key}"]`);
const filters = (page: Page) => page.getByRole("navigation", { name: "Arbeitskontexte filtern" });
const dialog = (page: Page) => page.getByRole("dialog", { name: /^Notiz (bearbeiten|hinzufügen)/ });
const field = (page: Page) => dialog(page).getByRole("textbox", { name: "Private Notiz" });
const saveShortcut = (page: Page) => page.keyboard.press(process.platform === "darwin" ? "Meta+Enter" : "Control+Enter");

const noteButton = async (page: Page, key: string, action: "bearbeiten" | "hinzufügen") => {
  await row(page, key).hover();
  return row(page, key).getByRole("button", { name: `Notiz zu ${key} ${action}` });
};

const startEditing = async (page: Page, key: string, action: "bearbeiten" | "hinzufügen") => {
  const button = await noteButton(page, key, action);
  await button.click();
  await expect(field(page)).toBeFocused();
  return button;
};

type StoredWorkspace = {
  drafts: Record<string, string>;
  commentDrafts?: Record<string, unknown>;
  contexts: Record<string, { note: string }>;
} & Record<string, unknown>;
const textDoc = (text: string) => ({
  type: "doc",
  version: 1,
  content: text.split("\n").map((line) => ({ type: "paragraph", content: line ? [{ type: "text", text: line }] : [] })),
});
const migrated = ({ drafts, commentDrafts, ...rest }: StoredWorkspace): StoredWorkspace => ({
  ...rest,
  drafts: {},
  commentDrafts: { ...commentDrafts, ...Object.fromEntries(Object.entries(drafts).map(([key, text]) => [key, textDoc(text)])) },
});
const storage = async (page: Page) => {
  const raw: { workspaces: Record<string, StoredWorkspace>; fieldDrafts: string | null } = await page.evaluate(() => ({
    workspaces: JSON.parse(localStorage.getItem("betterjira-workspaces") ?? "{}").state.workspaces,
    fieldDrafts: localStorage.getItem("betterjira-field-drafts"),
  }));
  return {
    ...raw,
    workspaces: Object.fromEntries(Object.entries(raw.workspaces).map(([id, workspace]) => [id, migrated(workspace)])),
  };
};

// Raw storage without the test-side migration: proves the app itself migrated and saved the legacy drafts.
const rawWorkspaces = (page: Page): Promise<Record<string, StoredWorkspace>> =>
  page.evaluate(() => JSON.parse(localStorage.getItem("betterjira-workspaces") ?? "{}").state.workspaces);

const settle = async (page: Page) => {
  await page.mouse.move(0, 0);
  const state = await page.evaluate(async () => {
    await document.fonts.load('16px "Geist Variable"');
    await document.fonts.ready;
    await Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    );
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return {
      loaded: [...document.fonts].some((face) => face.family.includes("Geist") && face.status === "loaded"),
      dark: document.documentElement.classList.contains("dark"),
    };
  });
  expect(state.loaded).toBe(true);
  return state;
};

const jiraWrites = (page: Page) => page.evaluate(() => (window as unknown as { __qa: { writes: unknown[] } }).__qa.writes.length);

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.clock.setFixedTime(new Date("2026-11-06T12:00:00.000Z"));
});

test("Notiz im Arbeitsplatz bearbeiten bleibt lokal, persistent und mit dem Ticket synchron", async ({ page }) => {
  await open(page);
  const before = await storage(page);

  const trigger = await startEditing(page, "DEMO-4", "bearbeiten");
  await expect(dialog(page)).toContainText("DEMO-4");
  await expect(field(page)).toHaveValue(seededNote);
  await field(page).fill("Verworfen");
  await field(page).blur();
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toBeHidden();
  await expect(trigger).toBeFocused();
  expect((await storage(page)).workspaces).toEqual(before.workspaces);

  await startEditing(page, "DEMO-4", "bearbeiten");
  await expect(field(page)).toHaveValue(seededNote);
  await field(page).fill("QA-Notiz: neu aus dem Arbeitsplatz");
  await saveShortcut(page);
  await expect(dialog(page)).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(row(page, "DEMO-4")).toContainText("QA-Notiz: neu aus dem Arbeitsplatz");

  const after = await storage(page);
  expect(after.workspaces[own].contexts["DEMO-4"]).toEqual({
    ...before.workspaces[own].contexts["DEMO-4"],
    note: "QA-Notiz: neu aus dem Arbeitsplatz",
  });
  expect({ ...after.workspaces[own], contexts: null }).toEqual({ ...before.workspaces[own], contexts: null });
  expect(after.workspaces[colleague]).toEqual(before.workspaces[colleague]);
  expect(after.fieldDrafts).toBe(before.fieldDrafts);
  expect(await jiraWrites(page)).toBe(0);
  const raw = await rawWorkspaces(page);
  for (const [account, key] of [[own, "DEMO-3"], [colleague, "DEMO-12"]]) {
    expect(raw[account].drafts ?? {}).toEqual({});
    expect(raw[account].commentDrafts?.[key]).toBeDefined();
  }

  await open(page);
  await expect(row(page, "DEMO-4")).toContainText("QA-Notiz: neu aus dem Arbeitsplatz");

  await list(page).getByRole("link", { name: /^DEMO-4:/ }).click();
  await expect(page).toHaveURL(/\/issue\/DEMO-4$/);
  await page.getByRole("button", { name: "Weitere Ticketaktionen" }).click();
  await page.getByRole("menuitem", { name: "Private Notiz für später" }).click();
  const ticketNote = page.getByRole("dialog").getByRole("textbox", { name: "Private Notiz" });
  await expect(ticketNote).toHaveValue("QA-Notiz: neu aus dem Arbeitsplatz");
  await ticketNote.fill("QA-Notiz: im Ticket geändert");
  await page.keyboard.press("Escape");
  await page.goBack();
  await expect(page).toHaveURL(/\/arbeitsplatz$/);
  await expect(row(page, "DEMO-4")).toContainText("QA-Notiz: im Ticket geändert");
  await startEditing(page, "DEMO-4", "bearbeiten");
  await expect(field(page)).toHaveValue("QA-Notiz: im Ticket geändert");
  await page.getByRole("button", { name: "Abbrechen" }).click();
  expect(await jiraWrites(page)).toBe(0);
});

test("Notiz hinzufügen ändert nur die Notiz und kein Blur speichert heimlich", async ({ page }) => {
  await open(page);
  const before = await storage(page);
  await startEditing(page, "DEMO-1", "hinzufügen");
  await field(page).fill("Nicht speichern");
  await page.getByRole("button", { name: "Abbrechen" }).focus();
  await expect(dialog(page)).toBeVisible();
  expect((await storage(page)).workspaces).toEqual(before.workspaces);
  await page.getByRole("button", { name: "Abbrechen" }).click();
  await expect(dialog(page)).toBeHidden();

  await startEditing(page, "DEMO-1", "hinzufügen");
  await expect(field(page)).toHaveValue("");
  await field(page).fill("Lesestelle prüfen");
  await dialog(page).getByRole("button", { name: "Speichern" }).click();
  await expect(dialog(page)).toBeHidden();
  await expect(filters(page).getByRole("link", { name: "Notizen 2" })).toBeVisible();
  await expect(row(page, "DEMO-1")).toContainText("Lesestelle gemerkt");
  await expect(await noteButton(page, "DEMO-1", "bearbeiten")).toBeFocused();
  const after = await storage(page);
  expect(after.workspaces[own].contexts["DEMO-1"]).toEqual({
    ...before.workspaces[own].contexts["DEMO-1"],
    note: "Lesestelle prüfen",
  });
  expect(after.workspaces[own].commentDrafts).toEqual(before.workspaces[own].commentDrafts);
  expect(await jiraWrites(page)).toBe(0);
});

test("Leeren entfernt nur die Notiz, Fokus folgt dem Filter und Rückgängig stellt sie wieder her", async ({ page }) => {
  await open(page);
  await startEditing(page, "DEMO-2", "hinzufügen");
  await field(page).fill("Zweite Notiz");
  await saveShortcut(page);
  await expect(dialog(page)).toBeHidden();
  const before = await storage(page);

  await filters(page).getByRole("link", { name: /^Notizen/ }).click();
  await expect(rows(page)).toHaveCount(2);
  await startEditing(page, "DEMO-2", "bearbeiten");
  await field(page).fill("   ");
  await saveShortcut(page);
  await expect(dialog(page)).toBeHidden();
  await expect(rows(page)).toHaveCount(1);
  await expect(list(page).getByRole("link", { name: /^DEMO-4:/ })).toBeFocused();

  await startEditing(page, "DEMO-4", "bearbeiten");
  await field(page).fill("");
  await saveShortcut(page);
  await expect(page.getByText("Keine privaten Notizen")).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "Arbeitsplatz durchsuchen" })).toBeFocused();

  const cleared = await storage(page);
  for (const key of ["DEMO-2", "DEMO-4"])
    expect(cleared.workspaces[own].contexts[key]).toEqual({ ...before.workspaces[own].contexts[key], note: "" });
  expect(cleared.workspaces[own].commentDrafts).toEqual(before.workspaces[own].commentDrafts);
  expect(cleared.workspaces[own].pinned).toEqual(before.workspaces[own].pinned);
  expect(cleared.workspaces[colleague]).toEqual(before.workspaces[colleague]);

  const toast = page.locator("[data-sonner-toast]").filter({ hasText: "DEMO-4" });
  await toast.getByRole("button", { name: "Rückgängig" }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(row(page, "DEMO-4")).toContainText(seededNote);
  expect((await storage(page)).workspaces[own].contexts["DEMO-4"].note).toBe(seededNote);
  expect(await jiraWrites(page)).toBe(0);
});

test("Änderung im zweiten Fenster erscheint schon vor dem Öffnen des Editors", async ({ page, context }) => {
  await open(page);
  const other = await context.newPage();
  await other.clock.setFixedTime(new Date("2026-11-06T12:00:00.000Z"));
  await open(other);
  await startEditing(other, "DEMO-4", "bearbeiten");
  await field(other).fill("Vor dem Öffnen geändert");
  await saveShortcut(other);
  await expect(dialog(other)).toBeHidden();
  await other.close();
  await expect(row(page, "DEMO-4")).toContainText("Vor dem Öffnen geändert");
  await startEditing(page, "DEMO-4", "bearbeiten");
  await expect(field(page)).toHaveValue("Vor dem Öffnen geändert");
  await expect(dialog(page).getByRole("alert")).toHaveCount(0);
  await page.keyboard.press("Escape");
  expect(await jiraWrites(page)).toBe(0);
});

test("Änderung an anderer Stelle wird angeboten statt still überschrieben", async ({ page, context }) => {
  await open(page);
  await startEditing(page, "DEMO-4", "bearbeiten");
  await field(page).fill("Mein Entwurf");

  const other = await context.newPage();
  await other.clock.setFixedTime(new Date("2026-11-06T12:00:00.000Z"));
  await open(other);
  await startEditing(other, "DEMO-4", "bearbeiten");
  await field(other).fill("Von woanders");
  await saveShortcut(other);
  await expect(dialog(other)).toBeHidden();
  await other.close();

  const alert = dialog(page).getByRole("alert");
  await expect(alert).toContainText("Inzwischen geändert");
  await expect(alert).toContainText("Von woanders");
  await expect(field(page)).toHaveValue("Mein Entwurf");
  await expect(dialog(page).getByRole("button", { name: "Speichern" })).toBeDisabled();
  await field(page).focus();
  await saveShortcut(page);
  await expect(dialog(page)).toBeVisible();
  expect((await storage(page)).workspaces[own].contexts["DEMO-4"].note).toBe("Von woanders");
  if (shots) {
    await settle(page);
    await page.screenshot({ path: `${shots}/${test.info().project.name}-konflikt.png` });
  }

  await alert.getByRole("button", { name: "Aktuellen Stand übernehmen" }).click();
  await expect(field(page)).toHaveValue("Von woanders");
  await expect(alert).toBeHidden();
  await field(page).fill("Mein Entwurf, ergänzt");
  await saveShortcut(page);
  await expect(dialog(page)).toBeHidden();
  expect((await storage(page)).workspaces[own].contexts["DEMO-4"].note).toBe("Mein Entwurf, ergänzt");
});

test("Eigenen Entwurf trotz Konflikt bewusst behalten", async ({ page, context }) => {
  await open(page);
  await startEditing(page, "DEMO-4", "bearbeiten");
  await field(page).fill("Meine Fassung");
  const other = await context.newPage();
  await other.clock.setFixedTime(new Date("2026-11-06T12:00:00.000Z"));
  await open(other);
  await startEditing(other, "DEMO-4", "bearbeiten");
  await field(other).fill("");
  await saveShortcut(other);
  await expect(dialog(other)).toBeHidden();
  await other.close();

  await expect(dialog(page).getByRole("alert")).toContainText("Notiz wurde entfernt.");
  await dialog(page).getByRole("button", { name: "Meinen Entwurf behalten" }).click();
  await expect(field(page)).toHaveValue("Meine Fassung");
  await dialog(page).getByRole("button", { name: "Speichern" }).click();
  await expect(dialog(page)).toBeHidden();
  expect((await storage(page)).workspaces[own].contexts["DEMO-4"].note).toBe("Meine Fassung");
});

test("Kontowechsel schließt den Dialog und schreibt nie in das andere Konto", async ({ page }) => {
  await open(page);
  const before = await storage(page);
  await startEditing(page, "DEMO-4", "bearbeiten");
  await field(page).fill("Darf nirgends landen");

  await page.evaluate(() => {
    (window as unknown as { __qa: { accountId?: string } }).__qa.accountId = "qa-colleague";
  });
  await page.clock.setFixedTime(new Date("2026-11-06T12:05:00.000Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
  await expect(dialog(page)).toBeHidden();
  await expect(rows(page)).toHaveCount(1);
  await expect(list(page).getByText("QA-Notiz eines anderen Kontos")).toBeVisible();
  await page.keyboard.press("Control+Enter");

  const after = await storage(page);
  expect(after.workspaces[colleague]).toEqual(before.workspaces[colleague]);
  expect(after.workspaces[own]).toEqual(before.workspaces[own]);

  await page.evaluate(() => {
    (window as unknown as { __qa: { accountId?: string } }).__qa.accountId = undefined;
  });
  await page.clock.setFixedTime(new Date("2026-11-06T12:10:00.000Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
  await expect(rows(page)).toHaveCount(11);
  await expect(dialog(page)).toBeHidden();
  expect((await storage(page)).workspaces[own]).toEqual(before.workspaces[own]);
});

test("Rückgängig bleibt nach dem Kontowechsel an das ursprüngliche Konto gebunden", async ({ page }) => {
  await open(page);
  const before = await storage(page);
  await startEditing(page, "DEMO-4", "bearbeiten");
  await field(page).fill("");
  await saveShortcut(page);
  await expect(dialog(page)).toBeHidden();

  await page.evaluate(() => {
    (window as unknown as { __qa: { accountId?: string } }).__qa.accountId = "qa-colleague";
  });
  await page.clock.setFixedTime(new Date("2026-11-06T12:05:00.000Z"));
  await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
  await expect(list(page).getByText("QA-Notiz eines anderen Kontos")).toBeVisible();

  await page.locator("[data-sonner-toast]").filter({ hasText: "DEMO-4" }).getByRole("button", { name: "Rückgängig" }).click();
  const after = await storage(page);
  expect(after.workspaces[colleague]).toEqual(before.workspaces[colleague]);
  expect(after.workspaces[own].contexts["DEMO-4"].note).toBe(seededNote);
});

test("Notizaktion bei 390 px hell und dunkel erreichbar, ohne Seitenüberlauf", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const button = row(page, "DEMO-4").getByRole("button", { name: "Notiz zu DEMO-4 bearbeiten" });
  await expect(button).toBeVisible();
  const box = await button.boundingBox();
  expect(box?.width).toBeGreaterThanOrEqual(32);
  expect(box?.height).toBeGreaterThanOrEqual(32);
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(field(page)).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const dialogBox = await dialog(page).boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(390);

  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains("dark"))).toBe(colorScheme === "dark");
    expect((await settle(page)).dark).toBe(colorScheme === "dark");
    if (shots) await page.screenshot({ path: `${shots}/${test.info().project.name}-390-${colorScheme}.png` });
  }

  await page.keyboard.press("Escape");
  await expect(button).toBeFocused();
});
