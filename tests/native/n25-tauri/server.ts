import { join } from "node:path";
import { createJiraMock } from "../../jira/mock-backend";

const tls = process.argv[2];
if (!tls) throw new Error("N25 requires private TLS certificate files");
const worklogMode = process.argv[3] === "worklogs";
const scmMode = process.argv[3] === "scm";
const graphql: string[] = [];

const jira = createJiraMock({ issues: 6, projects: ["DEMO"] });
const prefix = `/ex/jira/${jira.cloudId}/rest/`;
const api = `${prefix}api/3`;
const type = { id: "10000", name: "Blocks", outward: "blocks", inward: "is blocked by" };
const forward = { id: "n25-link-42", type, outwardIssue: { key: "DEMO-2" } };
const backward = { id: "n25-link-42", type, inwardIssue: { key: "DEMO-1" } };
const other = { id: "n25-link-43", type, outwardIssue: { key: "DEMO-3" } };
const symmetric = {
  id: "n25-link-44",
  type: { id: "10001", name: "Relates", outward: "relates to", inward: "relates to" },
  outwardIssue: { key: "DEMO-4" },
};
const duplicateType = { id: "10002", name: "Duplicate", outward: "duplicates", inward: "is duplicated by" };
const duplicate = { id: "n10-link-50", type: duplicateType, outwardIssue: { key: "DEMO-2" } };
const origin = { id: duplicate.id, type: duplicateType, inwardIssue: { key: "DEMO-1" } };
const duplicateFields = "summary,status,issuetype,priority,issuelinks";

const phases = ["idle", "outward", "inward", "denied", "changed-link", "changed-type", "account", "new-account",
  "n10-outward", "n10-inward", "n10-denied", "n10-changed-link", "n10-ticket", "n10-account", "n10-new-account",
  "worklog-valid", "worklog-denied", "worklog-held", "days", "scm-read", "scm-redirect"] as const;
type Phase = typeof phases[number];
type Read = {
  phase: Phase;
  method: "GET";
  path: string;
  query: string;
  account: string;
  origin: string | null;
  status: number | "held";
  links?: object[];
};

