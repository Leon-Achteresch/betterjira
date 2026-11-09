import { afterEach, describe, expect, it, vi } from "vitest";
import { createJiraMock, LATENCY, type JiraMock } from "./mock-backend";

const NOW = Date.UTC(2026, 10, 9, 12);
const AUTH = { authorization: "Bearer mock" };

type Status = { id: string; name: string; statusCategory: { key: string } };
type Sprint = { id: number; state: string };
type History = { created: string; items: { field: string; toString: string | null }[] };
type Issue = {
  id: string;
  key: string;
  fields: {
    summary?: string;
    status: Status;
    resolution?: { name: string } | null;
    updated?: string;
    labels?: string[];
    customfield_10020?: Sprint[] | null;
    comment?: { comments: { body: { content: { content: { text: string }[] }[] } }[] };
    worklog?: { worklogs: { timeSpentSeconds: number; timeSpent: string }[] };
  };
  changelog: { histories: History[] };
};
type SearchPage = { issues: Issue[]; nextPageToken?: string; isLast: boolean };
type ErrorBody = { errorMessages: string[]; errors: Record<string, string> };
type Paged<T> = { startAt: number; maxResults: number; total?: number; isLast?: boolean; values: T[] };
type BoardConfig = { filter: { id: string }; estimation: { field: { fieldId: string } }; columnConfig: { columns: { statuses: { id: string }[] }[] } };
type Transition = { id: string; to: Status; fields: { resolution: { allowedValues: { name: string }[] } } };

const call = async <T = ErrorBody>(mock: JiraMock, path: string, init: RequestInit = {}) => {
  const response = await mock.fetch(`${mock.baseUrl}${path}`, {
    ...init,
    headers: { ...AUTH, ...(typeof init.body === "string" && { "content-type": "application/json" }), ...init.headers },
  });
  const text = await response.text();
  const body: T = text ? JSON.parse(text) : undefined;
  return { status: response.status, headers: response.headers, body };
};

const send = <T = ErrorBody>(mock: JiraMock, method: string, path: string, body: unknown) => call<T>(mock, path, { method, body: JSON.stringify(body) });

const searchAll = async (mock: JiraMock, params: Record<string, string>) => {
  const pages: SearchPage[] = [];
  let token: string | undefined;
  do {
    const query = new URLSearchParams({ ...params, ...(token && { nextPageToken: token }) });
    const { status, body } = await call<SearchPage>(mock, `/api/3/search/jql?${query}`);
    expect(status).toBe(200);
    pages.push(body);
    token = body.nextPageToken;
  } while (token);
  return { pages, issues: pages.flatMap((page) => page.issues) };
};

afterEach(() => {
  vi.useRealTimers();
});

describe("Jira-Mock: Daten", () => {
  it("erzeugt bei gleichem Seed identische Daten, bei anderem Seed andere", async () => {
    const first = createJiraMock({ seed: 7, issues: 3000, now: () => NOW });
    const second = createJiraMock({ seed: 7, issues: 3000, now: () => NOW });
    const other = createJiraMock({ seed: 8, issues: 3000, now: () => NOW });
    const issue = (mock: JiraMock) => call<Issue>(mock, "/api/3/issue/PERF-500?expand=changelog").then(({ body }) => body);

    expect(first.data.issues).toHaveLength(3000);
    expect(await issue(first)).toEqual(await issue(second));
    expect(await issue(first)).not.toEqual(await issue(other));
  });

  it("liefert realistische Verteilungen über Status, Sprints und Personen", () => {
    const { data } = createJiraMock({ issues: 2000, projects: ["PERF"] });
    const statusNames = new Set(data.issues.map((issue) => (issue.fields.status as { name: string }).name));
    const subtasks = data.issues.filter((issue) => issue.parentKey);
    const mine = data.issues.filter((issue) => (issue.fields.assignee as { accountId: string } | null)?.accountId === data.me.accountId);

    expect([...statusNames].sort()).toEqual(["Backlog", "Done", "In Progress", "In Review", "To Do"]);
    expect(subtasks.length).toBeGreaterThan(50);
    expect(mine.length).toBeGreaterThan(50);
    expect(data.boards.map((board) => board.type)).toEqual(["scrum", "kanban"]);
  });
});

