import { createJiraMock } from "../../jira/mock-backend";
import { adf } from "../../jira/mock-data";

const jira = createJiraMock({ issues: 3, projects: ["DEMO"] });
const field = jira.data.fields.find(({ id }) => id === "description");
if (!field) throw new Error("Description metadata missing from Jira fixture");
field.name = "Beschreibung";
const key = "DEMO-1";
const cloudPrefix = `/ex/jira/${jira.cloudId}/rest/`;
const issuePath = `${cloudPrefix}api/3/issue/${key}`;
const reads: { cloud: string; status: number | "pending"; description?: unknown }[] = [];
const writes: { path: string; payload: unknown; status: number }[] = [];
let holdNext = false;
let release: (() => void) | undefined;
let unexpected = 0;
const descriptions = {
  initial: adf("C1 Ausgangsfassung"),
  remote: adf("C1 Jira-Fassung"),
  revised: adf("C1 Jira-Zwischenstand"),
  beforeLogout: adf("C1 Jira-Fassung vor Abmeldung"),
};
const setDescription = (description: unknown) => jira.jira.editIssue(key, { fields: { description } });
setDescription(descriptions.initial);

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const url = new URL(request.url);
    const { pathname } = url;
    const method = request.method;
    if (method === "GET" && pathname === "/__c1/probe") return Response.json({ fixture: true });
    if (request.headers.get("authorization") !== "Bearer mock") {
      unexpected++;
      return new Response(null, { status: 401 });
    }
    if (pathname === "/__c1/state" && method === "GET") return Response.json({ reads, writes, unexpected, held: !!release });
    if (pathname === "/__c1/remote" && method === "POST") {
      const revision = url.searchParams.get("revision");
      if (revision === "remote" || revision === "revised" || revision === "beforeLogout") {
        setDescription(descriptions[revision]);
        return new Response(null, { status: 204 });
      }
    }
    if (pathname === "/__c1/hold" && method === "POST" && !holdNext && !release) {
      holdNext = true;
      return new Response(null, { status: 204 });
    }
    if (pathname === "/__c1/release" && method === "POST" && release) {
      const resume = release;
      release = undefined;
      resume();
      return new Response(null, { status: 204 });
    }
    if (pathname.startsWith(cloudPrefix)) {
      if (method === "GET" && pathname === issuePath && url.searchParams.get("fields") === "description") {
        const read: (typeof reads)[number] = { cloud: jira.cloudId, status: "pending" };
        reads.push(read);
        if (holdNext) {
          holdNext = false;
          await new Promise<void>((resolve) => { release = resolve; });
        }
        const response = await jira.handle(request);
        read.status = response.status;
        const reply: { fields?: { description?: unknown } } = await response.clone().json();
        read.description = reply.fields?.description;
        return response;
      }
      if (method === "PUT" && pathname === issuePath) {
        const payload: unknown = await request.clone().json();
        const response = await jira.handle(request);
        writes.push({ path: pathname, payload, status: response.status });
        return response;
      }
      if (method === "GET" || (method === "POST" && pathname.endsWith("/search/approximate-count")))
        return jira.handle(request);
    }
    unexpected++;
    return Response.json({ error: "Unexpected fixture request" }, { status: 400 });
  },
});

console.log(server.port);