let phase: Phase = "idle";
let account = "mock-user-000";
let pending: (() => void) | undefined;
const reads: Read[] = [];
const writes: string[] = [];
const unexpectedRequests: string[] = [];
const released: string[] = [];
const shellReadPosts: string[] = [];
const sourceId = jira.jira.findIssue("DEMO-1").id;
const started = new Date();
started.setHours(0, 1, 0, 0);
const sourceWorklog = { id: "77", issueId: sourceId, author: { accountId: "mock-user-000" }, started: started.toISOString(), timeSpentSeconds: 3600, comment: "Versandbelege geprüft" };

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  tls: { key: Bun.file(join(tls, "server.key")), cert: Bun.file(join(tls, "server.pem")) },
  async fetch(request) {
    const { protocol, pathname, search, searchParams } = new URL(request.url);
    const method = request.method;
    const reject = (status = 400) => {
      unexpectedRequests.push(`${method} ${pathname}${search}`);
      return Response.json({ errorMessages: ["Unexpected N25 fixture request"] }, { status });
    };
    if (protocol !== "https:") return reject();
    if (method === "GET" && pathname === "/__n25/probe") return Response.json({ fixture: true });
    if (scmMode && pathname === "/api/graphql") {
      if (method !== "POST" || search || request.headers.get("authorization") !== "Bearer fixture-scm-token") return reject(403);
      if (phase !== "scm-read" && phase !== "scm-redirect") return reject();
      const input: { query?: unknown; variables?: { owner?: string; name?: string; number?: number; first?: number; states?: unknown } } = await request.json();
      const v = input.variables;
      if (typeof input.query !== "string" || /\bmutation\b/.test(input.query) || v?.owner !== "fixture" || v?.name !== "repo") return reject();
      const url = `${new URL(request.url).origin}/fixture/repo/pull/7`;
      if (/^\s*query\(\$owner: String!, \$name: String!, \$states:/.test(input.query) &&
          input.query.includes("pullRequests(states:") && v.first === 25 && JSON.stringify(v.states) === '["OPEN"]') {
        graphql.push("scm-list");
        return Response.json({ data: { repository: { pullRequests: { totalCount: 1, nodes: [{
          number: 7, title: "Prüfe synthetischen Beleg", url, state: "OPEN", isDraft: false,
          headRefName: "notes", baseRefName: "development", updatedAt: new Date(Date.now() - 60_000).toISOString(), author: null,
          latestReviews: { nodes: [] }, reviewRequests: { nodes: [] }, commits: { nodes: [] },
        }] } } } });
      }
      if (!/^\s*query N23ReviewThreads\(/.test(input.query) || !input.query.includes("isResolved isOutdated") || v.number !== 7 || v.first !== 8) return reject();
      graphql.push(phase);
      if (phase === "scm-redirect") return new Response(null, { status: 307, headers: { Location: "/api/graphql" } });
      return Response.json({ data: { viewer: { login: "fixture-viewer" }, repository: {
        nameWithOwner: "fixture/repo", pullRequest: { number: 7, url, reviewThreads: {
          totalCount: 1, pageInfo: { hasNextPage: false }, nodes: [{ id: "one", path: "src/demo.ts", isResolved: false, isOutdated: true, comments: { nodes: [{ url: `${url}#discussion_r7` }] } }],
        } },
      } } });
    }
    const countQuery = method === "POST" && pathname === `${api}/search/approximate-count`;
    if (pathname.startsWith(prefix) && method !== "GET" && !countQuery) {
      writes.push(`${method} ${pathname}${search}`);
      return reject();
    }
    if (request.headers.get("authorization") !== "Bearer mock") return reject(401);
    if (method === "GET" && pathname === "/__n25/state") return Response.json({
      transport: protocol.slice(0, -1), reads, writes, shellReadPosts, released, worklogMode, scmMode, graphql,
      held: !!pending, unexpected: unexpectedRequests.length, unexpectedRequests,
    });
    if (method === "POST" && pathname === "/__n25/phase" && !pending) {
      const next = phases.find((value) => value === searchParams.get("name"));
      if (!next) return reject();
      phase = next;
      return new Response(null, { status: 204 });
    }
    if (method === "POST" && pathname === "/__n25/switch-account" && (phase === "account" || phase === "n10-account") && pending) {
      account = phase === "account" ? "mock-user-001" : "mock-user-002";
      return new Response(null, { status: 204 });
    }
    if (method === "POST" && pathname === "/__n25/release" && pending) {
      pending();
      pending = undefined;
      return new Response(null, { status: 204 });
    }
    if (worklogMode && method === "GET") {
      if (pathname === `${api}/search/jql` && searchParams.get("jql")?.startsWith("worklogAuthor = currentUser() AND worklogDate"))
        return Response.json({ issues: [{ id: sourceId, key: "DEMO-1", fields: { summary: "Versandbelege" } }], isLast: true });
      if (pathname === `${api}/issue/${sourceId}/worklog`) return Response.json({ startAt: 0, total: 2, worklogs: [
        sourceWorklog, { ...sourceWorklog, id: "78", author: { accountId: "mock-user-001" } },
      ] });
      const source = pathname === `${api}/issue/${sourceId}/worklog/77`;
      const target = pathname === `${api}/issue/DEMO-2` && searchParams.get("fields") === "summary,project";
      const rights = pathname === `${api}/mypermissions` && searchParams.has("issueId");
      if (source || target || rights) {
        const read: Read = { phase, method, path: pathname.slice(api.length), query: search, account, origin: request.headers.get("origin"), status: 200 };
        reads.push(read);
        if (source && phase === "worklog-held") {
          read.status = "held";
          await new Promise<void>((resolve) => { pending = resolve; });
          read.status = 200;
          released.push(read.phase);
        }
        if (source) return Response.json(sourceWorklog);
        if (rights) {
          const names = searchParams.get("permissions")?.split(",") ?? [];
          return Response.json({ permissions: Object.fromEntries(names.map((name) => [name, {
            havePermission: name !== "DELETE_ALL_WORKLOGS" && !(name === "WORK_ON_ISSUES" && phase === "worklog-denied"),
          }])) });
        }
      }
    }
    const compare = searchParams.get("fields") === duplicateFields;
    const key = pathname.startsWith(`${api}/issue/`) && (search === "?fields=issuelinks" || (phase.startsWith("n10-") && compare))
      ? pathname.slice(`${api}/issue/`.length) : undefined;
    if (method === "GET" && (pathname === `${api}/myself` || key)) {
      const read: Read = {
        phase, method, path: pathname.slice(api.length), query: search,
        account, origin: request.headers.get("origin"), status: 200,
      };
      reads.push(read);
      if (!key) return Response.json({ accountId: account, displayName: `N25 ${account}`, avatarUrls: { "48x48": "" } });
      if (compare) {
        if (key !== "DEMO-1" && key !== "DEMO-2") return reject();
        if (key === "DEMO-2" && phase === "n10-denied") {
          read.status = 403;
          return Response.json({ errorMessages: ["Private N10 permission detail"] }, { status: 403 });
        }
        read.links = key === "DEMO-1" ? [forward, duplicate] : [{ ...origin, id: phase === "n10-changed-link" ? "n10-link-51" : origin.id }];
        if (key === "DEMO-2" && (phase === "n10-ticket" || phase === "n10-account")) {
          read.status = "held";
          await new Promise<void>((resolve) => { pending = resolve; });
          read.status = 200;
          released.push(read.phase);
        }
        const fields = key === "DEMO-1"
          ? { summary: "Doppelter Beleg", status: { name: "Offen" }, issuetype: { name: "Fehler" }, priority: { name: "Hoch" } }
          : { summary: read.account === "mock-user-002" ? "Ursprung für Konto C" : "Erster Beleg", status: { name: "In Arbeit" }, issuetype: { name: "Aufgabe" } };
        return Response.json({ key, fields: { ...fields, issuelinks: read.links } });
      }
      if (key === "DEMO-2" && phase === "denied") {
        read.status = 403;
        return Response.json({ errorMessages: ["Private N25 permission detail"] }, { status: 403 });
      }
      if (key === "DEMO-1") read.links = [forward, other, symmetric, duplicate];
      else if (key === "DEMO-2") {
        read.links = [phase === "changed-link" ? { ...backward, id: "n25-link-46" }
          : phase === "changed-type" ? { ...backward, type: { ...type, id: "10004" } }
            : backward, origin];
      } else read.links = [];
      if (key === "DEMO-2" && phase === "account" && account === "mock-user-000") {
        read.status = "held";
        await new Promise<void>((resolve) => { pending = resolve; });
        read.status = 200;
        released.push(read.phase);
      }
      return Response.json({ key, fields: { issuelinks: read.links } });
    }
    if (method === "GET" && pathname === `${api}/issueLinkType`)
      return Response.json({ issueLinkTypes: [type, symmetric.type, duplicateType] });
    if (countQuery) shellReadPosts.push(pathname.slice(api.length));
    if (pathname.startsWith(prefix) && (method === "GET" || countQuery)) return jira.handle(request);
    return reject();
  },
});

console.log(server.port);