describe("Jira-Mock: Suche und Pagination", () => {
  const mock = createJiraMock({ issues: 1200, projects: ["PERF"], now: () => NOW });

  it("blättert /search/jql mit Tokens, begrenzt Seiten auf 100 und liefert jedes Issue genau einmal", async () => {
    const { pages, issues } = await searchAll(mock, { jql: "project = PERF ORDER BY Rank ASC", fields: "summary,status", maxResults: "500" });
    const count = await send<{ count: number }>(mock, "POST", "/api/3/search/approximate-count", { jql: "project = PERF" });

    expect(pages).toHaveLength(12);
    expect(pages.slice(0, -1).every((page) => page.issues.length === 100 && page.isLast === false)).toBe(true);
    expect(pages.at(-1)).toMatchObject({ isLast: true });
    expect(pages.at(-1)).not.toHaveProperty("nextPageToken");
    expect(new Set(issues.map((issue) => issue.key)).size).toBe(1200);
    expect(count.body).toEqual({ count: 1200 });
  });

  it("erlaubt große Seiten nur ohne Felder und unterstützt POST-Suche", async () => {
    const idsOnly = await call<SearchPage>(mock, `/api/3/search/jql?${new URLSearchParams({ jql: "project = PERF", maxResults: "5000" })}`);
    const posted = await send<SearchPage>(mock, "POST", "/api/3/search/jql", { jql: "project = PERF", fields: ["summary"], maxResults: 10 });

    expect(idsOnly.body.issues).toHaveLength(1200);
    expect(Object.keys(idsOnly.body.issues[0].fields)).toEqual([]);
    expect(posted.body.issues).toHaveLength(10);
    expect(Object.keys(posted.body.issues[0].fields)).toEqual(["summary"]);
  });

  it("lehnt ungültige Tokens und unbeschränkte Abfragen wie Jira ab", async () => {
    const first = await call<SearchPage>(mock, `/api/3/search/jql?${new URLSearchParams({ jql: "project = PERF", maxResults: "10" })}`);
    const foreign = await call(mock, `/api/3/search/jql?${new URLSearchParams({ jql: "project = PERF AND labels = ux", nextPageToken: first.body.nextPageToken ?? "" })}`);
    const broken = await call(mock, `/api/3/search/jql?${new URLSearchParams({ jql: "project = PERF", nextPageToken: "kaputt" })}`);
    const unbounded = await call(mock, `/api/3/search/jql?${new URLSearchParams({ jql: "ORDER BY created DESC" })}`);
    const unknownField = await call(mock, `/api/3/search/jql?${new URLSearchParams({ jql: "colour = red" })}`);

    expect([foreign.status, broken.status, unbounded.status, unknownField.status]).toEqual([400, 400, 400, 400]);
    expect(unbounded.body.errorMessages[0]).toMatch(/Unbounded JQL/);
    expect(unknownField.body.errorMessages[0]).toMatch(/Field 'colour' does not exist/);
  });

  it("projiziert Felder und hängt den Changelog neuester Eintrag zuerst an", async () => {
    const { body } = await call<SearchPage>(mock, `/api/3/search/jql?${new URLSearchParams({ jql: "key = PERF-1", fields: "summary,status,customfield_10020", expand: "changelog" })}`);
    const [issue] = body.issues;
    const created = issue.changelog.histories.map((history) => Date.parse(history.created));

    expect(Object.keys(issue.fields).sort()).toEqual(["customfield_10020", "status", "summary"]);
    expect(created).toEqual([...created].sort((a, b) => b - a));
  });

  it("validiert JQL über /jql/parse", async () => {
    const { body } = await send<{ queries: { errors?: string[] }[] }>(mock, "POST", "/api/3/jql/parse?validation=strict", { queries: ["project = PERF", "nope = 1"] });

    expect(body.queries[0]).not.toHaveProperty("errors");
    expect(body.queries[1].errors?.[0]).toMatch(/Field 'nope'/);
  });
});

