import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";

const port = 5341;
const root = resolve(process.argv[2]);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };
const server = createServer(async (request, response) => {
  try {
    const path = resolve(root, `.${decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname)}`);
    if (!path.startsWith(`${root}${sep}`)) { response.writeHead(403).end(); return; }
    const info = await stat(path);
    if (!info.isFile()) { response.writeHead(404).end(); return; }
    response.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream", "content-length": info.size });
    createReadStream(path).pipe(response);
  } catch { response.writeHead(404).end(); }
});
server.on("error", (error) => {
  process.stderr.write(`${error.code === "EADDRINUSE" ? `Port ${port} belegt` : error.message}\n`);
  process.exit(1);
});
server.listen(port, "127.0.0.1", () => process.stdout.write("READY\n"));
