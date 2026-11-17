import { Effect, Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { planTableFieldPreview, previewTableField, TABLE_FIELD_LIMITS } from "./table-field-preview";
import { JiraApiError } from "./client";

const mock = vi.hoisted(() => ({ jira: vi.fn(), jiraSend: vi.fn() }));
vi.mock("./client", async (original) => ({ ...await original<typeof import("./client")>(), ...mock }));

const targets = Array.from({ length: 14 }, (_, index) => ({ id: String(index + 1), key: `DEMO-${index + 1}` }));
const scope = { cloudId: "site", isCurrent: () => true };
const plan = (input: string, selection = targets) => {
  const parsed = planTableFieldPreview(input, selection);
  if ("error" in parsed) throw new Error(parsed.error);
  return parsed;
};

beforeEach(() => {
  mock.jira.mockReset().mockImplementation((path: string, schema: Schema.Decoder<unknown>) => Effect.suspend((): Effect.Effect<unknown, JiraApiError | Schema.SchemaError> => {
    const url = new URL(path, "https://example.invalid");
    const key = url.searchParams.get("issueKey") ?? url.pathname.split("/")[2];
    const target = targets.find((issue) => issue.key === key);
    if (!target || key === "DEMO-5") return Effect.fail(new JiraApiError({ status: 404, body: "" }));
    if (key === "DEMO-6") return Effect.fail(new JiraApiError({ status: 403, body: "" }));
    if (key === "DEMO-7") return Effect.fail(new JiraApiError({ status: 503, body: "" }));
    if (path.endsWith("/editmeta")) return Schema.decodeUnknownEffect(schema)(key === "DEMO-4" ? { fields: {} } : { fields: { duedate: { operations: ["set"] } } });
    if (url.pathname === "/mypermissions") {
      const permitted = { havePermission: true };
      return Schema.decodeUnknownEffect(schema)({ permissions: {
        EDIT_ISSUES: key === "DEMO-12" ? { havePermission: false } : permitted,
        SCHEDULE_ISSUES: key === "DEMO-3" ? { havePermission: false } : permitted,
      } });
    }
    return Schema.decodeUnknownEffect(schema)({
      id: key === "DEMO-9" ? "different" : target.id,
      key: key === "DEMO-8" ? "MOVED-8" : key,
      fields: {
        project: { id: "project" }, issuetype: { id: "task" },
        ...(key !== "DEMO-10" && { duedate: key === "DEMO-1" ? null : key === "DEMO-11" ? "2026-02-30" : "2026-12-18" }),
      },
    });
  }));
  mock.jiraSend.mockReset();
});

describe("Tabellenwerte für exakte vorhandene Tickets", () => {
  it("ordnet mit TSV-Zitierung exakt zu und fasst keine abgewiesene Zeile an", async () => {
    const input = [
      '"DEMO-1"\t"2028-02-29"', "DEMO-2\t", "DEMO-3", "DEMO-4\t2027-02-29",
      "DEMO-5\t2026-12-17\tzweiter Wert", "\t2026-12-18", "demo-6\t2026-12-18",
      "OPS-7\t2026-12-18", "DEMO-8\t2026-12-18", "DEMO-8\t2026-12-19",
      'DEMO-9\t"2026-12-18\nDEMO-10\t2026-12-18"', "DEMO-11\t2026-12-18",
    ].join("\r\n");
    const result = await Effect.runPromise(previewTableField(plan(input, [...targets, { key: "DEMO-11", id: "ambiguous" }]), scope));
    expect(result.rows.map(({ status }) => status)).toEqual([
      "change", "missing-value", "missing-value", "invalid-date", "columns", "missing-key", "invalid-key",
      "outside-selection", "duplicate", "duplicate", "invalid-date", "ambiguous",
    ]);
    expect(result.rows[0]).toMatchObject({ line: 1, key: "DEMO-1", before: null, value: "2028-02-29" });
    expect(result.unmatched).toBe(6);
    expect(mock.jira.mock.calls.map(([path]) => path)).toEqual([
      "/issue/DEMO-1?fields=duedate,project,issuetype",
      "/mypermissions?issueKey=DEMO-1&permissions=EDIT_ISSUES%2CSCHEDULE_ISSUES",
      "/issue/DEMO-1/editmeta",
    ]);
    expect(mock.jira.mock.calls.every(([, , init]) => init.cache === "no-store" && init.scope === scope && !init.method)).toBe(true);
    expect(mock.jiraSend).not.toHaveBeenCalled();
  });

  it("unterscheidet alte Werte, nicht lieferbare Tickets, identitätsfremde Treffer, Rechte und Metadaten", async () => {
    const input = targets.slice(0, 12).map(({ key }) => `${key}\t2026-12-18`).join("\n");
    const result = await Effect.runPromise(previewTableField(plan(input), scope));
    expect(result.rows.map(({ status }) => status)).toEqual([
      "change", "unchanged", "forbidden", "unsupported", "missing-issue", "forbidden",
      "read-error", "different-issue", "different-issue", "missing-current", "invalid-current", "forbidden",
    ]);
    expect(result.rows[1]?.before).toBe("2026-12-18");
    expect(result.rows[3]?.before).toBe("2026-12-18");
    expect(mock.jira.mock.calls.map(([path]) => path)).not.toContain("/issue/DEMO-8/editmeta");
    expect(mock.jiraSend).not.toHaveBeenCalled();
  });

  it.each([
    ['"unterminiert\nDEMO-1\t2026-12-18', /Zeile 1/],
    ["X".repeat(TABLE_FIELD_LIMITS.characters + 1), /12.000 Zeichen/],
    [Array(TABLE_FIELD_LIMITS.rows + 1).fill("DEMO-1\t2026-12-18").join("\n"), /20 Zeilen/],
  ])("verwirft strukturell unsichere oder übergroße Eingabe vor Jira-Zugriff", (input, error) => {
    expect(planTableFieldPreview(input, targets)).toEqual({ error: expect.stringMatching(error) });
    expect(mock.jira).not.toHaveBeenCalled();
    expect(mock.jiraSend).not.toHaveBeenCalled();
  });
});
