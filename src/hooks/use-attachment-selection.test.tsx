import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Effect, Schema } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AttachmentSelection } from "@/lib/attachment-selection";
import fixture from "../../tests/jira/fixtures/attachment-selection.json";

const mock = vi.hoisted(() => {
  let selection: AttachmentSelection | null = null;
  const latest: { current: AttachmentSelection | null } = { current: null };
  return { jira: vi.fn(), jiraSend: vi.fn(), latest, get selection() { return selection; }, set selection(value: AttachmentSelection | null) { selection = value; } };
});
vi.mock("./use-latest-ref", () => ({ useLatestRef: (value: AttachmentSelection) => { mock.latest.current = value; return mock.latest; } }));
vi.mock("react", async (original) => {
  const actual = await original<typeof import("react")>();
  return { ...actual, useState: <T,>(initial: T | (() => T)) => {
    const state = actual.useState(initial);
    const value = state[0];
    if (typeof value === "object" && value !== null && "context" in value && "selecting" in value && "ids" in value && "confirmation" in value && "results" in value) {
      const selection = Schema.decodeUnknownSync(SelectionState)(mock.selection ?? value);
      mock.selection = selection;
      return [selection, (next: AttachmentSelection | ((current: AttachmentSelection) => AttachmentSelection)) => {
        mock.selection = typeof next === "function" ? next(mock.selection ?? selection) : next;
      }];
    }
    return state;
  } };
});
vi.mock("@/lib/jira/client", async (original) => ({ ...await original<typeof import("@/lib/jira/client")>(), ...mock }));
vi.mock("@/lib/jira/queries", async (original) => ({
  ...await original<typeof import("@/lib/jira/queries")>(),
  useJiraSite: () => ({ isSuccess: true, data: { cloudId: "site", siteName: "Test-Site" } }),
  useJiraMyself: () => ({ isSuccess: true, data: { accountId: "me", displayName: "Test" } }),
}));

const { AttachmentSnapshot } = await import("@/lib/jira/attachment-deletion");
const { useAttachmentSelection } = await import("./use-attachment-selection");
const { jiraKeys } = await import("@/lib/jira/keys");
const files = Schema.decodeUnknownSync(Schema.Array(AttachmentSnapshot))(fixture.attachments);
const ResultState = Schema.Struct({ attachment: AttachmentSnapshot, status: Schema.Literals(["deleted", "failed", "uncertain", "not-attempted"]), message: Schema.String });
const SelectionState = Schema.Struct({ context: Schema.String, selecting: Schema.Boolean, ids: Schema.mutable(Schema.Array(Schema.String)), confirmation: Schema.NullOr(Schema.Array(AttachmentSnapshot)), results: Schema.Array(ResultState) });
let client: QueryClient;
type Model = ReturnType<typeof useAttachmentSelection>;
const account = { cloudId: "site", accountId: "me" };

function Harness({ expose, query = "" }: { expose: (model: Model) => void; query?: string }) {
  expose(useAttachmentSelection("DEMO-1", files, { query, kind: "all", visibleIds: new Set(files.map((file) => file.id)) }));
  return null;
}
const mount = (query = "") => {
  let model: Model | undefined;
  renderToStaticMarkup(<QueryClientProvider client={client}><Harness query={query} expose={(value) => { model = value; }} /></QueryClientProvider>);
  if (!model) throw new Error("selection model missing");
  return model;
};
const choose = () => {
  mount().setSelecting();
  mount().toggle("11");
  mount().toggle("13");
  mount().request();
  return mount();
};
const done = () => vi.waitFor(() => expect(client.isMutating()).toBe(0));

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  client.setQueryData(jiraKeys.site, { cloudId: "site" });
  client.setQueryData(jiraKeys.myself, { accountId: "me" });
  client.setQueryData(jiraKeys.attachmentManagement("DEMO-1", account), { issueKey: "DEMO-1", attachments: files, permissions: { own: true, all: true } });
  mock.selection = null;
  mock.latest.current = null;
  mock.jira.mockReset().mockImplementation((path: string, schema: Schema.Decoder<unknown>) => Schema.decodeUnknownEffect(schema)(path.startsWith("/issue/")
    ? { key: "DEMO-1", fields: { attachment: files } }
    : { permissions: { DELETE_OWN_ATTACHMENTS: { havePermission: true }, DELETE_ALL_ATTACHMENTS: { havePermission: true } } }));
  mock.jiraSend.mockReset().mockReturnValue(Effect.void);
});
afterEach(() => client.clear());

