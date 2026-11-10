import { Effect, Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.stubEnv("TZ", "Europe/Berlin");

const { jira } = vi.hoisted(() => ({ jira: vi.fn() }));
vi.mock("@/lib/jira/client", () => ({ jira, jiraSend: vi.fn() }));

const { candidateJql, fetchCandidateIssues, fetchIssueWorklogs, MAX_CANDIDATE_ISSUES, MAX_WORKLOG_PAGES, WORKLOG_CONCURRENCY } = await import("./client");

const start = new Date(2026, 10, 2);
const end = new Date(2026, 10, 9);

const respond = (handler: (url: URL) => unknown, delayMs = 0) =>
  jira.mockImplementation((path: string, schema: Schema.Decoder<unknown>) =>
    Effect.promise(() => new Promise((resolve) => setTimeout(resolve, delayMs))).pipe(
      Effect.andThen(() => Schema.decodeUnknownEffect(schema)(handler(new URL(path, "https://jira.test")))),
    ),
  );

const worklog = (id: number) => ({ id: String(id), author: { accountId: "me" }, started: "2026-11-03T09:00:00.000+0100", timeSpentSeconds: 60 });

beforeEach(() => jira.mockReset());

describe("Meine Zeiterfassung: Jira-Abruf", () => {
  it("sucht Kandidaten mit eigenem Worklog-Autor und einem Tag Puffer je Seite", () => {
    expect(candidateJql(start, end)).toBe('worklogAuthor = currentUser() AND worklogDate >= "2026-11-01" AND worklogDate <= "2026-11-09" ORDER BY updated DESC');
  });

  it("begrenzt die Kandidaten und meldet die Kürzung", async () => {
    respond((url) => {
      const page = Number(url.searchParams.get("nextPageToken") ?? 0);
      return {
        issues: Array.from({ length: 50 }, (_, index) => ({ id: `${page}-${index}`, key: `DEMO-${page * 50 + index}`, fields: { summary: "Titel" } })),
        isLast: false,
        nextPageToken: String(page + 1),
      };
    });
    const result = await Effect.runPromise(fetchCandidateIssues(start, end));
    expect(result.issues).toHaveLength(MAX_CANDIDATE_ISSUES);
    expect(result.truncated).toBe(true);
    expect(jira).toHaveBeenCalledTimes(2);
  });

  it("lädt alle Worklog-Seiten im Zeitraum", async () => {
    const urls: URL[] = [];
    respond((url) => {
      urls.push(url);
      const startAt = Number(url.searchParams.get("startAt"));
      return { startAt, maxResults: 100, total: 250, worklogs: Array.from({ length: Math.min(100, 250 - startAt) }, (_, index) => worklog(startAt + index)) };
    });
    const result = await Effect.runPromise(fetchIssueWorklogs("10001", start, end));
    expect(result).toMatchObject({ truncated: false });
    expect(result.worklogs).toHaveLength(250);
    expect(urls.map((url) => url.searchParams.get("startAt"))).toEqual(["0", "100", "200"]);
    expect(urls[0]?.pathname).toBe("/issue/10001/worklog");
    expect(urls[0]?.searchParams.get("startedAfter")).toBe(String(start.getTime()));
    expect(urls[0]?.searchParams.get("startedBefore")).toBe(String(end.getTime()));
  });

  it("bricht nach der Seitengrenze ab und meldet unvollständig", async () => {
    respond((url) => {
      const startAt = Number(url.searchParams.get("startAt"));
      return { startAt, maxResults: 100, total: 100_000, worklogs: Array.from({ length: 100 }, (_, index) => worklog(startAt + index)) };
    });
    const result = await Effect.runPromise(fetchIssueWorklogs("10001", start, end));
    expect(result.truncated).toBe(true);
    expect(jira).toHaveBeenCalledTimes(MAX_WORKLOG_PAGES);
  });

  it("meldet eine leere Seite vor dem Gesamtstand als unvollständig", async () => {
    respond(() => ({ startAt: 0, maxResults: 0, total: 3, worklogs: [] }));
    const result = await Effect.runPromise(fetchIssueWorklogs("10001", start, end));
    expect(result).toEqual({ worklogs: [], truncated: true });
    expect(jira).toHaveBeenCalledTimes(1);
  });

  it("hält höchstens vier Worklog-Anfragen gleichzeitig offen und isoliert Fehler", async () => {
    let open = 0;
    let peak = 0;
    jira.mockImplementation((path: string, schema: Schema.Decoder<unknown>) =>
      Effect.gen(function* () {
        open++;
        peak = Math.max(peak, open);
        yield* Effect.promise(() => new Promise((resolve) => setTimeout(resolve, 5)));
        open--;
        if (path.startsWith("/issue/broken/")) return yield* Effect.die("Test: 503");
        return yield* Schema.decodeUnknownEffect(schema)({ startAt: 0, maxResults: 100, total: 1, worklogs: [worklog(1)] });
      }),
    );
    const ids = [...Array.from({ length: 11 }, (_, index) => String(index)), "broken"];
    const results = await Promise.allSettled(ids.map((id) => Effect.runPromise(fetchIssueWorklogs(id, start, end))));
    expect(peak).toBe(WORKLOG_CONCURRENCY);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(11);
    expect(results.at(-1)?.status).toBe("rejected");
  });
});
