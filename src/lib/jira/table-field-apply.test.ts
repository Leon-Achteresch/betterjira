import { Effect, Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyApprovedTableFields, type TableFieldApproval } from "./table-field-apply";
import { JiraApiError, type JiraRequestScope } from "./client";
import { planTableFieldPreview, previewTableField } from "./table-field-preview";

const mock = vi.hoisted(() => ({ jira: vi.fn(), jiraSend: vi.fn(), allowed: vi.fn() }));
vi.mock("./client", async (original) => ({ ...await original<typeof import("./client")>(), jira: mock.jira, jiraSend: mock.jiraSend }));
vi.mock("@/lib/jira/table-field-apply-capability", () => ({ tableFieldApplyAllowed: mock.allowed }));

const account = { cloudId: "qa-cloud", accountId: "qa-user" };
const siteUrl = "https://example.atlassian.net";
const targets = ["1", "2", "3", "4"].map((id) => ({ id, key: `DEMO-${id}` }));
const input = targets.map(({ key, id }) => `${key}\t2026-12-2${id}`).join("\n");
let current: boolean;
const scope: JiraRequestScope = { cloudId: account.cloudId, isCurrent: () => current };
let accountId: string;
let changed: string | undefined;
let differentId: string | undefined;
let denied: string | undefined;
let unsupported: string | undefined;
let switchOnRead: string | undefined;
let failure: string | undefined;

const approved = async (tsv = input): Promise<TableFieldApproval> => {
  const plan = planTableFieldPreview(tsv, targets);
  if ("error" in plan) throw new Error(plan.error);
  const preview = await Effect.runPromise(previewTableField(plan, scope));
  mock.jira.mockClear();
  return { scope: account, siteUrl, targets, preview };
};
const execute = (approval: TableFieldApproval) => Effect.runPromise(applyApprovedTableFields(approval, scope));

beforeEach(() => {
  current = true;
  accountId = account.accountId;
  changed = differentId = denied = unsupported = switchOnRead = failure = undefined;
  mock.allowed.mockReset().mockReturnValue(true);
  mock.jira.mockReset().mockImplementation((path: string, schema: Schema.Decoder<unknown>) => Effect.suspend(() => {
    const url = new URL(path, siteUrl);
    const key = url.searchParams.get("issueKey") ?? url.pathname.split("/")[2];
    if (path === "/myself") return Schema.decodeUnknownEffect(schema)({ accountId });
    if (path.endsWith("/editmeta")) return Schema.decodeUnknownEffect(schema)({ fields: {
      duedate: { operations: key === unsupported ? [] : ["set"] },
    } });
    if (url.pathname === "/mypermissions") return Schema.decodeUnknownEffect(schema)({ permissions: {
      EDIT_ISSUES: { havePermission: true }, SCHEDULE_ISSUES: { havePermission: key !== denied },
    } });
    if (key === switchOnRead) current = false;
    return Schema.decodeUnknownEffect(schema)({
      key,
      id: key === differentId ? "77" : targets.find((target) => target.key === key)?.id,
      fields: { duedate: key === changed ? "2026-12-01" : null, project: { id: "p" }, issuetype: { id: "t" } },
    });
  }));
  mock.jiraSend.mockReset().mockImplementation((path: string, init: { scope: JiraRequestScope }) => Effect.suspend(() => {
    init.scope.onDispatch?.();
    return path === failure ? Effect.fail(new JiraApiError({ status: 503, body: "" })) : Effect.void;
  }));
});

