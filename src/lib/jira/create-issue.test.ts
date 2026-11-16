import { beforeEach, describe, expect, it, vi } from "vitest";
import { Effect, Schema } from "effect";

const { responses, requests } = vi.hoisted(() => ({
  responses: new Map<string, unknown>(),
  requests: [] as { path: string; init?: RequestInit }[],
}));

vi.mock("./client", async () => {
  const { Effect: E, Schema: S } = await import("effect");
  return {
    jira: (path: string, schema: Schema.Decoder<unknown>, init?: RequestInit) =>
      E.suspend(() => {
        requests.push({ path, init });
        return S.decodeUnknownEffect(schema)(responses.get(path));
      }),
  };
});

const { canCreateIssues, createFields, createIssue, createIssueTypes } = await import("./create-issue");

const META = "/issue/createmeta/10000/issuetypes";

beforeEach(() => {
  responses.clear();
  requests.length = 0;
});

describe("Create-Metadaten", () => {
  it("liest Vorgangstypen seitenweise aus issueTypes", async () => {
    responses.set(`${META}?startAt=0&maxResults=100`, {
      startAt: 0,
      maxResults: 1,
      total: 2,
      issueTypes: [{ id: "1", name: "Aufgabe", subtask: false, self: "x" }],
    });
    responses.set(`${META}?startAt=1&maxResults=100`, {
      startAt: 1,
      maxResults: 1,
      total: 2,
      issueTypes: [{ id: "2", name: "Unteraufgabe", subtask: true }],
    });
    const types = await Effect.runPromise(createIssueTypes("10000"));
    expect(types.map((type) => [type.id, type.subtask])).toEqual([
      ["1", false],
      ["2", true],
    ]);
  });

  it("akzeptiert die alternative Liste createMetaIssueType", async () => {
    responses.set(`${META}?startAt=0&maxResults=100`, { createMetaIssueType: [{ id: "7", name: "Bug" }] });
    expect(await Effect.runPromise(createIssueTypes("10000"))).toEqual([{ id: "7", name: "Bug" }]);
  });

  it("liest Felder aus fields oder results und verwirft fremde Eigenschaften", async () => {
    responses.set(`${META}/7?startAt=0&maxResults=100`, {
      total: 1,
      results: [
        {
          fieldId: "customfield_1",
          key: "customfield_1",
          name: "Kunde",
          required: true,
          hasDefaultValue: false,
          operations: ["set"],
          schema: { type: "option", custom: "select", customId: 1 },
          allowedValues: [{ id: "a", value: "ACME" }],
        },
      ],
    });
    const [field] = await Effect.runPromise(createFields("10000", "7"));
    expect(field).toMatchObject({ fieldId: "customfield_1", required: true, schema: { type: "option" } });
  });

  it("schlägt bei ungültigen Feldmetadaten fehl statt zu raten", async () => {
    responses.set(`${META}/7?startAt=0&maxResults=100`, { fields: [{ fieldId: "x", name: "X" }] });
    await expect(Effect.runPromise(createFields("10000", "7"))).rejects.toBeDefined();
  });

  it("prüft die Create-Berechtigung ausdrücklich", async () => {
    responses.set("/mypermissions?projectId=10000&permissions=CREATE_ISSUES", {
      permissions: { CREATE_ISSUES: { havePermission: false, key: "CREATE_ISSUES" } },
    });
    expect(await Effect.runPromise(canCreateIssues("10000"))).toBe(false);
  });

  it("verwirft eine leere Zwischenseite statt unvollständige Metadaten als vollständig auszugeben", async () => {
    responses.set(`${META}?startAt=0&maxResults=100`, { total: 1, issueTypes: [] });
    await expect(Effect.runPromise(createIssueTypes("10000"))).rejects.toMatchObject({ _tag: "CreateMetadataError" });
  });

  it("meldet das Seitenlimit statt einen abgeschnittenen Feld-/Typbestand anzuwenden", async () => {
    for (let startAt = 0; startAt < 20; startAt++) responses.set(`${META}?startAt=${startAt}&maxResults=100`, { total: 21, issueTypes: [{ id: String(startAt), name: "Typ" }] });
    await expect(Effect.runPromise(createIssueTypes("10000"))).rejects.toMatchObject({ _tag: "CreateMetadataError" });
    expect(requests).toHaveLength(20);
  });

  it("bindet Metadatenreads an den Requestscope und umgeht den HTTP-Cache", async () => {
    responses.set(`${META}?startAt=0&maxResults=100`, { total: 1, issueTypes: [{ id: "7", name: "Bug" }] });
    const scope = { cloudId: "site", isCurrent: () => true };
    await Effect.runPromise(createIssueTypes("10000", scope));
    expect(requests[0].init).toMatchObject({ scope, cache: "no-store" });
  });
});

describe("createIssue", () => {
  it("sendet genau einen POST und validiert die Antwort", async () => {
    responses.set("/issue", { id: "10001", key: "DEMO-9", self: "https://example/rest/api/3/issue/10001", transition: {} });
    const created = await Effect.runPromise(createIssue({ fields: { summary: "Neu" } }));
    expect(created).toEqual({ id: "10001", key: "DEMO-9", self: "https://example/rest/api/3/issue/10001" });
    expect(requests).toHaveLength(1);
    expect(requests[0]!.init?.method).toBe("POST");
  });

  it("meldet eine unerwartete Schreibantwort als eigenen Fehler", async () => {
    responses.set("/issue", { ok: true });
    const result = await Effect.runPromise(Effect.flip(createIssue({ fields: {} })));
    expect(result._tag).toBe("CreateIssueResponseError");
  });
});
