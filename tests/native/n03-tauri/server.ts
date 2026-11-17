import { Schema } from "effect";
import { createJiraMock } from "../../jira/mock-backend";
import { SITE_URL } from "../../jira/mock-data";

const jira = createJiraMock({ issues: 3, projects: ["DEMO"] });
const parent = jira.data.issues[0]!;
const project = jira.data.projects[0]!;
const subtask = jira.data.issueTypes.find((type) => type.subtask)!;
parent.fields.summary = "N03 Fixture DEMO-1";
const prefix = `/ex/jira/${jira.cloudId}/rest/`;
const api3 = `${prefix}api/3`;
const typesPath = `${api3}/issue/createmeta/${project.id}/issuetypes`;
const createFields = ["summary", "parent", "project", "issuetype"].map((fieldId) => ({
  fieldId, name: fieldId, required: true, schema: { type: "string" }, operations: ["set"],
}));
const commentPermissions = ["EDIT_OWN_COMMENTS", "EDIT_ALL_COMMENTS", "DELETE_OWN_COMMENTS", "DELETE_ALL_COMMENTS"];
const Id = Schema.Struct({ id: Schema.String });
const Payload = Schema.Struct({ fields: Schema.Struct({ summary: Schema.String, project: Id, issuetype: Id, parent: Id }) });
const allowedPosts = new Map([["Login prüfen", 201], ["Antwort abgelehnt", 401], ["Unklare Antwort", 503]]);
const reads: string[] = [];
const writes: { path: string; payload: unknown; status: number }[] = [];
const children: { key: string; summary: string; parent: string }[] = [];
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
      return failure(status, "Unexpected N03 fixture request");
    };
    if (method === "GET" && pathname === "/__n03/probe") return Response.json({ fixture: true });
    if (request.headers.get("authorization") !== "Bearer mock") return reject(401);
    if (method === "GET" && pathname === "/__n03/state") return Response.json({
      writes, reads, children, held: waiting?.label ?? null, released, unexpected: unexpected.length, unexpectedRequests: unexpected,
    });
    if (method === "POST" && pathname === "/__n03/hold" && !hold && !waiting) {
      const phase = searchParams.get("phase");
      if (phase !== "GET parent" && phase !== "POST issue") return reject();
      hold = phase;
      return new Response(null, { status: 204 });
    }
    if (method === "POST" && pathname === "/__n03/release" && waiting) {
      const { label, release } = waiting;
      waiting = undefined;
      released.push(label);
      release();
      return new Response(null, { status: 204 });
    }
    if (method === "GET" && pathname === `${api3}/myself`) reads.push("account");
    if (method === "GET" && pathname === `${api3}/mypermissions`) {
      const permissions = searchParams.get("permissions");
      if (permissions === "CREATE_ISSUES" && searchParams.get("projectId") === project.id) {
        reads.push("permission");
        return Response.json({ permissions: { CREATE_ISSUES: { havePermission: true } } });
      }
      if (permissions === commentPermissions.join(",") && searchParams.get("issueKey") === parent.key) return Response.json({
        permissions: Object.fromEntries(commentPermissions.map((permission) => [permission, { havePermission: false }])),
      });
      if (permissions === "LINK_ISSUES" && searchParams.get("issueKey") === parent.key)
        return Response.json({ permissions: { LINK_ISSUES: { havePermission: false } } });
      return reject();
    }
    if (method === "GET" && pathname === typesPath) {
      reads.push("type");
      return Response.json({ total: 1, issueTypes: [{ id: subtask.id, name: "Unteraufgabe", subtask: true }] });
    }
    if (method === "GET" && pathname === `${typesPath}/${subtask.id}`) {
      reads.push("fields");
      return Response.json({ total: createFields.length, fields: createFields });
    }
    if (method === "GET" && pathname === `${api3}/issue/${parent.key}` && searchParams.get("fields") === "summary,project,issuetype") {
      reads.push("parent");
      await pauseReply("GET parent");
      return jira.handle(request);
    }
    if (method === "POST" && pathname === `${api3}/issue`) {
      const payload: unknown = await request.json();
      const decoded = Schema.decodeUnknownOption(Payload)(payload);
      if (decoded._tag === "None") return reject();
      const { fields } = decoded.value;
      const late = fields.summary === "Verspätet erstellt" && hold === "POST issue";
      const status = fields.parent.id === parent.id && fields.project.id === project.id && fields.issuetype.id === subtask.id
        ? late ? 201 : (allowedPosts.get(fields.summary) ?? 400)
        : 400;
      writes.push({ path: pathname, payload, status });
      if (status === 400) return reject();
      if (status === 401) return failure(status, "Synthetische Ablehnung");
      const issue = jira.jira.createIssue({ fields: { ...fields, parent: { key: parent.key } } });
      children.push({ key: issue.key, summary: fields.summary, parent: parent.id });
      if (late) await pauseReply("POST issue");
      if (status === 503) return failure(status, "Synthetische unklare Rückmeldung nach Anlage");
      return Response.json({ id: issue.id, key: issue.key, self: `${SITE_URL}/rest/api/3/issue/${issue.id}` }, { status });
    }
    if (pathname.startsWith(prefix) && (method === "GET" || (method === "POST" && pathname.endsWith("/search/approximate-count"))))
      return jira.handle(request);
    return reject();
  },
});

console.log(server.port);
