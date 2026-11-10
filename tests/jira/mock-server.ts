import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import type { JiraMock } from "./mock-backend";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, x-atlassian-token",
  "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
  "access-control-expose-headers": "retry-after, ratelimit-reason",
};

const headersOf = (request: IncomingMessage) =>
  Object.entries(request.headers).flatMap(([name, value]): [string, string][] =>
    value === undefined ? [] : Array.isArray(value) ? value.map((entry): [string, string] => [name, entry]) : [[name, value]],
  );

const readAll = async (request: IncomingMessage) => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
};

const control = (backend: JiraMock, method: string, url: URL) => {
  if (method === "GET" && url.pathname === "/__mock/stats") return backend.stats();
  if (method === "POST" && url.pathname === "/__mock/changes") return backend.simulateChanges(Number(url.searchParams.get("count") ?? 1));
  if (method === "POST" && url.pathname === "/__mock/reset-stats") {
    backend.resetStats();
    return backend.stats();
  }
  return undefined;
};

export const serveJiraMock = async (backend: JiraMock, { port = 0, hostname = "127.0.0.1" }: { port?: number; hostname?: string } = {}) => {
  const server = createServer(async (request, response) => {
    const controller = new AbortController();
    response.on("close", () => {
      if (!response.writableEnded) controller.abort();
    });
    try {
      const method = request.method ?? "GET";
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? hostname}`);
      if (method === "OPTIONS") {
        response.writeHead(204, CORS).end();
        return;
      }
      if (url.pathname.startsWith("/__mock/")) {
        const result = control(backend, method, url);
        response.writeHead(result === undefined ? 404 : 200, { ...CORS, "content-type": "application/json" }).end(JSON.stringify(result ?? { error: "unknown control endpoint" }));
        return;
      }
      const body = method === "GET" || method === "HEAD" ? undefined : await readAll(request);
      const answer = await backend.handle(new Request(url, { method, headers: headersOf(request), body: body?.length ? body : undefined, signal: controller.signal }));
      response.writeHead(answer.status, { ...CORS, ...Object.fromEntries(answer.headers) }).end(Buffer.from(await answer.arrayBuffer()));
    } catch {
      response.destroy();
    }
  });
  await new Promise<void>((resolve) => server.listen(port, hostname, resolve));
  const { port: actualPort } = server.address() as AddressInfo;
  return {
    url: `http://${hostname}:${actualPort}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
};
