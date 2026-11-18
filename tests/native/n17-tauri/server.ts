import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Schema } from "effect";
import { createJiraMock } from "../../jira/mock-backend";
import { articleFrom, articleTime, expectedNote, ticketTitle } from "./note";

const jira = createJiraMock({ issues: 3, projects: ["DEMO"] });
const prefix = `/ex/jira/${jira.cloudId}/rest/`;
const ticket = {
  id: 41, number: "20043776", title: ticketTitle, group_id: 1, state_id: 2, priority_id: 2, owner_id: 3, customer_id: 7,
  state: "open", priority: "2 normal", group: "Service Desk", owner: "alex@example.test", customer: "sam@example.test",
  created_at: "2026-11-01T09:00:00Z", updated_at: articleTime,
};
const source = {
  id: 11, ticket_id: 41, from: articleFrom, to: "support@example.test", subject: "Anmeldung schlägt fehl",
  body: '<p>Seit heute kann ich mich nicht mehr am <b>Kundenportal</b> anmelden.</p><img src="https://tracker.invalid/pixel"><script>parent.__n17Injected = true</script>',
  content_type: "text/html", type: "email", sender: "Customer", created_by_id: 7, message_id: "original@example.test",
  internal: false, created_at: articleTime, attachments: [{ id: 6, filename: "fehler.txt", size: 42 }],
};
const author = { id: 3, firstname: "Alex", lastname: "Support", email: "alex@example.test", active: true };
const customer = { id: 7, firstname: "Sam", lastname: "Kunde", email: "sam@example.test", active: true };
const decodeNote = Schema.decodeUnknownOption(Schema.Struct({
  ticket_id: Schema.Literal(expectedNote.ticket_id),
  internal: Schema.Literal(expectedNote.internal),
  type: Schema.Literal(expectedNote.type),
  content_type: Schema.Literal(expectedNote.content_type),
  sender: Schema.Literal(expectedNote.sender),
  subject: Schema.Literal(expectedNote.subject),
  body: Schema.Literal(expectedNote.body),
  attachments: Schema.Tuple([]),
}), { onExcessProperty: "error" });

type Credential = "A" | "B";
const writes: { method: string; path: string; credential: Credential; body: unknown }[] = [];
const identities: Credential[] = [];
const sourceReads: { path: string; credential: Credential }[] = [];
const released: Credential[] = [];
const unexpected: string[] = [];
let note: { id: number; created_at: string; from: string } | undefined;
let armed = false;
let held: (() => void) | undefined;

const reject = (request: Request, status = 400) => {
  const url = new URL(request.url);
  unexpected.push(`${request.method} ${url.pathname}${url.search}`);
  return Response.json({ error: "Unexpected N17 fixture request" }, { status });
};
const plain = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(request) {
    const { pathname } = new URL(request.url);
    const { method } = request;
    if (method === "GET" && pathname === "/__n17/probe") return Response.json({ fixture: true });
    if (request.headers.get("authorization") !== "Bearer mock") return reject(request, 401);
    if (method === "GET" && pathname === "/__n17/state") return Response.json({
      sourceReads, identities, writes, released, held: !!held, armed, unexpected: unexpected.length, unexpectedRequests: unexpected,
    });
    if (method === "POST" && pathname === "/__n17/hold" && !armed && !held) {
      armed = true;
      return new Response(null, { status: 204 });
    }
    if (method === "POST" && pathname === "/__n17/release" && held) {
      held();
      return new Response(null, { status: 204 });
    }
    if (pathname.startsWith(prefix) && (method === "GET" || (method === "POST" && pathname === `${prefix}api/3/search/approximate-count`)))
      return jira.handle(request);
    return reject(request);
  },
});

const tlsDir = process.argv[2]!;
const tls = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  tls: { key: readFileSync(join(tlsDir, "server.key"), "utf8"), cert: readFileSync(join(tlsDir, "server.pem"), "utf8") },
  async fetch(request) {
    const { pathname, search } = new URL(request.url);
    const { method } = request;
    if (method === "GET" && pathname === "/probe") return Response.json({ fixture: true });
    const token = request.headers.get("authorization");
    const credential = token === "Token token=fixture-a" ? "A" : token === "Token token=fixture-b" ? "B" : undefined;
    if (!credential) return reject(request, 401);
    if (method !== "GET") {
      const body: unknown = await request.json().catch(() => null);
      writes.push({ method, path: pathname, credential, body });
      const decoded = decodeNote(body);
      if (method !== "POST" || pathname !== "/api/v1/ticket_articles" || credential !== "A" || writes.length !== 1 || decoded._tag === "None")
        return reject(request, 403);
      note = { ...decoded.value, id: 101, from: "Alex Support", created_at: "2026-11-09T12:00:00Z" };
      return Response.json(note, { status: 201 });
    }
    if (pathname === "/api/v1/users/me") {
      identities.push(credential);
      return Response.json(author);
    }
    if (pathname === "/api/v1/users/3") return Response.json(author);
    if (pathname === "/api/v1/users/7") return Response.json(customer);
    if (pathname === "/api/v1/tickets/41") return Response.json(ticket);
    if (pathname === "/api/v1/ticket_articles/by_ticket/41" && search === "?expand=true") {
      sourceReads.push({ path: pathname + search, credential });
      if (armed) {
        armed = false;
        await new Promise<void>((resolve) => { held = resolve; });
        held = undefined;
        released.push(credential);
        return Response.json([{ ...source, body: "Verspäteter Quelltext aus Revision A" }]);
      }
      return Response.json(note ? [source, note] : [source]);
    }
    if (pathname === "/api/v1/tags") return Response.json({ tags: [] });
    if (pathname === "/api/v1/links") return Response.json({ links: [] });
    if (pathname === "/api/v1/tickets/41/time_accountings") return Response.json([]);
    if (pathname === "/api/v1/ticket_states") return Response.json([{ id: 2, name: "open" }]);
    if (pathname === "/api/v1/ticket_priorities") return Response.json([{ id: 2, name: "2 normal" }]);
    if (pathname === "/api/v1/groups") return Response.json([{ id: 1, name: "Service Desk" }]);
    return reject(request);
  },
});

console.log(plain.port, tls.port);
