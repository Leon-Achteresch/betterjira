import { Schema } from "effect";
import { createJiraMock } from "../../jira/mock-backend";

const jira = createJiraMock({ issues: 9, projects: ["DEMO"] });
const tickets = jira.data.issues;
for (const ticket of tickets) {
  ticket.fields.summary = `N02 Fixture ${ticket.key}`;
  ticket.fields.duedate = `2026-12-${String(ticket.number).padStart(2, "0")}`;
}
const prefix = `/ex/jira/${jira.cloudId}/rest/`;
const api3 = `${prefix}api/3`;
const DueDatePayload = Schema.Struct({ fields: Schema.Struct({ duedate: Schema.String }) });
const reads: { kind: string; key: string; id?: string; due?: unknown }[] = [];
const writes: { key: string; path: string; payload: unknown; status: number }[] = [];
const released: string[] = [];
const unexpected: string[] = [];
let staleIdentity = false;
let hold: string | undefined;
let waiting: { label: string; release: () => void } | undefined;

const pauseReply = async (label: string) => {
  if (hold !== label) return;
  hold = undefined;
  await new Promise<void>((release) => { waiting = { label, release }; });
};
const failure = (status: number, message: string) => Response.json({ errorMessages: [message] }, { status });

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const { pathname, search, searchParams } = new URL(request.url);
    const { method } = request;
    const reject = (status = 400) => {
      unexpected.push(`${method} ${pathname}${search}`);
      return failure(status, "Unexpected N02 fixture request");
    };
    if (method === "GET" && pathname === "/__n02/probe") return Response.json({ fixture: true });
    if (request.headers.get("authorization") !== "Bearer mock") return reject(401);
    if (method === "GET" && pathname === "/__n02/state") return Response.json({
      reads, writes, held: waiting?.label ?? null, released, unexpected: unexpected.length, unexpectedRequests: unexpected,
      dates: Object.fromEntries(tickets.map(({ key, fields }) => [key, fields.duedate])),
    });
    if (method === "POST" && pathname === "/__n02/stale") {
      tickets[1]!.fields.duedate = "2026-12-29";
      staleIdentity = true;
      return new Response(null, { status: 204 });
    }
    if (method === "POST" && pathname === "/__n02/hold" && !hold && !waiting) {
      const kind = searchParams.get("method");
      if (kind !== "GET" && kind !== "PUT") return reject();
      hold = `${kind} DEMO-7`;
      return new Response(null, { status: 204 });
    }
    if (method === "POST" && pathname === "/__n02/release" && waiting) {
      const { label, release } = waiting;
      waiting = undefined;
      released.push(label);
      release();
      return new Response(null, { status: 204 });
    }
    if (method === "GET" && pathname === `${api3}/myself`) reads.push({ kind: "account", key: jira.data.me.accountId });
    if (method === "GET" && pathname === `${api3}/mypermissions`) {
      const key = searchParams.get("issueKey");
      if (!key || !tickets.some((ticket) => ticket.key === key) || searchParams.get("permissions") !== "EDIT_ISSUES,SCHEDULE_ISSUES") return reject();
      reads.push({ kind: "permissions", key });
      return Response.json({ permissions: { EDIT_ISSUES: { havePermission: true }, SCHEDULE_ISSUES: { havePermission: true } } });
    }
    if (pathname.startsWith(`${api3}/issue/`)) {
      const [segment, suffix] = pathname.slice(`${api3}/issue/`.length).split("/");
      const ticket = tickets.find(({ key, id }) => segment === key || segment === id);
      if (method === "GET" && suffix === "editmeta" && ticket) {
        reads.push({ kind: "metadata", key: ticket.key });
        return Response.json({ fields: { assignee: { operations: ["set"] }, duedate: { operations: ["set"] } } });
      }
      if (method === "GET" && !suffix && searchParams.get("fields") === "duedate,project,issuetype" && ticket) {
        const id = staleIdentity && ticket.key === "DEMO-4" ? "99104" : ticket.id;
        const { duedate, project, issuetype } = ticket.fields;
        reads.push({ kind: "issue", key: ticket.key, id, due: duedate });
        await pauseReply(`GET ${ticket.key}`);
        return Response.json({ id, key: ticket.key, fields: { duedate, project, issuetype } });
      }
      if (method === "PUT" && !suffix) {
        const payload: unknown = await request.json();
        const value = Schema.decodeUnknownOption(DueDatePayload)(payload);
        if (!ticket || segment !== ticket.id || value._tag === "None") return reject();
        const key = ticket.key;
        const status = key === "DEMO-1" || key === "DEMO-5" || hold === `PUT ${key}` ? 204
          : key === "DEMO-3" ? 403 : key === "DEMO-6" ? 503 : 400;
        writes.push({ key, path: pathname, payload, status });
        if (status === 400) return reject();
        if (status === 204 || status === 503) ticket.fields.duedate = value.value.fields.duedate;
        await pauseReply(`PUT ${key}`);
        return status === 204 ? new Response(null, { status }) : failure(status, `Synthetic HTTP ${status}`);
      }
    }
    if (pathname.startsWith(prefix) && (method === "GET" || (method === "POST" && pathname.endsWith("/search/approximate-count"))))
      return jira.handle(request);
    return reject();
  },
});

console.log(server.port);
