import { createJiraMock } from "../../jira/mock-backend";

const jira = createJiraMock({ issues: 12, projects: ["DEMO"] });
const prefix = `/ex/jira/${jira.cloudId}/rest/`;
const api3 = `${prefix}api/3`;
const blocks = { id: "10000", name: "Blocks", outward: "blocks", inward: "is blocked by" };
const relates = { id: "10001", name: "Relates", outward: "relates to", inward: "relates to" };
const outward = (key: string, type = blocks) => ({ type, outwardIssue: { key } });
const inward = (key: string) => ({ type: blocks, inwardIssue: { key } });
const graph: Record<string, object[]> = {
  "DEMO-1": [outward("DEMO-2"), outward("DEMO-2"), outward("DEMO-3"), outward("DEMO-6"), inward("DEMO-4"),
    outward("DEMO-9", relates), outward("DEMO-10", relates)],
  "DEMO-2": [outward("OPS-7"), outward("DEMO-1")],
  "DEMO-3": [outward("OPS-7"), inward("DEMO-7")],
  "DEMO-4": [inward("DEMO-5")],
  "DEMO-9": Array.from({ length: 24 }, (_, i) => outward(`OPS-${i + 101}`)),
  "DEMO-10": [outward("DEMO-11"), outward("DEMO-12")],
  "DEMO-11": [outward("OPS-99")],
};
const permissions = new Set(["LINK_ISSUES", "EDIT_OWN_COMMENTS", "EDIT_ALL_COMMENTS", "DELETE_OWN_COMMENTS", "DELETE_ALL_COMMENTS"]);
type Hold = "ticket" | "account";
const reads: { key: string; account: string; status: number }[] = [];
const writes: string[] = [];
const released: [Hold, string][] = [];
const unexpected: string[] = [];
let account = "mock-user-000";
let armed: Hold | undefined;
let pending: { label: Hold; release: () => void } | undefined;

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const { pathname, search, searchParams } = new URL(request.url);
    const { method } = request;
    const reject = (status = 400) => {
      unexpected.push(`${method} ${pathname}${search}`);
      return Response.json({ errorMessages: ["Unexpected N05 fixture request"] }, { status });
    };
    if (method === "GET" && pathname === "/__n05/probe") return Response.json({ fixture: true });
    if (pathname.startsWith(prefix) && !["GET", "HEAD", "OPTIONS"].includes(method) &&
      !(method === "POST" && pathname.endsWith("/search/approximate-count"))) {
      writes.push(`${method} ${pathname}${search}`);
      return reject();
    }
    if (request.headers.get("authorization") !== "Bearer mock") return reject(401);
    if (method === "GET" && pathname === "/__n05/state") return Response.json({
      reads, writes, held: pending?.label ?? null, armed: armed ?? null, released, unexpected: unexpected.length, unexpectedRequests: unexpected,
    });
    if (method === "POST" && pathname === "/__n05/hold" && !armed && !pending) {
      const label = searchParams.get("phase");
      if (label !== "ticket" && label !== "account") return reject();
      armed = label;
      return new Response(null, { status: 204 });
    }
    if (method === "POST" && pathname === "/__n05/switch-account" && pending?.label === "account") {
      account = "mock-user-001";
      return new Response(null, { status: 204 });
    }
    if (method === "POST" && pathname === "/__n05/release" && pending) {
      const { release } = pending;
      release();
      return new Response(null, { status: 204 });
    }
    if (method === "GET" && pathname === `${api3}/myself`) {
      return Response.json({ accountId: account, displayName: `N05 ${account}`, avatarUrls: { "48x48": "" } });
    }
    if (method === "GET" && pathname === `${api3}/issueLinkType`) return Response.json({ issueLinkTypes: [blocks, relates] });
    if (method === "GET" && pathname === `${api3}/mypermissions`) {
      const requested = (searchParams.get("permissions") ?? "").split(",");
      if (!requested.every((entry) => permissions.has(entry))) return reject();
      return Response.json({ permissions: Object.fromEntries(requested.map((entry) => [entry, { havePermission: false }])) });
    }
    if (method === "GET" && pathname.startsWith(`${api3}/issue/`) && searchParams.get("fields") === "issuelinks") {
      const key = pathname.slice(`${api3}/issue/`.length);
      const status = key === "DEMO-6" ? 403 : 200;
      reads.push({ key, account, status });
      if (status === 403) return Response.json({ errorMessages: ["No permission to read this issue"] }, { status });
      const links = key === "DEMO-11" && account === "mock-user-001" ? [outward("OPS-98")] : graph[key] ?? [];
      if (key === "DEMO-11" && armed) {
        const label = armed;
        armed = undefined;
        await new Promise<void>((release) => { pending = { label, release }; });
        pending = undefined;
        released.push([label, key]);
      }
      return Response.json({ key, fields: { issuelinks: links } });
    }
    if (pathname.startsWith(prefix) && (method === "GET" || (method === "POST" && pathname.endsWith("/search/approximate-count"))))
      return jira.handle(request);
    return reject();
  },
});

console.log(server.port);
