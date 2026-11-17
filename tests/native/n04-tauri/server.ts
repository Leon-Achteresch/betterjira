import { Schema } from "effect";
import { createJiraMock } from "../../jira/mock-backend";
import { mixedShiftWrites, shiftDates, staleDate } from "../../jira/fixtures/due-date-shift-acceptance";

const jira = createJiraMock({ issues: Object.keys(shiftDates).length, projects: ["DEMO"] });
const tickets = jira.data.issues;
for (const ticket of tickets) {
  ticket.fields.summary = `N04 Fixture ${ticket.key}`;
  ticket.fields.duedate = shiftDates[ticket.key];
}
const prefix = `/ex/jira/${jira.cloudId}/rest/`;
const api3 = `${prefix}api/3`;
const Payload = Schema.Struct({ fields: Schema.Struct({ duedate: Schema.String }) });
const reads: { kind: string; key: string; due?: unknown }[] = [];
const writes: { path: string; payload: unknown; status: number }[] = [];
const released: string[] = [];
const unexpected: string[] = [];
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
      return failure(status, "Unexpected N04 fixture request");
    };
    if (method === "GET" && pathname === "/__n04/probe") return Response.json({ fixture: true });
    if (request.headers.get("authorization") !== "Bearer mock") return reject(401);
    if (method === "GET" && pathname === "/__n04/state") return Response.json({
      reads, writes, held: waiting?.label ?? null, released, unexpected: unexpected.length, unexpectedRequests: unexpected,
      dates: Object.fromEntries(tickets.map(({ key, fields }) => [key, fields.duedate])),
    });
    if (method === "POST" && pathname === "/__n04/stale") {
      jira.jira.findIssue("DEMO-7").fields.duedate = staleDate;
      return new Response(null, { status: 204 });
    }
    if (method === "POST" && pathname === "/__n04/hold" && !hold && !waiting) {
      const kind = searchParams.get("method");
      if (kind !== "GET" && kind !== "PUT") return reject();
      hold = `${kind} DEMO-1`;
      return new Response(null, { status: 204 });
    }
    if (method === "POST" && pathname === "/__n04/release" && waiting) {
      const { label, release } = waiting;
      waiting = undefined;
      released.push(label);
      release();
      return new Response(null, { status: 204 });
    }
    if (method === "GET" && pathname === `${api3}/mypermissions`) {
      const key = searchParams.get("issueKey");
      if (!key || !tickets.some((ticket) => ticket.key === key) || searchParams.get("permissions") !== "EDIT_ISSUES,SCHEDULE_ISSUES") return reject();
      reads.push({ kind: "permissions", key });
      return Response.json({ permissions: { EDIT_ISSUES: { havePermission: true }, SCHEDULE_ISSUES: { havePermission: true } } });
    }
    if (pathname.startsWith(`${api3}/issue/`)) {
      const [key, suffix] = pathname.slice(`${api3}/issue/`.length).split("/");
      const ticket = tickets.find((issue) => issue.key === key);
      if (method === "GET" && suffix === "editmeta" && ticket) {
        reads.push({ kind: "metadata", key });
        return Response.json({ fields: { duedate: { operations: ["set"] } } });
      }
      if (method === "GET" && !suffix && searchParams.get("fields") === "duedate,project,issuetype" && ticket) {
        const { duedate, project, issuetype } = ticket.fields;
        reads.push({ kind: "issue", key, due: duedate });
        await pauseReply(`GET ${key}`);
        return Response.json({ id: ticket.id, key, fields: { duedate, project, issuetype } });
      }
      if (method === "PUT" && !suffix) {
        const payload: unknown = await request.json();
        const decoded = Schema.decodeUnknownOption(Payload)(payload);
        if (!ticket || decoded._tag === "None") return reject();
        const status = hold === `PUT ${key}` ? 204 : (mixedShiftWrites.find((entry) => entry.key === key)?.status ?? 400);
        writes.push({ path: pathname, payload, status });
        if (status === 400) return reject();
        if (status === 204 || status === 503) ticket.fields.duedate = decoded.value.fields.duedate;
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