describe("Jira-Mock: Boards", () => {
  const mock = createJiraMock({ issues: 1500, projects: ["PERF", "CORE"], now: () => NOW });

  it("liefert Board-Konfiguration, Board-JQL und Backlog-JQL konsistent", async () => {
    const config = await call<BoardConfig>(mock, "/agile/1.0/board/1/configuration");
    const filterId = config.body.filter.id;
    const board = await searchAll(mock, { jql: `filter = ${filterId} AND sprint in openSprints() ORDER BY Rank ASC`, fields: "status,customfield_10020", maxResults: "100" });
    const backlog = await searchAll(mock, {
      jql: `filter = ${filterId} AND (sprint is EMPTY OR sprint not in openSprints() AND sprint not in futureSprints()) AND statusCategory != Done ORDER BY Rank ASC`,
      fields: "status,customfield_10020",
    });
    const columnStatuses = config.body.columnConfig.columns.flatMap((column) => column.statuses.map((status) => status.id));

    expect(config.body.estimation.field.fieldId).toBe("customfield_10016");
    expect(board.issues.length).toBeGreaterThan(200);
    expect(board.issues.every((issue) => issue.fields.customfield_10020?.some((sprint) => sprint.state !== "closed"))).toBe(true);
    expect(board.issues.every((issue) => columnStatuses.includes(issue.fields.status.id))).toBe(true);
    expect(backlog.issues.every((issue) => issue.fields.status.statusCategory.key !== "done")).toBe(true);
    expect(backlog.issues.every((issue) => issue.key.startsWith("PERF-"))).toBe(true);
  });

  it("paginiert Agile-Endpunkte über startAt mit total", async () => {
    const first = await call<SearchPage>(mock, "/agile/1.0/board/2/issue?maxResults=500&fields=summary");
    const second = await call<SearchPage>(mock, "/agile/1.0/board/2/issue?startAt=100&maxResults=100&fields=summary");
    const sprints = await call<Paged<Sprint>>(mock, "/agile/1.0/board/1/sprint?state=active,future,closed&maxResults=5");
    const kanbanSprints = await call(mock, "/agile/1.0/board/2/sprint");
    const boards = await call<Paged<{ location: { projectKey: string } }>>(mock, "/agile/1.0/board?projectLocation=CORE&maxResults=50");

    expect(first.body).toMatchObject({ startAt: 0, maxResults: 100, total: 750 });
    expect(second.body.issues[0].key).not.toBe(first.body.issues[0].key);
    expect(sprints.body).toMatchObject({ isLast: false, maxResults: 5 });
    expect(kanbanSprints.status).toBe(400);
    expect(boards.body.values.map((entry) => entry.location.projectKey)).toEqual(["CORE", "CORE"]);
  });

  it("verschiebt Ränge, sodass ORDER BY Rank die neue Reihenfolge liefert", async () => {
    const ranked = () => searchAll(mock, { jql: "project = PERF ORDER BY Rank ASC", fields: "summary", maxResults: "5" }).then(({ pages }) => pages[0].issues.map((issue) => issue.key));
    const before = await ranked();
    const response = await send(mock, "PUT", "/agile/1.0/issue/rank", { issues: [before[3]], rankBeforeIssue: before[0] });

    expect(response.status).toBe(204);
    expect(await ranked()).toEqual([before[3], before[0], before[1], before[2], before[4]]);
  });
});

