import { Effect, Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../../tests/jira/fixtures/due-date-shift.json";

const mock = vi.hoisted(() => ({ jira: vi.fn(), jiraSend: vi.fn() }));
vi.mock("./client", async (original) => ({ ...await original<typeof import("./client")>(), ...mock }));
const { applyDueDateShift, previewDueDateShift, DueDateIssue } = await import("./due-date-shift");
const { JiraApiError, JiraAuthError } = await import("./client");
let issues = Schema.decodeUnknownSync(Schema.Array(DueDateIssue))(fixture.issues);
let writable: Set<string>;
let schedulable: Set<string>;
let current: boolean;
const scope = { cloudId: "site", isCurrent: () => current };
const keys = fixture.issues.map((issue) => issue.key);
const preview = (targets = keys, days = 2) => Effect.runPromise(previewDueDateShift(targets, days, scope));
const apply = (value: Awaited<ReturnType<typeof preview>>) => Effect.runPromise(applyDueDateShift(value, scope));

beforeEach(() => {
  issues = Schema.decodeUnknownSync(Schema.Array(DueDateIssue))(fixture.issues);
  writable = new Set(keys.filter((key) => key !== "DEMO-5"));
  schedulable = new Set(keys.filter((key) => key !== "DEMO-6"));
  current = true;
  mock.jira.mockReset().mockImplementation((path: string, schema: Schema.Decoder<unknown>) => Effect.suspend(() => {
    const key = path.startsWith("/mypermissions") ? new URLSearchParams(path.split("?")[1]).get("issueKey") : decodeURIComponent(path.split("/")[2].split("?")[0]);
    const value = path.startsWith("/mypermissions") ? { permissions: { EDIT_ISSUES: { havePermission: true }, SCHEDULE_ISSUES: { havePermission: schedulable.has(key ?? "") } } }
      : path.endsWith("/editmeta") ? { fields: writable.has(key ?? "") ? { duedate: { operations: ["set"] } } : {} }
      : issues.find((issue) => issue.key === key);
    return Schema.decodeUnknownEffect(schema)(value);
  }));
  mock.jiraSend.mockReset().mockReturnValue(Effect.void);
});

describe("frischer Fälligkeitsversatz je ausgewaehltem Ticket", () => {
  it("zeigt unterschiedliche Alt-/Neuwerte und begruendete Ausnahmen, ohne zu schreiben", async () => {
    const plan = await preview();
    expect(plan.rows.map(({ before, after }) => [before, after])).toEqual([
      ["2026-03-28", "2026-03-30"], ["2026-10-24", "2026-10-26"], [null, null], ["2026-02-30", null], ["2026-11-16", "2026-11-18"], ["2026-11-17", "2026-11-19"],
    ]);
    expect(plan.rows.map(({ reason }) => !!reason)).toEqual([false, false, true, true, true, true]);
    expect(mock.jiraSend).not.toHaveBeenCalled();
  });
  it("nutzt eindeutige ausgewaehlte IDs, frische scoped Reads und absolute duedate-Payloads ohne Write-Retry", async () => {
    const plan = await preview([keys[0], keys[0], keys[1]]);
    mock.jira.mockClear();
    expect((await apply(plan)).map(({ status }) => status)).toEqual(["changed", "changed"]);
    expect(mock.jira).toHaveBeenCalledTimes(6);
    expect(mock.jira.mock.calls.every((call) => call[2].scope === scope && call[2].cache === "no-store")).toBe(true);
    expect(mock.jiraSend.mock.calls.map(([path, init]) => [path, init.method, JSON.parse(init.body), init.retry, init.scope])).toEqual([
      ["/issue/DEMO-1", "PUT", { fields: { duedate: "2026-03-30" } }, false, scope],
      ["/issue/DEMO-2", "PUT", { fields: { duedate: "2026-10-26" } }, false, scope],
    ]);
  });
  it("laesst fehlende/ungueltige und nicht bearbeitbare Datumswerte unveraendert", async () => {
    const results = await apply(await preview());
    expect(results.map(({ status }) => status)).toEqual(["changed", "changed", "skipped", "skipped", "skipped", "skipped"]);
    expect(mock.jiraSend).toHaveBeenCalledTimes(2);
  });
  it.each(["date", "project", "type", "id", "key"])("stoppt bei geaendertem %s nach der Vorschau", async (part) => {
    const plan = await preview([keys[0]]);
    issues = issues.map((issue) => issue.key !== keys[0] ? issue : part === "date" ? { ...issue, fields: { ...issue.fields, duedate: "2026-04-01" } }
      : part === "project" ? { ...issue, fields: { ...issue.fields, project: { id: "other" } } }
      : part === "type" ? { ...issue, fields: { ...issue.fields, issuetype: { id: "other" } } }
      : part === "id" ? { ...issue, id: "different" } : { ...issue, key: "MOVED-1" });
    expect((await apply(plan))[0].status).toBe("skipped");
    expect(mock.jiraSend).not.toHaveBeenCalled();
  });
  it.each(["metadata", "schedule", "edit"])("beachtet nachtraeglich entzogenes %s-Recht", async (part) => {
    const plan = await preview([keys[0]]);
    if (part === "metadata") writable.clear();
    else if (part === "schedule") schedulable.clear();
    else {
      const implementation = mock.jira.getMockImplementation()!;
      mock.jira.mockImplementation((path: string, schema: Schema.Decoder<unknown>) => path.startsWith("/mypermissions")
        ? Schema.decodeUnknownEffect(schema)({ permissions: { EDIT_ISSUES: { havePermission: false }, SCHEDULE_ISSUES: { havePermission: true } } }) : implementation(path, schema));
    }
    expect((await apply(plan))[0].status).toBe("skipped");
    expect(mock.jiraSend).not.toHaveBeenCalled();
  });
  it.each(["/editmeta", "/mypermissions", "?fields="])("schreibt bei frischem GET-Fehler in %s nichts", async (pathPart) => {
    const plan = await preview([keys[0]]);
    const implementation = mock.jira.getMockImplementation()!;
    mock.jira.mockImplementation((path: string, schema: Schema.Decoder<unknown>) => path.includes(pathPart) ? Effect.fail(new JiraApiError({ status: 403, body: "no read" })) : implementation(path, schema));
    expect((await apply(plan))[0].status).toBe("skipped");
    expect(mock.jiraSend).not.toHaveBeenCalled();
  });
  it.each([403, 500, 408])("bewahrt Teilerfolg und kennzeichnet HTTP %s ehrlich", async (status) => {
    const plan = await preview([keys[0], keys[1]]);
    mock.jiraSend.mockImplementation((path: string) => path.endsWith("2") ? Effect.fail(new JiraApiError({ status, body: "failed" })) : Effect.void);
    expect((await apply(plan)).map((result) => result.status)).toEqual(["changed", status === 403 ? "failed" : "uncertain"]);
    expect(mock.jiraSend).toHaveBeenCalledTimes(2);
  });
  it("wiederholt Verbindungsabbrueche nicht und schreibt aus alter Vorschau nicht nochmals relativ", async () => {
    const plan = await preview([keys[0]]);
    mock.jiraSend.mockReturnValue(Effect.fail(new JiraAuthError({ message: "lost" })));
    expect((await apply(plan))[0].status).toBe("uncertain");
    issues = issues.map((issue) => issue.key === keys[0] ? { ...issue, fields: { ...issue.fields, duedate: "2026-03-30" } } : issue);
    expect((await apply(plan))[0].status).toBe("skipped");
    expect(mock.jiraSend).toHaveBeenCalledTimes(1);
  });
  it("stoppt weitere Writes nach Kontextwechsel und behaelt bestaetigte Ergebnisse", async () => {
    const plan = await preview([keys[0], keys[1]]);
    const result = await Effect.runPromise(applyDueDateShift(plan, scope, (entry) => { if (entry.status === "changed") current = false; }));
    expect(result.map(({ status }) => status)).toEqual(["changed", "skipped"]);
    expect(mock.jiraSend).toHaveBeenCalledTimes(1);
  });
  it("schreibt bei initial falschem Scope oder manipulierter Vorschau nichts", async () => {
    const plan = await preview([keys[0]]);
    current = false;
    expect((await apply(plan))[0].status).toBe("skipped");
    current = true;
    expect((await apply({ ...plan, rows: plan.rows.map((row) => ({ ...row, after: "2030-01-01" })) }))[0].status).toBe("skipped");
    expect(mock.jiraSend).not.toHaveBeenCalled();
  });
  it("validiert ganze Tage und behandelt leere Auswahl ohne Requests", async () => {
    await expect(preview(keys, 0)).rejects.toMatchObject({ _tag: "DueDateShiftInvalid" });
    await expect(preview(keys, 0.5)).rejects.toMatchObject({ _tag: "DueDateShiftInvalid" });
    expect((await preview([])).rows).toEqual([]);
    expect(mock.jira).not.toHaveBeenCalled();
  });
});
