import { mergeConfig } from "vite";
import base from "./vite.config";
import ts from "typescript";
import { join } from "node:path";
import { tmpdir } from "node:os";

const directory = process.env.BROWSER_QA_DIRECTORY ?? join(tmpdir(), "betterjira-browser-qa");

export default mergeConfig(base({ command: "build", mode: "production" }), {
  plugins: [{
    name: "qa-render-faults",
    enforce: "pre",
    transform(code, id) {
      const targets = ["components/settings/theme-picker.tsx", "components/calendar/upcoming-rollouts.tsx", "components/shell/app-header.tsx"];
      const target = targets.find((value) => id.replaceAll("\\", "/").endsWith(`/src/${value}`));
      if (!target) return;
      const source = ts.createSourceFile(id, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const declaration = source.statements.find((statement) => ts.isFunctionDeclaration(statement) && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword));
      if (!declaration || !ts.isFunctionDeclaration(declaration) || !declaration.body) throw new Error(`Fehlendes QA-Ziel: ${target}`);
      const offset = declaration.body.getStart(source) + 1;
      return { code: code.slice(0, offset) + `if (window.__qaRenderFault && window.__qaRenderFaultTarget === ${JSON.stringify(target)}) throw new Error("Testfehler token=qa-geheimnis-123");` + code.slice(offset), map: null };
    },
  }],
  cacheDir: join(directory, "cache"),
  build: { outDir: join(directory, "dist"), emptyOutDir: true },
  test: { cache: false, maxWorkers: 1 },
});
