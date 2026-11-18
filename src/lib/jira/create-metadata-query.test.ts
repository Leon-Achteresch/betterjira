import { QueryClient } from "@tanstack/react-query";
import { Effect, Schema } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../../tests/jira/fixtures/template-target.json";
import { jiraKeys } from "./keys";

const api = vi.hoisted(() => ({ canCreateIssues: vi.fn(), createIssueTypes: vi.fn(), createFields: vi.fn() }));
vi.mock("./create-issue", async (original) => ({ ...await original<typeof import("./create-issue")>(), ...api }));
vi.mock("./client", async (original) => ({ ...await original<typeof import("./client")>(), currentSite: Effect.succeed({ cloudId: "site" }) }));
const { freshTemplateTarget, createFieldsQuery, createTypesQuery, createPermissionQuery, TemplateTargetError } = await import("./create-metadata-query");
const { CreateField } = await import("./create-issue");
const fields = Schema.decodeUnknownSync(Schema.Array(CreateField))(fixture.fields);
const account = { cloudId: "site", accountId: "me" };
const target = { projectId: "target", issueTypeId: "target-type" };
let client: QueryClient;

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  client.setQueryData(jiraKeys.site, { cloudId: "site" });
  client.setQueryData(jiraKeys.myself, { accountId: "me" });
  api.canCreateIssues.mockReset().mockReturnValue(Effect.succeed(true));
  api.createIssueTypes.mockReset().mockReturnValue(Effect.succeed([{ id: "target-type", name: "Task" }]));
  api.createFields.mockReset().mockReturnValue(Effect.succeed(fields));
});
afterEach(() => client.clear());

describe("frische ziel-/kontogebundene Vorlagenmetadaten", () => {
  it("verwendet trotz Cache frische Zielrechte, Typen und Felder", async () => {
    client.setQueryData(createPermissionQuery(client, "target", account).queryKey, true);
    client.setQueryData(createTypesQuery(client, "target", account).queryKey, [{ id: "old-type", name: "Alt" }]);
    client.setQueryData(createFieldsQuery(client, "target", "target-type", account).queryKey, []);
    const result = await freshTemplateTarget(client, account, target);
    expect(result.plan.inputs.map(({ field }) => field.fieldId)).toContain("customer");
    expect(api.canCreateIssues).toHaveBeenCalledOnce();
    expect(api.createIssueTypes).toHaveBeenCalledOnce();
    expect(api.createFields).toHaveBeenCalledOnce();
    expect(api.createFields.mock.calls[0].slice(0, 2)).toEqual(["target", "target-type"]);
  });

  it("wendet bei verweigerter Zielberechtigung nichts an und lädt keine Felder", async () => {
    api.canCreateIssues.mockReturnValue(Effect.succeed(false));
    await expect(freshTemplateTarget(client, account, target)).rejects.toThrow("Berechtigung");
    expect(api.createIssueTypes).not.toHaveBeenCalled();
    expect(api.createFields).not.toHaveBeenCalled();
  });

  it("ersetzt einen entfernten Zieltyp nicht durch den ersten anderen Typ", async () => {
    api.createIssueTypes.mockReturnValue(Effect.succeed([{ id: "other", name: "Anderer Typ" }]));
    await expect(freshTemplateTarget(client, account, target)).rejects.toThrow("nicht mehr verfügbar");
    expect(api.createFields).not.toHaveBeenCalled();
  });

  it("akzeptiert keinen normalen Typ als Unteraufgabentyp", async () => {
    await expect(freshTemplateTarget(client, account, { ...target, parentKey: "DEMO-1" })).rejects.toThrow("nicht mehr verfügbar");
  });

  it.each([{ data: [] }, { data: fields.filter((field) => field.fieldId !== "summary") }])("lehnt unvollständige Zielfeldmetadaten ab", async ({ data }) => {
    api.createFields.mockReturnValue(Effect.succeed(data));
    await expect(freshTemplateTarget(client, account, target)).rejects.toThrow("kein Titelfeld");
  });

  it("behält Fehler beim Metadatenlesen als Fehler statt alte Werte zu verwenden", async () => {
    api.createFields.mockReturnValue(Effect.fail(new TemplateTargetError({ message: "offline" })));
    await expect(freshTemplateTarget(client, account, target)).rejects.toThrow("offline");
  });

  it("isoliert Cacheeinträge nach Site, Konto, Projekt und Typ", () => {
    const key = createFieldsQuery(client, "target", "target-type", account).queryKey;
    client.setQueryData(key, [...fields]);
    for (const [projectId, typeId, scope] of [
      ["target", "target-type", { ...account, accountId: "other" }],
      ["target", "target-type", { ...account, cloudId: "other" }],
      ["other", "target-type", account], ["target", "other", account],
    ] as const) expect(client.getQueryData(createFieldsQuery(client, projectId, typeId, scope).queryKey)).toBeUndefined();
  });

  it("verwirft die Antwort bei Kontowechsel während der Prüfung", async () => {
    api.canCreateIssues.mockReturnValue(Effect.sync(() => {
      client.setQueryData(jiraKeys.myself, { accountId: "other" });
      return true;
    }));
    await expect(freshTemplateTarget(client, account, target)).rejects.toMatchObject({ _tag: "JiraQueryScopeChanged" });
    expect(api.createFields).not.toHaveBeenCalled();
  });
});
