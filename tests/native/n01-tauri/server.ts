import { Schema } from "effect";
import { createJiraMock } from "../../jira/mock-backend";

const jira = createJiraMock({ issues: 7, projects: ["DEMO"] });
const tickets = jira.data.issues;
for (const ticket of tickets) ticket.fields.summary = `N01 Fixture ${ticket.key}`;
const prefix = `/ex/jira/${jira.cloudId}/rest/`;
const api3 = `${prefix}api/3`;
const type = { id: "10000", name: "Blocks", outward: "blocks", inward: "is blocked by" };
const commentPermissions = ["EDIT_OWN_COMMENTS", "EDIT_ALL_COMMENTS", "DELETE_OWN_COMMENTS", "DELETE_ALL_COMMENTS"];
const IssueKey = Schema.Struct({ key: Schema.String });
const LinkPayload = Schema.Struct({ type: Schema.Struct({ id: Schema.String }), inwardIssue: IssueKey, outwardIssue: IssueKey });
type LinkPayload = typeof LinkPayload.Type;
const writes: { target: string; path: string; payload: LinkPayload; status: number }[] = [];
const reads: { kind: "ticket" | "permission"; key: string; id?: string }[] = [];
const released: string[] = [];
let hold: string | undefined;
let pending: { key: string; release: () => void } | undefined;
let changedTarget = false;
const unexpected: string[] = [];

const failure = (status: number, message: string) => Response.json({ errorMessages: [message] }, { status });
const addLink = (key: string) => {
  const source = tickets.find((ticket) => ticket.key === "DEMO-4")!;
  const target = tickets.find((ticket) => ticket.key === key)!;
  const reference = (ticket: typeof source) => ({ id: ticket.id, key: ticket.key, fields: { summary: ticket.fields.summary } });
  const id = `link-${key}`;
  const attach = (ticket: typeof source, related: object) => {
    const links = Array.isArray(ticket.fields.issuelinks) ? ticket.fields.issuelinks : [];
    ticket.fields.issuelinks = [...links, { id, type, ...related }];
  };
  attach(source, { inwardIssue: reference(target) });
  attach(target, { outwardIssue: reference(source) });
};

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const { pathname, searchParams, search } = new URL(request.url);
    const { method } = request;
    const reject = (status = 400) => {
      unexpected.push(`${method} ${pathname}${search}`);
      return failure(status, "Unexpected N01 fixture request");
    };
    if (method === "GET" && pathname === "/__n01/probe") return Response.json({ fixture: true });
    if (request.headers.get("authorization") !== "Bearer mock") return reject(401);
    if (method === "GET" && pathname === "/__n01/state")
      return Response.json({ writes, reads, unexpected: unexpected.length, unexpectedRequests: unexpected, held: pending?.key ?? null, released });
    if (method === "POST" && pathname === "/__n01/change-target") {
      changedTarget = searchParams.get("changed") === "true";
      return new Response(null, { status: 204 });
    }
    if (method === "POST" && pathname === "/__n01/hold" && !hold && !pending) {
      const key = searchParams.get("key");
      if (key !== "DEMO-6" && key !== "DEMO-7") return reject();
      hold = key;
      return new Response(null, { status: 204 });
    }
    if (method === "POST" && pathname === "/__n01/release" && pending) {
      const { key, release } = pending;
      pending = undefined;
      released.push(key);
      release();
      return new Response(null, { status: 204 });
    }
    if (method === "GET" && pathname === `${api3}/issueLinkType`) return Response.json({ issueLinkTypes: [type] });
    if (method === "GET" && pathname === `${api3}/mypermissions`) {
      const key = searchParams.get("issueKey");
      const requested = searchParams.get("permissions");
      if (!key || !tickets.some((ticket) => ticket.key === key)) return reject();
      if (requested === commentPermissions.join(",")) return Response.json({
        permissions: Object.fromEntries(commentPermissions.map((permission) => [permission, { havePermission: false }])),
      });
      if (requested !== "LINK_ISSUES") return reject();
      reads.push({ kind: "permission", key });
      if (key === hold) {
        hold = undefined;
        await new Promise<void>((release) => { pending = { key, release }; });
      }
      return Response.json({ permissions: { LINK_ISSUES: { havePermission: true } } });
    }
    if (method === "POST" && pathname === `${api3}/issueLink`) {
      const decoded = Schema.decodeUnknownOption(LinkPayload)(await request.json());
      if (decoded._tag === "None") return reject();
      const payload = decoded.value;
      const target = payload.inwardIssue.key;
      const status = payload.type.id === type.id && payload.outwardIssue.key === "DEMO-4"
        ? ({ "DEMO-2": 201, "DEMO-3": 403, "DEMO-5": 503 } as Record<string, number>)[target] ?? 400
        : 400;
      writes.push({ target, path: pathname, payload, status });
      if (status === 400) return reject();
      if (status === 201 || status === 503) addLink(target);
      return status === 201 ? new Response(null, { status }) : failure(status, `Synthetic HTTP ${status}`);
    }
    if (method === "GET" && pathname.startsWith(`${api3}/issue/`)) {
      const key = pathname.slice(`${api3}/issue/`.length);
      const fields = searchParams.get("fields");
      if (fields === "summary" || fields === "summary,issuelinks") {
        const ticket = tickets.find((entry) => entry.key === key);
        if (!ticket) return reject();
        const id = changedTarget && key === "DEMO-6" ? "99106" : ticket.id;
        reads.push({ kind: "ticket", key, id });
        return Response.json({ id, key, fields: {
          summary: ticket.fields.summary,
          ...(fields.includes("issuelinks") && { issuelinks: ticket.fields.issuelinks }),
        } });
      }
    }
    if (pathname.startsWith(prefix) && (method === "GET" || (method === "POST" && pathname.endsWith("/search/approximate-count"))))
      return jira.handle(request);
    return reject();
  },
});

console.log(server.port);
