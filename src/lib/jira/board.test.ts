import { Effect, Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { jira, jiraAgile } = vi.hoisted(() => ({ jira: vi.fn(), jiraAgile: vi.fn() }));
vi.mock("./client", () => ({ jira, jiraAgile }));

const { boardWithIssues } = await import("./board");

const board = { id: 42, name: "Support Requests", type: "kanban" };
const statuses = ["Awaiting QA", "Open", "In Progress", "Done"].map((name, index) => ({
  id: String(index),
  name,
  statusCategory: { key: index === 3 ? "done" : "indeterminate", colorName: index === 3 ? "green" : "yellow" },
}));

const issue = (id: number, status = 0) => ({
  id: String(id),
  key: `SUPPORT-${id}`,
  fields: {
    summary: `Support Request ${id}`,
    status: statuses[status],
    assignee: null,
    created: "2026-11-01T09:00:00Z",
    issuetype: { name: "Support Request" },
    customfield_points: id,
    customfield_flagged: [{ value: "Impediment" }],
    customfield_sprint: [{ id: 5, name: "Sprint 5", state: "active", boardId: 42 }],
  },
});

const respond = (handler: (url: URL) => unknown) =>
  jira.mockImplementation((path: string, schema: Schema.Decoder<unknown>) =>
    Effect.suspend(() => Schema.decodeUnknownEffect(schema)(path === "/field" ? [
      { id: "customfield_points", name: "Story Points" },
      { id: "customfield_flagged", name: "Flagged" },
      { id: "customfield_sprint", name: "Sprint", schema: { custom: "com.pyxis.greenhopper.jira:gh-sprint" } },
    ] : handler(new URL(path, "https://jira.test")))),
  );

beforeEach(() => {
  jira.mockReset();
  jiraAgile.mockReset();
  jiraAgile.mockImplementation((_path: string, schema: Schema.Decoder<unknown>) =>
    Schema.decodeUnknownEffect(schema)({
      filter: { id: "123" },
      estimation: { field: { fieldId: "customfield_points" } },
      columnConfig: { columns: statuses.map(({ id, name }) => ({ name, statuses: [{ id }] })) },
    }),
  );
});

describe("Board vollständig laden", () => {
  it("lädt Statusspalten hinter den ersten 100 Awaiting-QA-Tickets", async () => {
    respond((url) => {
      const token = url.searchParams.get("nextPageToken");
      if (token === "page-3") return { issues: [issue(201, 3)], isLast: true };
      if (token === "page-2") return {
        issues: Array.from({ length: 100 }, (_, index) => issue(index + 101, index % 2 + 1)),
        nextPageToken: "page-3", isLast: false,
      };
      return {
        issues: Array.from({ length: 100 }, (_, index) => issue(index + 1)),
        nextPageToken: "page-2", isLast: false,
      };
    });

    const result = await Effect.runPromise(boardWithIssues(board));
    expect(result[0].columns.map((column) => column.issues.length)).toEqual([100, 50, 50, 1]);
    expect(result[0].columns[3].issues[0]).toMatchObject({ key: "SUPPORT-201", rank: 201, points: 201, flagged: true });
  });

  it("behält Filter, Felder und Changelog bei kurzen Seiten und kodiert Folgetokens", async () => {
    const requests: URL[] = [];
    respond((url) => {
      requests.push(url);
      return url.searchParams.has("nextPageToken")
        ? { issues: [issue(2, 1)], isLast: true }
        : { issues: [issue(1)], nextPageToken: "next +/= &?" };
    });
    await Effect.runPromise(boardWithIssues(board));
    expect(requests).toHaveLength(2);
    expect(requests[0].searchParams.has("nextPageToken")).toBe(false);
    expect(requests[1].searchParams.get("nextPageToken")).toBe("next +/= &?");
    for (const url of requests) {
      expect(url.pathname).toBe("/search/jql");
      expect(url.searchParams.get("jql")).toBe("filter = 123 ORDER BY Rank ASC");
      expect(url.searchParams.get("maxResults")).toBe("100");
      expect(url.searchParams.get("expand")).toBe("changelog");
      expect(url.searchParams.get("fields")).toContain("customfield_flagged,customfield_points");
    }
  });

  it.each([
    { issues: [] },
    { issues: [issue(1)], nextPageToken: null },
    { issues: [issue(1)], isLast: true, nextPageToken: "unused" },
  ])("beendet eine letzte Seite ohne zusätzliche Anfragen: %j", async (page) => {
    respond(() => page);
    const result = await Effect.runPromise(boardWithIssues(board));
    expect(result[0].columns.flatMap((column) => column.issues)).toHaveLength(page.issues.length);
    expect(jira).toHaveBeenCalledTimes(2);
  });

  it("folgt einer leeren Zwischenseite mit gültigem Folgetoken", async () => {
    respond((url) => url.searchParams.has("nextPageToken")
      ? { issues: [issue(1, 1)], isLast: true }
      : { issues: [], nextPageToken: "next", isLast: false });
    const result = await Effect.runPromise(boardWithIssues(board));
    expect(result[0].columns[1].issues).toHaveLength(1);
    expect(jira).toHaveBeenCalledTimes(3);
  });

  it("übernimmt doppelte Tickets nur einmal mit aktuellem Status und durchgehendem Rang", async () => {
    respond((url) => url.searchParams.has("nextPageToken")
      ? { issues: [issue(1, 2), issue(2, 1)], isLast: true }
      : { issues: [issue(1)], nextPageToken: "next" });
    const result = await Effect.runPromise(boardWithIssues(board));
    expect(result[0].columns.map((column) => column.issues.length)).toEqual([0, 1, 1, 0]);
    expect(result[0].columns[2].issues[0].rank).toBe(1);
    expect(result[0].columns[1].issues[0].rank).toBe(2);
  });

  it.each([undefined, "same"])("meldet fehlende oder wiederholte Folgetokens als Fehler: %s", async (nextPageToken) => {
    respond(() => ({ issues: [issue(1)], isLast: false, nextPageToken }));
    await expect(Effect.runPromise(boardWithIssues(board))).rejects.toThrow("keine gültige Folgeseite");
    expect(jira.mock.calls.length).toBeLessThanOrEqual(3);
  });

  it("zeigt bei Fehlern auf Folgeseiten kein unvollständiges Board als Erfolg", async () => {
    respond((url) => {
      if (url.searchParams.has("nextPageToken")) throw new Error("Test: Folgeseite nicht erreichbar");
      return { issues: [issue(1)], nextPageToken: "next" };
    });
    await expect(Effect.runPromise(boardWithIssues(board))).rejects.toThrow("Folgeseite nicht erreichbar");
  });

  it("bricht das Nachladen beim Abbruch der Query ab", async () => {
    respond(() => ({ issues: [issue(1)], nextPageToken: "next" }));
    const handle = jira.getMockImplementation()!;
    const controller = new AbortController();
    jira.mockImplementation((path: string, schema: Schema.Decoder<unknown>) =>
      path.includes("nextPageToken=")
        ? Effect.sync(() => controller.abort()).pipe(Effect.andThen(Effect.never))
        : handle(path, schema));
    await expect(Effect.runPromise(boardWithIssues(board), { signal: controller.signal })).rejects.toBeDefined();
    expect(jira).toHaveBeenCalledTimes(3);
  });

  it.each([undefined, 5])("ordnet auch nachgeladene Tickets dem gewählten Scrum-Sprint zu: %s", async (sprintId) => {
    const requests: URL[] = [];
    respond((url) => {
      requests.push(url);
      return url.searchParams.has("nextPageToken")
        ? { issues: [issue(2, 2)], isLast: true }
        : { issues: [issue(1)], nextPageToken: "next" };
    });
    const result = await Effect.runPromise(boardWithIssues({ ...board, type: "scrum" }, sprintId));
    expect(result).toHaveLength(1);
    expect(result[0].sprint?.id).toBe(5);
    expect(result[0].columns[2].issues[0]).toMatchObject({ key: "SUPPORT-2", rank: 2 });
    for (const url of requests) {
      expect(url.searchParams.get("jql")).toBe(`filter = 123 AND ${sprintId ? "sprint = 5" : "sprint in openSprints()"} ORDER BY Rank ASC`);
      expect(url.searchParams.get("fields")).toContain("customfield_sprint");
    }
  });
});
