import { beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../tests/jira/fixtures/description-conflict.json";
import { descriptionBasis } from "@/lib/description-comparison";
import { fieldDraftId, type FieldDraft } from "@/lib/field-draft";
import { submitFieldDraft } from "@/lib/field-draft-save";

const storage = vi.hoisted(() => {
  const data = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  };
  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("window", { localStorage });
  return data;
});

const { useFieldDraftStore: store } = await import("./use-field-drafts");
const basis = descriptionBasis("adf", fixture.base)!;
const savedBasis = descriptionBasis("adf", fixture.local)!;
const id = fieldDraftId("site-a", "account-a", "DEMO-1", "description#adf");
const wikiId = fieldDraftId("site-a", "account-a", "DEMO-1", "description");
const text = JSON.stringify(fixture.local);
const write = () => store.getState().write(id, text, basis);
const saved = async () => ({ status: "saved" as const, basis: savedBasis });

beforeEach(() => {
  store.setState({ drafts: {}, saving: [] });
  storage.clear();
});

describe("persistierte Beschreibungsbasis und bestehende Revisionslocks", () => {
  it("persistiert die rohe Ausgangsbasis und behält sie bei weiteren Eingaben und Reload", async () => {
    write();
    store.getState().write(id, "neuere Eingabe", descriptionBasis("adf", fixture.remote));
    const raw = storage.get("betterjira-field-drafts")!;
    expect(JSON.parse(raw).state.drafts[id].basis.value).toEqual(fixture.base);
    expect(JSON.parse(raw).state).not.toHaveProperty("saving");
    store.setState({ drafts: {} });
    storage.set("betterjira-field-drafts", raw);
    await store.persist.rehydrate();
    expect(store.getState().drafts[id]).toMatchObject({ text: "neuere Eingabe", basis });
  });

  it("liest Altdrafts unverändert und erfindet beim Weiterbearbeiten keine Basis", async () => {
    const legacy = { text, revision: "legacy" };
    storage.set("betterjira-field-drafts", JSON.stringify({ state: { drafts: { [id]: legacy } }, version: 0 }));
    await store.persist.rehydrate();
    expect(store.getState().drafts[id]).toEqual(legacy);
    store.getState().write(id, "weiterbearbeitet", basis);
    expect(store.getState().drafts[id]).not.toHaveProperty("basis");
  });

  it("trennt dieselbe Beschreibung nach Site, Konto und Ticket", () => {
    write();
    for (const other of [fieldDraftId("site-b", "account-a", "DEMO-1", "description#adf"), fieldDraftId("site-a", "account-b", "DEMO-1", "description#adf"), fieldDraftId("site-a", "account-a", "DEMO-2", "description#adf")]) {
      expect(store.getState().drafts[other]).toBeUndefined();
      store.getState().write(other, "fremder Entwurf");
    }
    expect(store.getState().drafts[id]).toMatchObject({ text, basis });
  });

  it("entfernt nach Erfolg ausschließlich die abgesandte Revision", async () => {
    write();
    store.getState().write("other", "anderer Entwurf");
    expect(await submitFieldDraft(store, id, saved)).toEqual({ status: "saved" });
    expect(store.getState().drafts[id]).toBeUndefined();
    expect(store.getState().drafts.other.text).toBe("anderer Entwurf");
  });

  it.each(["conflict", "unbased"] as const)("erhält bei %s Text, Basis und Revision", async (status) => {
    write();
    const submitted = store.getState().drafts[id];
    const result = await submitFieldDraft(store, id, async () => ({ status, remote: savedBasis, submitted }));
    expect(result.status).toBe(status);
    expect(store.getState().drafts[id]).toBe(submitted);
    expect(store.getState().saving).toEqual([]);
  });

  it.each(["GET offline", "PUT failed"])("erhält bei %s den Entwurf und gibt den Lock für erneuten Vergleich frei", async (message) => {
    write();
    const before = store.getState().drafts[id];
    await expect(submitFieldDraft(store, id, async () => { throw new Error(message); })).rejects.toThrow(message);
    expect(store.getState().drafts[id]).toBe(before);
    expect(store.getState().saving).toEqual([]);
    expect(await submitFieldDraft(store, id, saved)).toEqual({ status: "saved" });
  });

  it("blockiert Doppelaktionen auch über Wiki-/ADF-Editoren mit gemeinsamem Submissionlock", async () => {
    write();
    store.getState().write(wikiId, fixture.wiki.local, descriptionBasis("wiki", fixture.wiki.base));
    let finish: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    const send = vi.fn(async () => { await pending; return saved(); });
    const first = submitFieldDraft(store, id, send, wikiId);
    expect(store.getState().saving).toEqual([wikiId]);
    expect(await submitFieldDraft(store, id, send, wikiId)).toEqual({ status: "busy" });
    expect(await submitFieldDraft(store, wikiId, send, wikiId)).toEqual({ status: "busy" });
    expect(send).toHaveBeenCalledTimes(1);
    finish();
    await first;
    expect(store.getState().saving).toEqual([]);
  });

  it("behält eine während des Writes neuere Revision und bezieht sie auf den bestätigten eigenen Write", async () => {
    write();
    let sent: FieldDraft | undefined;
    const result = await submitFieldDraft(store, id, async (submitted) => {
      sent = submitted;
      store.getState().write(id, "neuere lokale Revision", basis);
      return saved();
    });
    expect(result).toEqual({ status: "newer-draft" });
    expect(store.getState().drafts[id]).toMatchObject({ text: "neuere lokale Revision", basis: savedBasis });
    expect(store.getState().drafts[id].revision).not.toBe(sent?.revision);
  });

  it("löscht auch eine neuere Revision mit identischem Text nicht und rebasiert keine unabhängige Basis", async () => {
    write();
    const before = store.getState().drafts[id];
    store.getState().write(id, text, basis);
    expect(store.getState().complete(id, before, savedBasis)).toBe(false);
    expect(store.getState().drafts[id].text).toBe(text);
    const unrelated = { ...store.getState().drafts[id], basis: descriptionBasis("adf", fixture.remote)! };
    store.setState({ drafts: { [id]: unrelated } });
    expect(store.getState().complete(id, before, savedBasis)).toBe(false);
    expect(store.getState().drafts[id]).toBe(unrelated);
  });

  it("startet ohne Entwurf keine API-Aktion", async () => {
    const send = vi.fn(saved);
    expect(await submitFieldDraft(store, id, send)).toEqual({ status: "missing" });
    expect(send).not.toHaveBeenCalled();
  });
});
