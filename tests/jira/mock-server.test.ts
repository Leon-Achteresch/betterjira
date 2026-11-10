import { afterAll, describe, expect, it } from "vitest";
import { createJiraMock } from "./mock-backend";
import { serveJiraMock } from "./mock-server";

const mock = createJiraMock({ issues: 300, projects: ["PERF"] });
const server = await serveJiraMock(mock);
const AUTH = { authorization: "Bearer mock" };

afterAll(() => server.close());

describe("Jira-Mock als HTTP-Server", () => {
  it("beantwortet REST- und Agile-Aufrufe über echtes HTTP", async () => {
    const search = await fetch(`${server.url}/rest/api/3/search/jql?${new URLSearchParams({ jql: "project = PERF", fields: "summary", maxResults: "20" })}`, { headers: AUTH });
    const config = await fetch(`${server.url}/rest/agile/1.0/board/1/configuration`, { headers: AUTH });
    const edit = await fetch(`${server.url}/rest/api/3/issue/PERF-1`, { method: "PUT", headers: { ...AUTH, "content-type": "application/json" }, body: JSON.stringify({ fields: { summary: "Per HTTP" } }) });
    const page = (await search.json()) as { issues: unknown[]; nextPageToken?: string };

    expect(search.status).toBe(200);
    expect(page.issues).toHaveLength(20);
    expect(page.nextPageToken).toEqual(expect.any(String));
    expect(config.status).toBe(200);
    expect(edit.status).toBe(204);
    expect(mock.jira.findIssue("PERF-1").fields.summary).toBe("Per HTTP");
  });

  it("unterstützt CORS-Preflight und Steuer-Endpunkte", async () => {
    const preflight = await fetch(`${server.url}/rest/api/3/myself`, { method: "OPTIONS" });
    const changes = await fetch(`${server.url}/__mock/changes?count=3`, { method: "POST" });
    const stats = (await (await fetch(`${server.url}/__mock/stats`)).json()) as { total: number; byRoute: Record<string, number> };

    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe("*");
    expect(await changes.json()).toHaveLength(3);
    expect(stats.byRoute).toMatchObject({ search: 1, "board-config": 1, "issue-edit": 1 });
  });

  it("bricht Antworten bei Netzwerkfehlern ab und gibt Retry-After weiter", async () => {
    const removeNetwork = mock.addFault({ route: "myself", status: "network", times: 1 });
    await expect(fetch(`${server.url}/rest/api/3/myself`, { headers: AUTH })).rejects.toThrow();
    removeNetwork();
    mock.addFault({ route: "myself", status: 429, retryAfter: 3, times: 1 });
    const limited = await fetch(`${server.url}/rest/api/3/myself`, { headers: AUTH });

    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("3");
  });
});
