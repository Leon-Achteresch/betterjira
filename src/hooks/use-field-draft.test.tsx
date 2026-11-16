import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Effect, Schema } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../tests/jira/fixtures/description-conflict.json";

const mock = vi.hoisted(() => {
  const data = new Map<string, string>();
  const localStorage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) };
  vi.stubGlobal("window", { localStorage });
  return { jira: vi.fn(), jiraSend: vi.fn(), close: vi.fn() };
});
vi.mock("@/lib/jira/client", async (original) => ({ ...await original<typeof import("@/lib/jira/client")>(), currentSite: Effect.succeed({ cloudId: "site-a" }), jira: mock.jira, jiraSend: mock.jiraSend }));
vi.mock("@/lib/jira/queries", async (original) => ({
  ...await original<typeof import("@/lib/jira/queries")>(),
  useJiraSite: () => ({ data: { cloudId: "site-a" } }),
  useJiraMyself: () => ({ data: { accountId: "account-a" } }),
}));
vi.mock("@/lib/jira/mutation-cache", () => ({ invalidateIssueChange: vi.fn() }));

const { useFieldDraft } = await import("./use-field-draft");
const { useFieldDraftStore: store } = await import("./use-field-drafts");
const { fieldDraftId } = await import("@/lib/field-draft");
const { jiraKeys } = await import("@/lib/jira/keys");
const { DescriptionSaveError } = await import("@/lib/jira/description-save");

type Options = Parameters<typeof useFieldDraft>[0];
type Editor = ReturnType<typeof useFieldDraft>;
let client: QueryClient;
let remote: unknown;

function Harness({ options, expose }: { options: Options; expose: (editor: Editor) => void }) {
  expose(useFieldDraft(options));
  return null;
}

const mount = (overrides: Partial<Options> = {}) => {
  let captured: Editor | undefined;
  renderToString(<QueryClientProvider client={client}><Harness options={{ issueKey: "DEMO-1", field: "description", initial: JSON.stringify(fixture.base), initialRaw: fixture.base, mode: "adf", onClose: mock.close, ...overrides }} expose={(editor) => { captured = editor; }} /></QueryClientProvider>);
  if (!captured) throw new Error("editor missing");
  return captured;
};

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  client.setQueryData(jiraKeys.site, { cloudId: "site-a" });
  client.setQueryData(jiraKeys.myself, { accountId: "account-a" });
  store.setState({ drafts: {}, saving: [] });
  remote = fixture.base;
  mock.close.mockReset();
  mock.jira.mockReset().mockImplementation((_path: string, schema: Schema.Decoder<unknown>) => Schema.decodeUnknownEffect(schema)({ fields: { description: remote } }));
  mock.jiraSend.mockReset().mockReturnValue(Effect.void);
});
afterEach(() => client.clear());

describe("C1 im bestehenden Feldeditorfluss", () => {
  it("erfasst die rohe Basis beim Edit und speichert über frischen Read statt direkter Feldmutation", async () => {
    const editor = mount();
    editor.setText(JSON.stringify(fixture.local));
    const id = fieldDraftId("site-a", "account-a", "DEMO-1", "description#adf");
    expect(store.getState().drafts[id].basis?.value).toEqual(fixture.base);
    await editor.submit();
    expect(mock.jira).toHaveBeenCalledTimes(1);
    expect(mock.jiraSend).toHaveBeenCalledTimes(1);
    expect(store.getState().drafts[id]).toBeUndefined();
    expect(mock.close).toHaveBeenCalledOnce();
  });

  it("blockiert Fremdänderung und wiederholtes Speichern ohne bewusste Vergleichsübernahme", async () => {
    const editor = mount();
    editor.setText(JSON.stringify(fixture.local));
    remote = fixture.remote;
    await editor.submit();
    await editor.submit();
    expect(mock.jira).toHaveBeenCalledTimes(2);
    expect(mock.jiraSend).not.toHaveBeenCalled();
    expect(mock.close).not.toHaveBeenCalled();
    expect(Object.values(store.getState().drafts)[0].text).toBe(JSON.stringify(fixture.local));
  });

  it("schreibt bei fehlender Altdraftbasis oder GET-Fehler nicht und erhält den Entwurf", async () => {
    const id = fieldDraftId("site-a", "account-a", "DEMO-1", "description#adf");
    store.getState().write(id, JSON.stringify(fixture.local));
    const editor = mount();
    await editor.submit();
    mock.jira.mockReturnValue(Effect.fail(new DescriptionSaveError({ message: "offline" })));
    await editor.submit();
    expect(mock.jiraSend).not.toHaveBeenCalled();
    expect(store.getState().drafts[id]).not.toHaveProperty("basis");
    expect(mock.close).not.toHaveBeenCalled();
  });

  it("sichert im Wiki-Editor null als Rohbasis und schreibt Wiki über API v2", async () => {
    remote = null;
    const editor = mount({ mode: "wiki", initial: "", initialRaw: null });
    editor.setText(fixture.wiki.local);
    await editor.submit();
    expect(mock.jira.mock.calls[0][3]).toBe("api/2");
    expect(mock.jiraSend.mock.calls[0][2]).toBe("api/2");
    expect(mock.close).toHaveBeenCalledOnce();
  });

  it("blockiert zwei direkte Aktionen während desselben Submits", async () => {
    const editor = mount();
    editor.setText(JSON.stringify(fixture.local));
    await Promise.all([editor.submit(), editor.submit()]);
    expect(mock.jira).toHaveBeenCalledTimes(1);
    expect(mock.jiraSend).toHaveBeenCalledTimes(1);
  });

  it("erhält eine neuere lokale Revision während eines laufenden Writes", async () => {
    let finish: () => void = () => undefined;
    mock.jiraSend.mockReturnValue(Effect.promise(() => new Promise<void>((resolve) => { finish = resolve; })));
    const editor = mount();
    editor.setText(JSON.stringify(fixture.local));
    const saving = editor.submit();
    await vi.waitFor(() => expect(mock.jiraSend).toHaveBeenCalledOnce());
    editor.setText(JSON.stringify(fixture.remote2));
    finish();
    await saving;
    const remaining = Object.values(store.getState().drafts)[0];
    expect(remaining.text).toBe(JSON.stringify(fixture.remote2));
    expect(remaining.basis?.value).toEqual(fixture.local);
    expect(mock.close).not.toHaveBeenCalled();
  });

  it("belässt andere Textfelder im vorhandenen Speicherpfad", async () => {
    const editor = mount({ field: "summary", mode: "text", initial: "Alter Titel" });
    editor.setText("Neuer Titel");
    await editor.submit();
    expect(mock.jira).not.toHaveBeenCalled();
    expect(JSON.parse(mock.jiraSend.mock.calls[0][1].body)).toEqual({ fields: { summary: "Neuer Titel" } });
    expect(mock.close).toHaveBeenCalledOnce();
  });
});
