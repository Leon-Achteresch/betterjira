import { beforeEach, describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
import { connectOutlook, currentOutlookAccount, deleteRollout, disconnectOutlook, listOutlookEvents, loadRollouts, openOutlookEvent, saveRollout, syncRolloutToOutlook } from "./client";
import type { RolloutDraft } from "./model";
import { OUTLOOK_STORAGE_KEY, ROLLOUT_STORAGE_KEY } from "./storage";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const account = { id: "ABC123", displayName: "Testkalender", email: "test@example.com" };
const draft: RolloutDraft = {
  title: "  Release 1.2  ", start: "2026-11-20T10:00:00+01:00", end: "2026-11-20T11:00:00+01:00",
  notes: "Deployment prüfen", issues: [{ key: "DEMO-12", summary: "Release vorbereiten" }],
  siteUrl: "https://jira.example.com/", reminderMinutes: 15,
};

let data: Map<string, string>;
beforeEach(() => {
  data = new Map();
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { data.set(key, value); }),
    removeItem: vi.fn((key: string) => { data.delete(key); }),
  });
  invoke.mockReset();
});

describe("Rollout-Persistenz", () => {
  it("erstellt, normalisiert, liest, bearbeitet und löscht ohne Outlook", async () => {
    expect(await Effect.runPromise(loadRollouts)).toEqual([]);
    const row = await Effect.runPromise(saveRollout(draft));
    expect(row.title).toBe("Release 1.2");
    expect(row.start).toBe("2026-11-20T09:00:00.000Z");
    expect(row.siteUrl).toBe("https://jira.example.com");
    expect(await Effect.runPromise(loadRollouts)).toEqual([row]);
    const updated = await Effect.runPromise(saveRollout({ ...draft, title: "Release 1.3" }, row.id));
    expect(updated.id).toBe(row.id);
    expect(await Effect.runPromise(loadRollouts)).toEqual([updated]);
    await Effect.runPromise(deleteRollout(row.id));
    await Effect.runPromise(deleteRollout(row.id));
    expect(await Effect.runPromise(loadRollouts)).toEqual([]);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("verliert bei parallelen Schreibzugriffen keine Rollouts", async () => {
    await Promise.all(Array.from({ length: 10 }, (_, i) => Effect.runPromise(saveRollout({ ...draft, title: `Rollout ${i}` }))));
    expect(await Effect.runPromise(loadRollouts)).toHaveLength(10);
  });

  it.each([
    { ...draft, title: " " }, { ...draft, start: "ungültig" }, { ...draft, end: draft.start },
    { ...draft, start: "2026-11-20T10:00:00" }, { ...draft, reminderMinutes: -1 },
    { ...draft, reminderMinutes: 16 }, { ...draft, siteUrl: "javascript:alert(1)" },
    { ...draft, issues: [...draft.issues, ...draft.issues] },
    { ...draft, issues: [{ key: "DEMO-12 OR 1=1", summary: "" }] },
    { ...draft, siteUrl: "https://user:password@jira.example.com" },
  ])("weist ungültige Eingaben zurück, ohne zu schreiben", async (input) => {
    await expect(Effect.runPromise(saveRollout(input))).rejects.toThrow();
    expect(data.has(ROLLOUT_STORAGE_KEY)).toBe(false);
  });

  it("verweigert das Bearbeiten bereits gelöschter Rollouts", async () => {
    await expect(Effect.runPromise(saveRollout(draft, crypto.randomUUID()))).rejects.toThrow("bereits gelöscht");
  });

  it("überschreibt beschädigte Bestandsdaten nicht", async () => {
    data.set(ROLLOUT_STORAGE_KEY, "broken json");
    await expect(Effect.runPromise(loadRollouts)).rejects.toThrow("nicht überschrieben");
    await expect(Effect.runPromise(saveRollout(draft))).rejects.toThrow();
    expect(data.get(ROLLOUT_STORAGE_KEY)).toBe("broken json");
  });

  it("meldet Speicherfehler statt einen erfolgreichen Speichervorgang vorzutäuschen", async () => {
    vi.mocked(localStorage.setItem).mockImplementation(() => { throw new Error("quota"); });
    await expect(Effect.runPromise(saveRollout(draft))).rejects.toThrow("nicht gespeichert");
  });
});

describe("Lokale Outlook-Verbindung", () => {
  it("erklärt einen Office-Mandantenfehler, ohne eine Verbindung zu speichern", async () => {
    invoke.mockRejectedValueOnce("AADSTS50020: User account does not exist in tenant Schule (Microsoft Office)");
    await expect(Effect.runPromise(connectOutlook())).rejects.toThrow("Konto sowie Organisation direkt im klassischen Outlook prüfen");
    expect(data.has(OUTLOOK_STORAGE_KEY)).toBe(false);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("fragt Outlook vor dem expliziten Verbinden nicht ab und benötigt keine App-ID", async () => {
    expect(await Effect.runPromise(currentOutlookAccount)).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
    invoke.mockResolvedValue(account);
    expect(await Effect.runPromise(connectOutlook())).toEqual(account);
    expect(invoke).toHaveBeenCalledWith("outlook_request", { request: { action: "account" } });
    expect(data.get(OUTLOOK_STORAGE_KEY)).toBe(account.id);
    expect(await Effect.runPromise(currentOutlookAccount)).toEqual(account);
  });

  it("speichert keine Verbindung bei nicht verfügbarem oder ungültigem Outlook", async () => {
    invoke.mockRejectedValueOnce("Klassisches Outlook fehlt");
    await expect(Effect.runPromise(connectOutlook())).rejects.toThrow("Klassisches Outlook fehlt");
    invoke.mockResolvedValueOnce({ id: 12 });
    await expect(Effect.runPromise(connectOutlook())).rejects.toThrow("ungültige Daten");
    expect(data.has(OUTLOOK_STORAGE_KEY)).toBe(false);
  });

  it("erkennt einen Profilwechsel und lässt lokale Rollouts beim Trennen bestehen", async () => {
    data.set(OUTLOOK_STORAGE_KEY, "OTHER");
    invoke.mockResolvedValue(account);
    await expect(Effect.runPromise(currentOutlookAccount)).rejects.toThrow("Profil wurde gewechselt");
    await Effect.runPromise(saveRollout(draft));
    await Effect.runPromise(disconnectOutlook);
    expect(data.has(OUTLOOK_STORAGE_KEY)).toBe(false);
    expect(await Effect.runPromise(loadRollouts)).toHaveLength(1);
  });

  it("synchronisiert einen Rollout samt Ticketlinks, aktualisiert ihn ohne Duplikat und löscht beide Seiten", async () => {
    data.set(OUTLOOK_STORAGE_KEY, account.id);
    const row = await Effect.runPromise(saveRollout(draft));
    invoke.mockResolvedValue({ id: "DEADBEEF", accountId: account.id });
    const synced = await Effect.runPromise(syncRolloutToOutlook(row.id));
    expect(synced.outlookEventId).toBe("DEADBEEF");
    expect(invoke).toHaveBeenLastCalledWith("outlook_request", { request: expect.objectContaining({
      action: "upsert", accountId: account.id, rollout: expect.objectContaining({
        id: row.id, body: expect.stringContaining("https://jira.example.com/browse/DEMO-12"), reminderMinutes: 15, eventId: null,
      }),
    }) });
    await Effect.runPromise(saveRollout({ ...draft, title: "Release korrigiert" }, row.id));
    await Effect.runPromise(syncRolloutToOutlook(row.id));
    expect(invoke).toHaveBeenLastCalledWith("outlook_request", { request: expect.objectContaining({ rollout: expect.objectContaining({ eventId: "DEADBEEF", title: "Release korrigiert" }) }) });
    invoke.mockResolvedValue(null);
    await Effect.runPromise(deleteRollout(row.id));
    expect(invoke).toHaveBeenLastCalledWith("outlook_request", { request: { action: "delete", accountId: account.id, eventId: "DEADBEEF", rolloutId: row.id } });
    expect(await Effect.runPromise(loadRollouts)).toEqual([]);
  });

  it("erhält lokale Daten bei fehlgeschlagenem Sync und Löschen", async () => {
    data.set(OUTLOOK_STORAGE_KEY, account.id);
    const row = await Effect.runPromise(saveRollout(draft));
    invoke.mockRejectedValue("Outlook nicht erreichbar");
    await expect(Effect.runPromise(syncRolloutToOutlook(row.id))).rejects.toThrow("nicht erreichbar");
    expect(await Effect.runPromise(loadRollouts)).toEqual([row]);
    invoke.mockResolvedValue({ id: "DEADBEEF", accountId: account.id });
    const synced = await Effect.runPromise(syncRolloutToOutlook(row.id));
    invoke.mockRejectedValue("Outlook gesperrt");
    await expect(Effect.runPromise(deleteRollout(row.id))).rejects.toThrow("gesperrt");
    expect(await Effect.runPromise(loadRollouts)).toEqual([synced]);
  });

  it("verhindert Sync und Löschen in einem fremden oder getrennten Kalender", async () => {
    data.set(OUTLOOK_STORAGE_KEY, account.id);
    const row = await Effect.runPromise(saveRollout(draft));
    invoke.mockResolvedValue({ id: "DEADBEEF", accountId: account.id });
    await Effect.runPromise(syncRolloutToOutlook(row.id));
    invoke.mockClear();
    data.set(OUTLOOK_STORAGE_KEY, "OTHER");
    await expect(Effect.runPromise(syncRolloutToOutlook(row.id))).rejects.toThrow("anderen Outlook");
    await expect(Effect.runPromise(deleteRollout(row.id))).rejects.toThrow("ursprünglichen");
    data.delete(OUTLOOK_STORAGE_KEY);
    await expect(Effect.runPromise(deleteRollout(row.id))).rejects.toThrow("zuerst Outlook");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("liest Termine ausschließlich im angefragten Bereich und validiert die Antwort", async () => {
    data.set(OUTLOOK_STORAGE_KEY, account.id);
    invoke.mockResolvedValue([]);
    expect(await Effect.runPromise(listOutlookEvents(draft.start, draft.end))).toEqual([]);
    expect(invoke).toHaveBeenCalledWith("outlook_request", { request: { action: "list", accountId: account.id, start: draft.start, end: draft.end } });
    invoke.mockResolvedValue([{ invalid: true }]);
    await expect(Effect.runPromise(listOutlookEvents(draft.start, draft.end))).rejects.toThrow();
    invoke.mockClear();
    await expect(Effect.runPromise(listOutlookEvents(draft.end, draft.start))).rejects.toThrow("Kalenderzeitraum");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("öffnet auch einzelne Serientermine mit eindeutiger Vorkommenskennung", async () => {
    data.set(OUTLOOK_STORAGE_KEY, account.id);
    invoke.mockResolvedValue(null);
    await Effect.runPromise(openOutlookEvent("DEADBEEF|2026-11-20T09:00:00.000Z"));
    expect(invoke).toHaveBeenCalledWith("outlook_request", { request: { action: "open", accountId: account.id, eventId: "DEADBEEF", occurrenceStart: "2026-11-20T09:00:00.000Z" } });
  });
});
