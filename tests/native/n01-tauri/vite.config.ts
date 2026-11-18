import { resolve } from "node:path";
import { tauriFixtureConfig } from "../c1-tauri/vite.config";

const app = resolve(import.meta.dirname, "../../../src/main.tsx");

export default tauriFixtureConfig(resolve(import.meta.dirname, "fixture.html"), [{
  name: "n01-observe-link-mutations",
  transform(source: string, id: string) {
    if (id !== app) return;
    return `${source}
import { jiraKeys as fixtureKeys } from "@/lib/jira/keys";
Object.defineProperty(window, "__N01_LINK_RUNS__", { value: () =>
  queryClient.getMutationCache().findAll({ mutationKey: fixtureKeys.multiLinkWrite(undefined).slice(0, 2) })
    .map(({ state }) => state.status)
});`;
  },
}]);