describe("bestätigte Tabellen-Fälligkeiten", () => {
  it("liest frische Identität, Rechte, Metadaten und Datum und sendet genau den gebundenen ID-PUT", async () => {
    const result = await execute(await approved("DEMO-1\t2026-12-21"));
    expect(result.map(({ status }) => status)).toEqual(["applied"]);
    expect(mock.jira.mock.calls.map(([path]) => path)).toEqual([
      "/myself", "/mypermissions?issueKey=DEMO-1&permissions=EDIT_ISSUES%2CSCHEDULE_ISSUES",
      "/issue/DEMO-1/editmeta", "/issue/DEMO-1?fields=duedate,project,issuetype",
    ]);
    expect(mock.jira.mock.calls.every(([, , init]) => init.cache === "no-store" && init.scope.siteUrl === siteUrl)).toBe(true);
    expect(mock.jiraSend).toHaveBeenCalledExactlyOnceWith("/issue/1", {
      method: "PUT", retry: false, body: JSON.stringify({ fields: { duedate: "2026-12-21" } }), scope: expect.objectContaining({ cloudId: account.cloudId, siteUrl }),
    });
  });

  it("sperrt zwischenzeitlich geändertes Datum, andere Issue-ID, entzogene Rechte und fehlendes set einzeln", async () => {
    const approval = await approved();
    changed = "DEMO-1";
    differentId = "DEMO-2";
    denied = "DEMO-3";
    unsupported = "DEMO-4";
    expect((await execute(approval)).map(({ status, message }) => [status, message])).toEqual([
      ["blocked", expect.stringContaining("seit der Vorschau geändert")],
      ["blocked", expect.stringContaining("seit der Vorschau geändert")],
      ["blocked", expect.stringContaining("Rechte")],
      ["blocked", expect.stringContaining("nicht mehr bearbeitbar")],
    ]);
    expect(mock.jiraSend).not.toHaveBeenCalled();
  });

  it("lässt doppelte Schlüssel, fehlende Werte, Mehrdeutigkeit und Fremdziele unangetastet", async () => {
    const approval = await approved("DEMO-1\t2026-12-21\nDEMO-1\t2026-12-22\nDEMO-2\t\nDEMO-3\t2026-12-24\textra\nOPS-7\t2026-12-25");
    expect((await execute(approval)).map(({ status }) => status)).toEqual(Array(5).fill("blocked"));
    expect(mock.jira).not.toHaveBeenCalled();
    expect(mock.jiraSend).not.toHaveBeenCalled();
  });

  it("sperrt eine aktivierte Zeile bei mehrdeutiger Ziel-ID", async () => {
    const approval = await approved("DEMO-1\t2026-12-21");
    const results = await execute({ ...approval, targets: [...targets, { id: "1", key: "ALT-1" }] });
    expect(results[0]?.status).toBe("blocked");
    expect(mock.jiraSend).not.toHaveBeenCalled();
  });

  it("stoppt beim Verlust des Auswahlkontexts im letzten GET", async () => {
    const approval = await approved();
    switchOnRead = "DEMO-1";
    expect((await execute(approval)).map(({ status }) => status)).toEqual(Array(4).fill("blocked"));
    expect(mock.jira).toHaveBeenCalledTimes(4);
    expect(mock.jiraSend).not.toHaveBeenCalled();
  });

  it("stoppt das ganze Paket beim abweichenden frischen Jira-Konto", async () => {
    const approval = await approved();
    accountId = "anderes-konto";
    expect((await execute(approval)).map(({ status }) => status)).toEqual(Array(4).fill("blocked"));
    expect(mock.jira).toHaveBeenCalledExactlyOnceWith("/myself", expect.anything(), expect.anything());
    expect(mock.jiraSend).not.toHaveBeenCalled();
  });

  it("erhält Teilerfolg und sendet nach unklarer Antwort keine Folgezeile", async () => {
    const approval = await approved();
    failure = "/issue/2";
    expect((await execute(approval)).map(({ status }) => status)).toEqual(["applied", "uncertain", "blocked", "blocked"]);
    expect(mock.jiraSend.mock.calls.map(([path, init]) => [path, init.retry])).toEqual([["/issue/1", false], ["/issue/2", false]]);
  });

  it("sperrt einen Apply-Aufruf ohne Fixture-Freigabe bereits vor der Einzelprüfung", async () => {
    const approval = await approved();
    mock.allowed.mockReturnValue(false);
    expect((await execute(approval)).map(({ status }) => status)).toEqual(Array(4).fill("blocked"));
    expect(mock.jira).not.toHaveBeenCalled();
    expect(mock.jiraSend).not.toHaveBeenCalled();
  });
});
