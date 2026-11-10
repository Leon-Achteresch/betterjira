import { Effect, Schema } from "effect";
import { describe, expect, it, vi } from "vitest";
import { createJiraMock } from "./mock-backend";
import { useJiraMock } from "./tauri-mock";

vi.mock("@tauri-apps/plugin-http", () => import("./tauri-mock"));
vi.mock("@tauri-apps/api/core", () => import("./tauri-mock"));
vi.mock("@tauri-apps/api/window", () => import("./tauri-mock"));

const mock = useJiraMock(createJiraMock({ issues: 2500, projects: ["PERF"] }));

const { jiraAgile } = await import("@/lib/jira/client");
const { BoardConfiguration, Sprints } = await import("@/lib/jira/board");
const { countIssues, searchIssues, validateJql } = await import("@/lib/jira/search");
const { addWorklog, editIssue } = await import("@/lib/jira/issue");
const { postComment } = await import("@/lib/jira/comments");
const { textToAdf } = await import("@/lib/jira/adf");
const { fetchProjectStatsIssues } = await import("@/lib/jira/project-stats");

const run = <A, E>(effect: Effect.Effect<A, E>) => Effect.runPromise(effect);

describe("Produktions-Client gegen den Jira-Mock", () => {
  it("dekodiert Suche, Zählung und JQL-Prüfung mit den echten Schemas", async () => {
    const first = await run(searchIssues("project = PERF ORDER BY Rank ASC", ["summary", "status"], undefined, 100));
    const second = await run(searchIssues("project = PERF ORDER BY Rank ASC", ["summary", "status"], first.nextPageToken ?? undefined, 100));
    const { count } = await run(countIssues("project = PERF"));
    const { queries } = await run(validateJql("projekt = PERF"));

    expect(first.issues).toHaveLength(100);
    expect(second.issues[0].key).not.toBe(first.issues[0].key);
    expect(count).toBe(2500);
    expect(queries[0].errors?.[0]).toMatch(/projekt/);
  });

  it("dekodiert Board-Konfiguration und Sprints mit den Board-Schemas", async () => {
    const config = await run(jiraAgile("/board/1/configuration", BoardConfiguration));
    const { values } = await run(jiraAgile("/board/1/sprint?state=active,future,closed&maxResults=50", Schema.Struct({ values: Sprints })));

    expect(config.filter.id).toBe("10000");
    expect(values.filter((sprint) => sprint.state === "active")).toHaveLength(1);
  });

  it("schreibt über die echten Mutationen und lädt Statistik-Seiten bis zum Limit", async () => {
    await run(editIssue("PERF-3", { summary: "Vom Client" }));
    await run(postComment("PERF-3", textToAdf("Kommentar")));
    await run(addWorklog("PERF-3", { timeSpent: "2h", started: "2026-11-09T09:00:00.000+0000" }));
    const stats = await run(fetchProjectStatsIssues("PERF"));
    const issue = mock.jira.findIssue("PERF-3");

    expect(issue.fields.summary).toBe("Vom Client");
    expect(issue.comments.at(-1)?.body.content[0].content[0].text).toBe("Kommentar");
    expect(issue.worklogs.at(-1)?.timeSpentSeconds).toBe(7200);
    expect(stats.issues.length).toBe(2500);
    expect(mock.stats().byRoute).toMatchObject({ "issue-edit": 1, "comment-add": 1, "worklog-add": 1 });
  });
});