describe("Jira-Mock: Mutationen", () => {
  it("führt Transitionen aus und macht sie in Issue, Changelog und Suche sichtbar", async () => {
    let clock = NOW;
    const mock = createJiraMock({ issues: 300, now: () => clock });
    const key = mock.data.issues.find((issue) => (issue.fields.status as { name: string }).name === "To Do")!.key;
    const { body: options } = await call<{ transitions: Transition[] }>(mock, `/api/3/issue/${key}/transitions?expand=transitions.fields`);
    const done = options.transitions.find((transition) => transition.to.name === "Done")!;
    clock += 60_000;
    const response = await send(mock, "POST", `/api/3/issue/${key}/transitions`, { transition: { id: done.id } });
    const { body: issue } = await call<Issue>(mock, `/api/3/issue/${key}?fields=status,resolution,updated&expand=changelog`);
    const recent = await call<SearchPage>(mock, `/api/3/search/jql?${new URLSearchParams({ jql: "updated >= -2m", fields: "status" })}`);

    expect(done.fields.resolution.allowedValues[0].name).toBe("Done");
    expect(response.status).toBe(204);
    expect(issue.fields.status.name).toBe("Done");
    expect(issue.fields.resolution?.name).toBe("Done");
    expect(Date.parse(issue.fields.updated ?? "")).toBe(clock);
    expect(issue.changelog.histories[0].items[0]).toMatchObject({ field: "status", toString: "Done" });
    expect(recent.body.issues.map((entry) => entry.key)).toEqual([key]);
  });

  it("bearbeitet Felder, Labels, Kommentare und Worklogs", async () => {
    const mock = createJiraMock({ issues: 100, now: () => NOW });
    const edit = await send(mock, "PUT", "/api/3/issue/PERF-2", { fields: { summary: "Neu", assignee: { accountId: mock.me.accountId } }, update: { labels: [{ add: "perf" }] } });
    const comment = await send(mock, "POST", "/api/2/issue/PERF-2/comment", { body: "Hallo *Welt*" });
    const worklog = await send(mock, "POST", "/api/2/issue/PERF-2/worklog", { timeSpent: "1h 30m", started: "2026-11-09T10:00:00.000+0000" });
    const { body } = await call<Issue>(mock, "/api/3/issue/PERF-2?fields=summary,assignee,labels,comment,worklog,timespent");
    const mine = await call<SearchPage>(mock, `/api/3/search/jql?${new URLSearchParams({ jql: "assignee = currentUser() AND key = PERF-2", fields: "summary" })}`);

    expect([edit.status, comment.status, worklog.status]).toEqual([204, 201, 201]);
    expect(body.fields.summary).toBe("Neu");
    expect(body.fields.labels).toContain("perf");
    expect(body.fields.comment?.comments.at(-1)?.body.content[0].content[0].text).toBe("Hallo *Welt*");
    expect(body.fields.worklog?.worklogs.at(-1)).toMatchObject({ timeSpentSeconds: 5400, timeSpent: "1h 30m" });
    expect(mine.body.issues).toHaveLength(1);
  });

  it("legt Issues an und lehnt ungültige Änderungen mit Jira-Fehlern ab", async () => {
    const mock = createJiraMock({ issues: 50, projects: ["PERF"], now: () => NOW });
    const created = await send<{ key: string }>(mock, "POST", "/api/3/issue", { fields: { project: { key: "PERF" }, issuetype: { name: "Bug" }, summary: "Frisch" } });
    const unknownField = await send(mock, "PUT", "/api/3/issue/PERF-1", { fields: { colour: "red" } });
    const emptySummary = await send(mock, "PUT", "/api/3/issue/PERF-1", { fields: { summary: "" } });
    const missing = await call(mock, "/api/3/issue/PERF-9999");
    const badTransition = await send(mock, "POST", "/api/3/issue/PERF-1/transitions", { transition: { id: "999" } });

    expect(created).toMatchObject({ status: 201, body: { key: "PERF-51" } });
    expect(mock.jira.search("project = PERF").length).toBe(51);
    expect(unknownField.body.errors.colour).toMatch(/cannot be set/);
    expect(emptySummary.body.errors.summary).toBeDefined();
    expect(missing.status).toBe(404);
    expect(badTransition.status).toBe(400);
  });

  it("simuliert fremde Änderungen deterministisch und sichtbar für Polling-JQL", () => {
    const run = () => {
      let clock = NOW;
      const mock = createJiraMock({ seed: 3, issues: 500, now: () => clock });
      clock += 1000;
      const changes = mock.simulateChanges(25);
      return { changes, recent: mock.jira.search("updated >= -1m ORDER BY updated DESC").map((issue) => issue.key), me: mock.me.accountId, mock };
    };
    const first = run();
    const second = run();
    const authors = first.changes.map(({ key }) => first.mock.jira.findIssue(key).histories[0]?.author.accountId ?? first.mock.jira.findIssue(key).comments.at(-1)?.author.accountId);

    expect(first.changes).toEqual(second.changes);
    expect(new Set(first.recent)).toEqual(new Set(first.changes.map(({ key }) => key)));
    expect(authors.every((author) => author !== first.me)).toBe(true);
  });
});

