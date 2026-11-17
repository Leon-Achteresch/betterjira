import { resolve } from "node:path";
import { defineConfig, mergeConfig } from "vite";
import { tauriFixtureConfig } from "../c1-tauri/vite.config";

const app = resolve(import.meta.dirname, "../../../src/main.tsx");
const fixture = tauriFixtureConfig(resolve(import.meta.dirname, "fixture.html"), [{
  name: "n03-observe-subtask-mutations",
  transform(source: string, id: string) {
    if (id !== app) return;
    return `${source}
import { jiraKeys as fixtureKeys } from "@/lib/jira/keys";
Object.defineProperty(window, "__N03_ROW_RUNS__", { value: () =>
  queryClient.getMutationCache().findAll({ mutationKey: fixtureKeys.subtaskRowsWrite({ cloudId: "mock-cloud", accountId: "mock-user-000" }) })
    .map(({ state }) => ({ status: state.status, result: state.data }))
});`;
  },
}]);

export default defineConfig((env) => env.mode !== "n03-submit" ? fixture(env) : mergeConfig(fixture(env), {
  resolve: {
    alias: [{
      find: "@/lib/jira/subtask-rows-capability",
      replacement: resolve(import.meta.dirname, "subtask-rows-capability.ts"),
    }],
  },
}));
