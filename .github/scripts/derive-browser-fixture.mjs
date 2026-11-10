import { cpSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [repo, out] = process.argv.slice(2);
const index = readFileSync(join(out, "index.html"), "utf8");
const entry = index.match(/<script type="module"[^>]*src="([^"]+\.js)"/)?.[1];
const styles = [...index.matchAll(/<link rel="stylesheet"[^>]*href="([^"]+\.css)"[^>]*>/g)].map((match) => match[0]);
if (!entry || !styles.length) throw new Error("Entry oder CSS in dist/index.html nicht gefunden");
const fixture = readFileSync(join(repo, "tests/browser/fixture.html"), "utf8");
if (!fixture.includes('import("/src/main.tsx")')) throw new Error("Fixture-Import nicht gefunden");
const derived = fixture
  .replace('import("/src/main.tsx")', `import(${JSON.stringify(entry)})`)
  .replace("</head>", `    ${styles.join("\n    ")}\n  </head>`);
mkdirSync(join(out, "tests/browser"), { recursive: true });
writeFileSync(join(out, "tests/browser/fixture.html"), derived);
copyFileSync(join(repo, "tests/browser/mock-tauri.js"), join(out, "tests/browser/mock-tauri.js"));
copyFileSync(join(repo, "tests/browser/mock-zammad.js"), join(out, "tests/browser/mock-zammad.js"));
cpSync(join(repo, "tests/browser/avatars"), join(out, "tests/browser/avatars"), { recursive: true });
console.log(`Fixture: ${entry} + ${styles.length} CSS`);