describe("bestaetigter Anhang-Lauf im Auswahlhook", () => {
  it("sendet beim Auswaehlen und Oeffnen der Bestaetigung noch nichts", () => {
    const model = choose();
    expect(model.dialog.open).toBe(true);
    expect(model.dialog.attachments.map((file) => file.id)).toEqual(["11", "13"]);
    expect(model.dialog.accountLabel).toBe("Test · Test-Site");
    expect(mock.jiraSend).not.toHaveBeenCalled();
  });

  it("sperrt Doppelbestaetigung und behaelt Ergebnisse je bestaetigter Datei", async () => {
    const model = choose();
    model.dialog.onConfirm();
    model.dialog.onConfirm();
    await done();
    expect(mock.jiraSend.mock.calls.map(([path]) => path)).toEqual(["/attachment/11", "/attachment/13"]);
    expect(mount().results.map((result) => result.status)).toEqual(["deleted", "deleted"]);
    expect(mount().dialog.open).toBe(false);
    expect(mount().selectedCount).toBe(0);
  });

  it("verwirft Auswahl und Bestaetigung nach Filterwechsel und sendet dabei nichts", () => {
    choose();
    const filtered = mount("png");
    expect(filtered.dialog.open).toBe(false);
    expect(filtered.selectedCount).toBe(0);
    filtered.dialog.onConfirm();
    expect(mock.jiraSend).not.toHaveBeenCalled();
  });

  it("startet unter geaendertem Konto keine Loeschung", async () => {
    const model = choose();
    client.setQueryData(jiraKeys.myself, { accountId: "other" });
    model.dialog.onConfirm();
    await done();
    expect(mock.jiraSend).not.toHaveBeenCalled();
  });

  it("startet keine alte Bestaetigung nach geaenderter Dateiauswahl", () => {
    const model = choose();
    model.toggle("13");
    mount();
    model.dialog.onConfirm();
    expect(mock.jiraSend).not.toHaveBeenCalled();
    expect(client.isMutating()).toBe(0);
  });

  it("setzt einen Lauf nach Filterwechsel und Rueckkehr nicht fort und uebernimmt keine alten Ergebnisse", async () => {
    let finish: () => void = () => undefined;
    mock.jiraSend.mockReturnValue(Effect.promise(() => new Promise<void>((resolve) => { finish = resolve; })));
    choose().dialog.onConfirm();
    await vi.waitFor(() => expect(mock.jiraSend).toHaveBeenCalledOnce());
    mount("png");
    mount();
    finish();
    await done();
    expect(mock.jiraSend).toHaveBeenCalledOnce();
    expect(mount().selectedCount).toBe(0);
    expect(mount().results).toEqual([]);
  });

  it("stoppt nur weitere Writes und behaelt den ersten bestaetigten Erfolg", async () => {
    let finish: () => void = () => undefined;
    mock.jiraSend.mockReturnValue(Effect.promise(() => new Promise<void>((resolve) => { finish = resolve; })));
    const model = choose();
    model.dialog.onConfirm();
    await vi.waitFor(() => expect(mock.jiraSend).toHaveBeenCalledOnce());
    model.toggle("12");
    model.setSelecting();
    model.dialog.onOpenChange(false);
    expect(mock.selection?.confirmation?.map((file) => file.id)).toEqual(["11", "13"]);
    model.dialog.onStop();
    finish();
    await done();
    expect(mock.jiraSend).toHaveBeenCalledOnce();
    expect(mount().results.map((result) => result.status)).toEqual(["deleted", "not-attempted"]);
    expect(mount().selectedIds.has("13")).toBe(true);
  });
});