describe("Jira-Mock: Latenz, 429 und Fehler", () => {
  it("verzögert Antworten nach Route und Seitengröße", async () => {
    vi.useFakeTimers();
    const mock = createJiraMock({ issues: 200, projects: ["PERF"], latency: { default: { base: 100 }, search: { base: 200, perItem: 2 } } });
    let done = false;
    const pending = call<SearchPage>(mock, `/api/3/search/jql?${new URLSearchParams({ jql: "project = PERF", fields: "summary", maxResults: "50" })}`).then((result) => {
      done = true;
      return result;
    });
    await vi.advanceTimersByTimeAsync(299);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect((await pending).body.issues).toHaveLength(50);
  });

  it("liefert mit Jitter reproduzierbare virtuelle Ladezeiten", async () => {
    vi.useFakeTimers({ now: NOW });
    const measure = async () => {
      const mock = createJiraMock({ issues: 1000, projects: ["PERF"], latency: LATENCY.realistic });
      const start = Date.now();
      const loading = searchAll(mock, { jql: "project = PERF", fields: "summary", maxResults: "100" });
      await vi.runAllTimersAsync();
      await loading;
      return Date.now() - start;
    };
    const first = await measure();

    expect(await measure()).toBe(first);
    expect(first).toBeGreaterThanOrEqual(10 * (100 + 400));
    expect(first).toBeLessThanOrEqual(10 * (400 + 400));
  });

  it("bricht bei AbortSignal ab, ohne die Mutation anzuwenden", async () => {
    vi.useFakeTimers();
    const mock = createJiraMock({ issues: 20, latency: { default: { base: 500 } } });
    const controller = new AbortController();
    const before = mock.jira.findIssue("PERF-1").fields.summary;
    const pending = mock.fetch(`${mock.baseUrl}/api/3/issue/PERF-1`, { method: "PUT", headers: AUTH, body: JSON.stringify({ fields: { summary: "nie" } }), signal: controller.signal });
    const rejected = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await vi.advanceTimersByTimeAsync(100);
    controller.abort();
    await rejected;

    expect(mock.jira.findIssue("PERF-1").fields.summary).toBe(before);
    expect(mock.stats()).toMatchObject({ aborted: 1, inFlight: 0 });
  });

  it("drosselt per Token-Bucket mit 429 und Retry-After", async () => {
    let clock = NOW;
    const mock = createJiraMock({ issues: 10, rateLimit: { requests: 2, perMs: 2000 }, now: () => clock });
    const statuses = [];
    for (let index = 0; index < 3; index++) statuses.push(await call(mock, "/api/3/myself"));
    clock += 999;
    const stillLimited = await call(mock, "/api/3/myself");
    clock += 1;
    const recovered = await call(mock, "/api/3/myself");

    expect(statuses.map((result) => result.status)).toEqual([200, 200, 429]);
    expect(statuses[2].headers.get("retry-after")).toBe("1");
    expect(stillLimited.status).toBe(429);
    expect(recovered.status).toBe(200);
    expect(mock.stats().rateLimited).toBe(2);
  });

  it("injiziert Fehler gezielt nach Route, Anzahl, Vorlauf und Wahrscheinlichkeit", async () => {
    const mock = createJiraMock({ issues: 10, faults: [{ route: "myself", status: 503, skip: 1, times: 2 }] });
    const myself = [];
    for (let index = 0; index < 4; index++) myself.push((await call(mock, "/api/3/myself")).status);
    const remove = mock.addFault({ route: "fields", status: 429, retryAfter: 7 });
    const limited = await call(mock, "/api/3/field");
    remove();
    const restored = await call(mock, "/api/3/field");
    mock.addFault({ method: "PUT", status: "network" });
    const network = mock.fetch(`${mock.baseUrl}/api/3/issue/PERF-1`, { method: "PUT", headers: AUTH, body: "{}" });

    expect(myself).toEqual([200, 503, 503, 200]);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("7");
    expect(restored.status).toBe(200);
    await expect(network).rejects.toBeInstanceOf(TypeError);

    const pattern = async () => {
      const flaky = createJiraMock({ issues: 10, seed: 5, faults: [{ route: "myself", status: 500, probability: 0.3 }] });
      const results = [];
      for (let index = 0; index < 30; index++) results.push((await call(flaky, "/api/3/myself")).status);
      return results;
    };
    const flaky = await pattern();
    expect(flaky).toEqual(await pattern());
    expect(flaky.filter((status) => status === 500).length).toBeGreaterThan(3);
  });

  it("zählt Requests je Route und die maximale Parallelität", async () => {
    vi.useFakeTimers();
    const mock = createJiraMock({ issues: 300, projects: ["PERF"], latency: { default: { base: 50, jitter: 20 } } });
    const requests = Array.from({ length: 5 }, (_, index) => call(mock, `/api/3/issue/PERF-${index + 1}?fields=summary`));
    requests.push(call(mock, "/api/3/field"));
    await vi.advanceTimersByTimeAsync(100);
    await Promise.all(requests);
    const stats = mock.stats();

    expect(stats).toMatchObject({ total: 6, inFlight: 0, maxInFlight: 6, failed: 0, byRoute: { issue: 5, fields: 1 }, byStatus: { "200": 6 } });
    expect(stats.bytes).toBeGreaterThan(1000);
    expect(mock.requests.map((entry) => entry.path)).toContain("/ex/jira/mock-cloud/rest/api/3/field");
    mock.resetStats();
    expect(mock.stats().total).toBe(0);
  });
});

describe("Jira-Mock: Transport", () => {
  it("prüft Authentifizierung, Site und unbekannte Routen", async () => {
    const mock = createJiraMock({ issues: 5 });
    const anonymous = await mock.fetch(`${mock.baseUrl}/api/3/myself`);
    const otherSite = await mock.fetch("https://api.atlassian.com/ex/jira/fremd/rest/api/3/myself", { headers: AUTH });
    const unknown = await call(mock, "/api/3/dashboard");

    expect([anonymous.status, otherSite.status, unknown.status]).toEqual([401, 404, 404]);
    expect(unknown.body.errorMessages[0]).toMatch(/not implemented/);
  });

  it("simuliert die Tauri-Session für den Produktions-Client", async () => {
    const mock = createJiraMock({ issues: 5 });
    const session = JSON.parse((await mock.invoke("session_get")) as string);

    expect(session).toMatchObject({ cloudId: mock.cloudId, accessToken: expect.any(String) });
    await mock.invoke("session_delete");
    expect(await mock.invoke("session_get")).toBeNull();
    await expect(mock.invoke("oauth_login")).rejects.toThrow(/not simulated/);
  });
});
