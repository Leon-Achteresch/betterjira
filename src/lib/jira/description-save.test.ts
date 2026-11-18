import { Effect, Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../../tests/jira/fixtures/description-conflict.json";
import { descriptionBasis } from "../description-comparison";
import type { DescriptionSaveInput } from "./description-save";

const { jira, jiraSend } = vi.hoisted(() => ({ jira: vi.fn(), jiraSend: vi.fn() }));
vi.mock("./client", async (original) => ({ ...await original<typeof import("./client")>(), jira, jiraSend }));
const { JiraApiError } = await import("./client");
const { saveDescription, readDescription, DescriptionSaveError } = await import("./description-save");

const target = { id: "1", key: "DEMO-1" };
let remote: unknown;
let identity: typeof target;
const draft = () => ({ text: JSON.stringify(fixture.local), revision: "revision-1", basis: descriptionBasis("adf", fixture.base)! });
const save = (input: DescriptionSaveInput = { draft: draft(), format: "adf" }) => Effect.runPromise(saveDescription(target, input));

beforeEach(() => {
  remote = fixture.base;
  identity = target;
  jira.mockReset().mockImplementation((_path: string, schema: Schema.Decoder<unknown>) => Effect.suspend(() =>
    Schema.decodeUnknownEffect(schema)({ ...identity, fields: { description: remote }, updated: "changed-unrelated-field" }),
  ));
  jiraSend.mockReset().mockReturnValue(Effect.void);
});

describe("frischer Beschreibungsabgleich vor Write", () => {
  it("liest nur das Rohfeld ohne Cache und schreibt unveränderten lokalen Inhalt nach gleicher Basis", async () => {
    const input = draft();
    input.text = JSON.stringify(fixture.base);
    const result = await save({ draft: input, format: "adf" });
    expect(result.status).toBe("saved");
    expect(jira).toHaveBeenCalledWith("/issue/DEMO-1?fields=description", expect.anything(), { cache: "no-store", retry: false, scope: undefined }, "api/3");
    expect(jiraSend.mock.calls[0][0]).toBe("/issue/1");
    expect(jiraSend.mock.calls[0][1]).toMatchObject({ method: "PUT", retry: false, maxRedirections: 0 });
    expect(JSON.parse(jiraSend.mock.calls[0][1].body)).toEqual({ fields: { description: fixture.base } });
    expect(jira.mock.invocationCallOrder[0]).toBeLessThan(jiraSend.mock.invocationCallOrder[0]);
  });

  it("blockiert Client A bei A→R und liefert beide originalen Fassungen für die UI", async () => {
    remote = fixture.remote;
    const result = await save();
    expect(result).toEqual({ status: "conflict", remote: descriptionBasis("adf", fixture.remote), submitted: draft() });
    expect(jiraSend).not.toHaveBeenCalled();
  });

  it("liest bei bestätigter Übernahme nochmals und hält R→R2 erneut an", async () => {
    remote = fixture.remote;
    const first = await save();
    if (first.status === "saved") throw new Error("expected conflict");
    remote = fixture.remote2;
    const second = await Effect.runPromise(saveDescription(target, { draft: draft(), format: "adf", reviewed: first.remote }));
    expect(second).toMatchObject({ status: "conflict", remote: { value: fixture.remote2 } });
    expect(jira).toHaveBeenCalledTimes(2);
    expect(jiraSend).not.toHaveBeenCalled();
    if (second.status === "saved") throw new Error("expected conflict");
    await Effect.runPromise(saveDescription(target, { draft: draft(), format: "adf", reviewed: second.remote }));
    expect(jira).toHaveBeenCalledTimes(3);
    expect(jiraSend).toHaveBeenCalledTimes(1);
  });

  it("blockiert einen Altdraft ohne Basis und übernimmt keine aktuelle Fassung als alte Basis", async () => {
    const legacy = { text: JSON.stringify(fixture.local), revision: "legacy" };
    const result = await save({ draft: legacy, format: "adf" });
    expect(result).toMatchObject({ status: "unbased", submitted: legacy });
    expect(legacy).not.toHaveProperty("basis");
    expect(jiraSend).not.toHaveBeenCalled();
  });

  it.each([401, 403, 500])("schreibt bei GET-Fehler %s nicht", async (status) => {
    jira.mockReturnValue(Effect.fail(new DescriptionSaveError({ message: `HTTP ${status}` })));
    await expect(save()).rejects.toThrow(`HTTP ${status}`);
    expect(jiraSend).not.toHaveBeenCalled();
  });

  it("prüft nach einem Write-Fehler beim Retry erneut und erkennt Fremdänderungen", async () => {
    jiraSend.mockReturnValueOnce(Effect.fail(new DescriptionSaveError({ message: "write failed" })));
    await expect(save()).rejects.toThrow("write failed");
    remote = fixture.remote;
    expect((await save()).status).toBe("conflict");
    expect(jira).toHaveBeenCalledTimes(2);
    expect(jiraSend).toHaveBeenCalledTimes(1);
  });

  it("benutzt für Wiki GET und Write ausschließlich API v2 und erhält Syntax", async () => {
    remote = fixture.wiki.base;
    identity = { ...target, key: "A/B" };
    const input = { draft: { text: fixture.wiki.local, revision: "wiki", basis: descriptionBasis("wiki", fixture.wiki.base)! }, format: "wiki" as const };
    expect((await Effect.runPromise(saveDescription(identity, input))).status).toBe("saved");
    expect(jira.mock.calls[0][0]).toBe("/issue/A%2FB?fields=description");
    expect(jira.mock.calls[0][3]).toBe("api/2");
    expect(jiraSend.mock.calls[0][2]).toBe("api/2");
    expect(JSON.parse(jiraSend.mock.calls[0][1].body).fields.description).toBe(fixture.wiki.local);
    remote = fixture.wiki.remote;
    expect((await Effect.runPromise(saveDescription(identity, input))).status).toBe("conflict");
    expect(jiraSend).toHaveBeenCalledTimes(1);
  });

  it("behandelt fehlende oder falsche Serverwerte als Fehler statt als leere Beschreibung", async () => {
    remote = 17;
    await expect(save()).rejects.toThrow("originalgetreu");
    jira.mockImplementation((_path: string, schema: Schema.Decoder<unknown>) => Schema.decodeUnknownEffect(schema)({ fields: {} }));
    await expect(Effect.runPromise(readDescription(target, "wiki"))).rejects.toBeDefined();
    expect(jiraSend).not.toHaveBeenCalled();
  });

  it("reicht denselben Requestscope an frischen Read und Write durch", async () => {
    const scope = { cloudId: "test-cloud", isCurrent: () => true };
    await Effect.runPromise(saveDescription(target, { draft: draft(), format: "adf" }, scope));
    expect(jira.mock.calls[0][2].scope).toBe(scope);
    expect(jiraSend.mock.calls[0][1].scope).toBe(scope);
  });

  it.each([{ id: "2", key: target.key }, { ...target, key: "MOVED-1" }])("lehnt einen anderen Schlüssel oder eine andere Jira-ID ab (%j)", async (other) => {
    identity = other;
    await expect(save()).rejects.toThrow("geöffnete Ticket nicht mehr");
    expect(jiraSend).not.toHaveBeenCalled();
  });

  it("verwirft eine erfolgreiche späte Antwort auf den letzten Read nach der Medienvorbereitung", async () => {
    let active = true;
    const scope = { cloudId: "test-cloud", isCurrent: () => active };
    jira.mockImplementationOnce(() => Effect.succeed({ ...target, fields: { description: fixture.base } }));
    jira.mockImplementationOnce(() => Effect.sync(() => {
      active = false;
      return { ...target, fields: { description: fixture.base } };
    }));
    await expect(Effect.runPromise(saveDescription(target, { draft: draft(), format: "adf" }, scope, Effect.succeed)))
      .rejects.toMatchObject({ _tag: "JiraRequestScopeChanged" });
    expect(jira).toHaveBeenCalledTimes(2);
    expect(jiraSend).not.toHaveBeenCalled();
  });

  it.each([false, true])("liest nach 409 nochmals, ohne den PUT zu wiederholen (%s)", async (descriptionChanged) => {
    jiraSend.mockReturnValue(Effect.suspend(() => {
      if (descriptionChanged) remote = fixture.remote;
      return Effect.fail(new JiraApiError({ status: 409, body: "Conflict" }));
    }));
    if (descriptionChanged) await expect(save()).resolves.toMatchObject({ status: "conflict", remote: { value: fixture.remote } });
    else await expect(save()).rejects.toThrow("entspricht der geprüften Fassung");
    expect(jira).toHaveBeenCalledTimes(2);
    expect(jiraSend).toHaveBeenCalledTimes(1);
  });

  it("bereitet bei Konflikten keine Medien vor und revalidiert nach langsamer Vorbereitung", async () => {
    const prepare = vi.fn(() => Effect.sync(() => { remote = fixture.remote; return fixture.local; }));
    remote = fixture.remote;
    await Effect.runPromise(saveDescription(target, { draft: draft(), format: "adf" }, undefined, prepare));
    expect(prepare).not.toHaveBeenCalled();
    remote = fixture.base;
    const result = await Effect.runPromise(saveDescription(target, { draft: draft(), format: "adf" }, undefined, prepare));
    expect(result).toMatchObject({ status: "conflict", remote: { value: fixture.remote } });
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(jiraSend).not.toHaveBeenCalled();
  });
});
