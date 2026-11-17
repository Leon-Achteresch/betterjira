import { resolve } from "node:path";
import { defineConfig, mergeConfig } from "vite";
import { tauriFixtureConfig } from "../c1-tauri/vite.config";

const app = resolve(import.meta.dirname, "../../../src/main.tsx");
const fixture = tauriFixtureConfig(resolve(import.meta.dirname, "fixture.html"), [{
  name: "n02-observe-field-mutations",
  transform(source: string, id: string) {
    if (id !== app) return;
    return `${source}
import { jiraKeys as fixtureKeys } from "@/lib/jira/keys";
Object.defineProperty(window, "__N02_FIELD_RUNS__", { value: () =>
  queryClient.getMutationCache().findAll({ mutationKey: fixtureKeys.tableFieldApply({ cloudId: "mock-cloud", accountId: "mock-user-000" }) })
    .map(({ state }) => ({ status: state.status, result: state.data }))
});`;
  },
}]);

export default defineConfig((env) => env.mode === "n02-control" ? fixture(env) : mergeConfig(fixture(env), {
  resolve: {
    alias: [{
      find: "@/lib/jira/table-field-apply-capability",
      replacement: resolve(import.meta.dirname, "table-field-apply-capability.ts"),
    }],
  },
}));
