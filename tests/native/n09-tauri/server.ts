import { createJiraMock } from "../../jira/mock-backend";
import searchPage from "../../jira/fixtures/creation-hints.json";

const jira = createJiraMock({ issues: 12, projects: ["DEMO", "OPS"] });
const [demo, ops] = jira.data.projects;
const task = jira.data.issueTypes.find(({ name }) => name === "Task")!;
const prefix = `/ex/jira/${jira.cloudId}/rest/`;
const api3 = `${prefix}api/3`;
const createFields = [
  { fieldId: "summary", name: "Zusammenfassung", required: true, schema: { type: "string", system: "summary" } },
  { fieldId: "description", name: "Beschreibung", required: false, schema: { type: "string", system: "description" } },
  { fieldId: "customfield_kunde", name: "Kunde", required: true, schema: { type: "string", custom: "com.atlassian.jira.plugin.system.customfieldtypes:textfield" } },
];
const source = jira.jira.findIssue("DEMO-1");
source.fields.summary = "Gateway meldet Fehler";
const firstPage = {
  ...searchPage,
  issues: searchPage.issues.map((issue) => issue.fields.project?.id === "101"
    ? { ...issue, fields: { ...issue.fields, project: { ...issue.fields.project, id: demo.id } } } : issue),
};
const latePage = { isLast: true, issues: [
  { id: "88000", key: "DEMO-6", fields: { summary: "Verspäteter DEMO-Treffer", project: { id: demo.id, key: demo.key } } },
] };
const opsPage = { isLast: true, issues: [
  { id: "88001", key: "OPS-1", fields: { summary: "Betrieb prüft Gateway", project: { id: ops.id, key: ops.key } } },
  firstPage.issues[0],
] };
const myWork = "assignee = currentUser() AND (statusCategory != Done OR resolved >= -7d) ORDER BY updated DESC";
const detailPermissions = new Set(["LINK_ISSUES", "EDIT_OWN_COMMENTS", "EDIT_ALL_COMMENTS", "DELETE_OWN_COMMENTS", "DELETE_ALL_COMMENTS"]);
const searches: { method: string; path: string; params: Record<string, string> }[] = [];
const details: { key: string; status: number }[] = [];
const writes: string[] = [];
const released: number[] = [];
const unexpected: string[] = [];
let held: (() => void) | undefined;

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const { pathname, search, searchParams } = new URL(request.url);
    const { method } = request;
    const reject = (status = 400) => {
      unexpected.push(`${method} ${pathname}${search}`);
      return Response.json({ errorMessages: ["Unexpected N09 fixture request"] }, { status });
    };
    if (method === "GET" && pathname === "/__n09/probe") return Response.json({ fixture: true });
    if (pathname.startsWith(prefix) && !["GET", "HEAD", "OPTIONS"].includes(method) &&
      !(method === "POST" && pathname === `${api3}/search/approximate-count`)) {
      writes.push(`${method} ${pathname}`);
      return reject();
    }
    if (request.headers.get("authorization") !== "Bearer mock") return reject(401);
    if (method === "GET" && pathname === "/__n09/state") return Response.json({
      searches, details, writes, held: !!held, released, unexpected: unexpected.length, unexpectedRequests: unexpected,
    });
    if (method === "POST" && pathname === "/__n09/release" && held) {
      held();
      return new Response(null, { status: 204 });
    }
    if (method === "GET" && pathname === `${api3}/search/jql` && searchParams.get("jql") !== myWork) {
      searches.push({ method, path: pathname, params: Object.fromEntries(searchParams) });
      if (searches.length === 1) return Response.json(firstPage);
      if (searches.length === 2) {
        await new Promise<void>((resolve) => { held = resolve; });
        held = undefined;
        released.push(2);
        return Response.json(latePage);
      }
      if (searches.length === 3) return Response.json(opsPage);
      return reject();
    }
    if (method === "GET" && pathname === `${api3}/mypermissions`) {
      const permissions = searchParams.get("permissions");
      if (permissions === "CREATE_ISSUES" && jira.data.projects.some(({ id }) => id === searchParams.get("projectId")))
        return Response.json({ permissions: { CREATE_ISSUES: { havePermission: true } } });
      const requested = (permissions ?? "").split(",");
      if (!requested.every((permission) => detailPermissions.has(permission))) return reject();
      return Response.json({ permissions: Object.fromEntries(requested.map((permission) => [permission, { havePermission: false }])) });
    }
    if (method === "GET" && jira.data.projects.some(({ id }) => pathname === `${api3}/issue/createmeta/${id}/issuetypes`))
      return Response.json({ total: 1, issueTypes: [task] });
    if (method === "GET" && jira.data.projects.some(({ id }) => pathname === `${api3}/issue/createmeta/${id}/issuetypes/${task.id}`))
      return Response.json({ total: createFields.length, fields: createFields });
    if (method === "GET" && pathname === `${api3}/issue/DEMO-1` && searchParams.get("fields") === "*all") {
      const response = await jira.handle(request);
      details.push({ key: "DEMO-1", status: response.status });
      return response;
    }
    if (pathname.startsWith(prefix) && (method === "GET" || (method === "POST" && pathname === `${api3}/search/approximate-count`)))
      return jira.handle(request);
    return reject();
  },
});

console.log(server.port);
