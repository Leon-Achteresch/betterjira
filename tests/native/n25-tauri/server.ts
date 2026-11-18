import { join } from "node:path";
import { createJiraMock } from "../../jira/mock-backend";

const tls = process.argv[2];
if (!tls) throw new Error("N25 requires private TLS certificate files");

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

const phases = ["idle", "outward", "inward", "denied", "changed-link", "changed-type", "account", "new-account"] as const;
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
    const countQuery = method === "POST" && pathname === `${api}/search/approximate-count`;
    if (pathname.startsWith(prefix) && method !== "GET" && !countQuery) {
      writes.push(`${method} ${pathname}${search}`);
      return reject();
    }
    if (request.headers.get("authorization") !== "Bearer mock") return reject(401);
    if (method === "GET" && pathname === "/__n25/state") return Response.json({
      transport: protocol.slice(0, -1), reads, writes, shellReadPosts, released,
      held: !!pending, unexpected: unexpectedRequests.length, unexpectedRequests,
    });
    if (method === "POST" && pathname === "/__n25/phase" && !pending) {
      const next = phases.find((value) => value === searchParams.get("name"));
      if (!next) return reject();
      phase = next;
      return new Response(null, { status: 204 });
    }
    if (method === "POST" && pathname === "/__n25/switch-account" && phase === "account" && pending) {
      account = "mock-user-001";
      return new Response(null, { status: 204 });
    }
    if (method === "POST" && pathname === "/__n25/release" && pending) {
      pending();
      pending = undefined;
      return new Response(null, { status: 204 });
    }
    const key = pathname.startsWith(`${api}/issue/`) && search === "?fields=issuelinks"
      ? pathname.slice(`${api}/issue/`.length) : undefined;
    if (method === "GET" && (pathname === `${api}/myself` || key)) {
      const read: Read = {
        phase, method, path: pathname.slice(api.length), query: search,
        account, origin: request.headers.get("origin"), status: 200,
      };
      reads.push(read);
      if (!key) return Response.json({ accountId: account, displayName: `N25 ${account}`, avatarUrls: { "48x48": "" } });
      if (key === "DEMO-2" && phase === "denied") {
        read.status = 403;
        return Response.json({ errorMessages: ["Private N25 permission detail"] }, { status: 403 });
      }
      if (key === "DEMO-1") read.links = [forward, other, symmetric];
      else if (key === "DEMO-2") {
        read.links = [phase === "changed-link" ? { ...backward, id: "n25-link-46" }
          : phase === "changed-type" ? { ...backward, type: { ...type, id: "10004" } }
            : backward];
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
      return Response.json({ issueLinkTypes: [type, symmetric.type] });
    if (countQuery) shellReadPosts.push(pathname.slice(api.length));
    if (pathname.startsWith(prefix) && (method === "GET" || countQuery)) return jira.handle(request);
    return reject();
  },
});

console.log(server.port);
