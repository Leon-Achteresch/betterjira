import { Effect, Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../../tests/jira/fixtures/attachment-selection.json";

const mock = vi.hoisted(() => ({ jira: vi.fn(), jiraSend: vi.fn() }));
vi.mock("./client", async (original) => ({ ...await original<typeof import("./client")>(), ...mock }));
const { deleteAttachmentSelection, AttachmentSnapshot, canDeleteAttachment } = await import("./attachment-deletion");
const { JiraApiError, JiraAuthError, JiraRequestScopeChanged } = await import("./client");
const files = Schema.decodeUnknownSync(Schema.Array(AttachmentSnapshot))(fixture.attachments);
let available: readonly typeof files[number][];
let permissions: { own: boolean; all: boolean };
let current: boolean;
const scope = { cloudId: "site", isCurrent: () => current };
const remove = (selected = files) => Effect.runPromise(deleteAttachmentSelection("DEMO-1", selected, "me", scope));

beforeEach(() => {
  available = files;
  permissions = { own: true, all: true };
  current = true;
  mock.jira.mockReset().mockImplementation((path: string, schema: Schema.Decoder<unknown>) => Effect.suspend(() => Schema.decodeUnknownEffect(schema)(
    path.startsWith("/issue/") ? { key: "DEMO-1", fields: { attachment: available } }
      : { permissions: { DELETE_OWN_ATTACHMENTS: { havePermission: permissions.own }, DELETE_ALL_ATTACHMENTS: { havePermission: permissions.all } } },
  )));
  mock.jiraSend.mockReset().mockReturnValue(Effect.void);
});

describe("bewusst ausgewaehlte Anhaenge entfernen", () => {
  it("loescht ausschliesslich die bestaetigten IDs nach frischem Ticket-/Rechte-Read, ohne Auto-Retry", async () => {
    const result = await remove([files[0], files[2]]);
    expect(result.map((entry) => entry.status)).toEqual(["deleted", "deleted"]);
    expect(mock.jiraSend.mock.calls.map(([path]) => path)).toEqual(["/attachment/11", "/attachment/13"]);
    expect(mock.jira.mock.calls.every((call) => call[2].cache === "no-store" && call[2].scope === scope)).toBe(true);
    expect(mock.jiraSend.mock.calls.every((call) => call[1].method === "DELETE" && call[1].retry === false && call[1].scope === scope)).toBe(true);
    expect(mock.jiraSend.mock.invocationCallOrder[0]).toBeGreaterThan(Math.max(...mock.jira.mock.invocationCallOrder));
  });

  it("sendet doppelte IDs nur einmal und verwechselt gleiche Dateinamen nicht", async () => {
    await remove([files[0], files[0], files[1]]);
    expect(mock.jiraSend.mock.calls.map(([path]) => path)).toEqual(["/attachment/11", "/attachment/12"]);
  });

  it("prueft OWN/ALL-Rechte anhand frischer Autoren und nimmt fehlende Autoren nicht als eigene an", async () => {
    permissions = { own: true, all: false };
    const result = await remove();
    expect(result.map((entry) => entry.status)).toEqual(["deleted", "failed", "deleted"]);
    expect(mock.jiraSend.mock.calls.map(([path]) => path)).toEqual(["/attachment/11", "/attachment/13"]);
    expect(canDeleteAttachment({ ...files[0], author: undefined }, permissions, "me")).toBe(false);
    expect(canDeleteAttachment(files[0], undefined, "me")).toBe(false);
  });

  it("schreibt bei entzogenen Rechten nichts", async () => {
    permissions = { own: false, all: false };
    expect((await remove()).every((entry) => entry.status === "failed")).toBe(true);
    expect(mock.jiraSend).not.toHaveBeenCalled();
  });

  it("loescht weder fremde Ticket-IDs noch seit der Bestaetigung veraenderte Dateien", async () => {
    available = [{ ...files[0], filename: "neu.png" }, files[1]];
    expect((await remove([files[0], files[2]])).map((entry) => entry.status)).toEqual(["not-attempted", "not-attempted"]);
    expect(mock.jiraSend).not.toHaveBeenCalled();
  });

  it.each(["issue", "permissions"])("weist bei gescheitertem %s-Read jede Datei als nicht gesendet aus", async (part) => {
    const handler = mock.jira.getMockImplementation()!;
    mock.jira.mockImplementation((path: string, schema: Schema.Decoder<unknown>, init: unknown) => path.includes(part === "issue" ? "/issue/" : "/mypermissions")
      ? Effect.fail(new JiraApiError({ status: 403, body: "blocked" })) : handler(path, schema, init));
    expect((await remove()).every((entry) => entry.status === "not-attempted")).toBe(true);
    expect(mock.jiraSend).not.toHaveBeenCalled();
  });

  it("behaelt Teilerfolge und meldet abgelehnte Dateien getrennt", async () => {
    mock.jiraSend.mockImplementation((path: string) => path.endsWith("/12") ? Effect.fail(new JiraApiError({ status: 403, body: "no permission" })) : Effect.void);
    const result = await remove();
    expect(result.map((entry) => entry.status)).toEqual(["deleted", "failed", "deleted"]);
    expect(result[1].message).toContain("403");
  });

  it.each([500, 408])("nennt HTTP %s unklar statt geloescht und wiederholt den Write nicht", async (status) => {
    mock.jiraSend.mockReturnValue(Effect.fail(new JiraApiError({ status, body: "unknown" })));
    expect((await remove([files[0]]))[0].status).toBe("uncertain");
    expect(mock.jiraSend).toHaveBeenCalledTimes(1);
  });

  it("behandelt Verbindungsabbruch als unklar und liest vor neuem bestaetigtem Versuch erneut", async () => {
    mock.jiraSend.mockReturnValue(Effect.fail(new JiraAuthError({ message: "connection lost" })));
    expect((await remove([files[0]]))[0].status).toBe("uncertain");
    available = [];
    expect((await remove([files[0]]))[0].status).toBe("not-attempted");
    expect(mock.jiraSend).toHaveBeenCalledTimes(1);
    expect(mock.jira).toHaveBeenCalledTimes(4);
  });

  it("stoppt noch nicht gesendete Dateien nach Kontextwechsel oder Stoppen und erhaelt bestaetigte Erfolge", async () => {
    const progress: string[] = [];
    const result = await Effect.runPromise(deleteAttachmentSelection("DEMO-1", files, "me", scope, (entry) => {
      progress.push(entry.status);
      if (entry.status === "deleted") current = false;
    }));
    expect(progress).toEqual(["deleted", "not-attempted", "not-attempted"]);
    expect(result.map((entry) => entry.status)).toEqual(progress);
    expect(mock.jiraSend).toHaveBeenCalledTimes(1);
  });

  it("sendet bei initial falschem Scope und leerer Menge keine Requests", async () => {
    expect(await remove([])).toEqual([]);
    current = false;
    await expect(remove()).rejects.toMatchObject({ _tag: "AttachmentContextChanged" });
    expect(mock.jira).not.toHaveBeenCalled();
    expect(mock.jiraSend).not.toHaveBeenCalled();
  });

  it("deklariert einen vor dem Write verweigerten Scope nicht als geloescht", async () => {
    mock.jiraSend.mockReturnValue(Effect.fail(new JiraRequestScopeChanged()));
    expect((await remove([files[0]]))[0].status).toBe("not-attempted");
  });
});
