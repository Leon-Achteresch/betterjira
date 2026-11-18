import { createJiraMock } from "../../jira/mock-backend";
import timeline from "../../jira/fixtures/status-intervals.json";

const jira = createJiraMock({ issues: 3, projects: ["DEMO"], now: () => Date.parse(timeline.asOf) });
const source = jira.jira.findIssue("DEMO-1");
const target = jira.jira.findIssue("DEMO-2");
const setStatus = (fields: typeof source.fields, status: typeof timeline.current) => {
  const original = fields.status;
  if (!original || typeof original !== "object") throw new Error("Missing Jira fixture status");
  fields.status = { ...original, ...status };
};
source.fields.created = target.fields.created = timeline.created;
setStatus(source.fields, timeline.current);
setStatus(target.fields, { id: "3", name: "In Arbeit" });
source.fields.issuelinks = [{
  id: "10001", type: { id: "10000", name: "Relates", inward: "relates to", outward: "relates to" },
  outwardIssue: { id: target.id, key: target.key, fields: { summary: target.fields.summary } },
}];

const prefix = `/ex/jira/${jira.cloudId}/rest/`;
const api3 = `${prefix}api/3`;
const history = [
  ...Array.from({ length: 40 }, (_, index) => ({
    id: `meta-${index}`,
    created: new Date(Date.parse(timeline.created) + (index + 1) * 60_000).toISOString(),
    items: [{ field: "priority", from: "3", fromString: "Mittel", to: "2", toString: "Hoch" }],
  })),
  ...timeline.changes,
];
const reads: { method: string; path: string; params: Record<string, string>; status: number }[] = [];
const writes: string[] = [];
const released: number[] = [];
const unexpected: string[] = [];
let failed = false;
let held: (() => void) | undefined;

const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const { pathname, search, searchParams } = new URL(request.url);
    const { method } = request;
    const reject = (status = 400) => {
      unexpected.push(`${method} ${pathname}${search}`);
      return Response.json({ errorMessages: ["Unexpected N22 fixture request"] }, { status });
    };
    if (method === "GET" && pathname === "/__n22/probe") return Response.json({ fixture: true });
    if (pathname.startsWith(prefix) && !["GET", "HEAD", "OPTIONS"].includes(method) &&
      !(method === "POST" && pathname === `${api3}/search/approximate-count`)) {
      writes.push(`${method} ${pathname}`);
      return reject();
    }
    if (request.headers.get("authorization") !== "Bearer mock") return reject(401);
    if (method === "GET" && pathname === "/__n22/state") return Response.json({
      reads, writes, released, held: !!held, unexpected: unexpected.length, unexpectedRequests: unexpected,
    });
    if (method === "POST" && pathname === "/__n22/release" && held) {
      held();
      return new Response(null, { status: 204 });
    }
    if (method === "GET" && pathname.startsWith(`${api3}/issue/`) && pathname.endsWith("/changelog")) {
      const key = pathname.split("/").at(-2);
      if (key !== source.key && key !== target.key) return reject();
      const startAt = Number(searchParams.get("startAt"));
      const maxResults = Number(searchParams.get("maxResults"));
      const status = key === source.key && startAt === 6 && !failed ? 403 : 200;
      const sequence = reads.push({ method, path: pathname, params: Object.fromEntries(searchParams), status });
      if (status === 403) {
        failed = true;
        return Response.json({ errorMessages: ["Synthetischer Lesefehler der älteren Seite"] }, { status });
      }
      if (key === source.key && startAt === 0 && maxResults === 6 && !released.length) {
        await new Promise<void>((resolve) => { held = resolve; });
        held = undefined;
        released.push(sequence);
      }
      const changes = key === source.key ? history : [];
      const values = changes.slice(startAt, startAt + maxResults);
      return Response.json({ startAt, maxResults, total: changes.length, values, isLast: startAt + values.length >= changes.length });
    }
    if (pathname.startsWith(prefix) && (method === "GET" || (method === "POST" && pathname === `${api3}/search/approximate-count`)))
      return jira.handle(request);
    return reject();
  },
});

console.log(server.port);
