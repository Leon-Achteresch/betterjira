import { parseArgs } from "node:util";
import { createJiraMock, LATENCY } from "./mock-backend";
import { serveJiraMock } from "./mock-server";

const { values } = parseArgs({
  options: {
    port: { type: "string", default: "8787" },
    issues: { type: "string", default: "5000" },
    projects: { type: "string", default: "PERF,CORE,OPS" },
    seed: { type: "string", default: "1" },
    latency: { type: "string", default: "realistic" },
    "rate-limit": { type: "string" },
    "page-limit": { type: "string" },
  },
});

if (!(values.latency in LATENCY)) throw new Error(`--latency muss einer von ${Object.keys(LATENCY).join(", ")} sein`);
const rate = values["rate-limit"] ? Number(values["rate-limit"]) : undefined;

const backend = createJiraMock({
  issues: Number(values.issues),
  projects: values.projects.split(",").map((key) => key.trim().toUpperCase()),
  seed: Number(values.seed),
  latency: LATENCY[values.latency as keyof typeof LATENCY],
  rateLimit: rate ? { requests: rate, perMs: 1000 } : undefined,
  pageLimit: values["page-limit"] ? Number(values["page-limit"]) : undefined,
});
const server = await serveJiraMock(backend, { port: Number(values.port) });

console.log(`Mock-Jira: ${server.url}/rest/api/3 und ${server.url}/rest/agile/1.0 (${backend.data.issues.length} Issues, Latenz ${values.latency})`);
console.log(`Header nötig: Authorization: Bearer mock · Statistik: GET ${server.url}/__mock/stats · Änderungen: POST ${server.url}/__mock/changes?count=50`);
