import { resolve } from "node:path";
import { tauriFixtureConfig } from "../c1-tauri/vite.config";

const app = resolve(import.meta.dirname, "../../../src/main.tsx");

export default tauriFixtureConfig(resolve(import.meta.dirname, "fixture.html"), [{
  name: "n04-observe-relative-due-date-mutations",
  transform(source: string, id: string) {
    if (id !== app) return;
    return `${source}
import { jiraKeys as fixtureKeys } from "@/lib/jira/keys";
Object.defineProperty(window, "__N04_SHIFT_RUNS__", { value: () =>
  queryClient.getMutationCache().findAll({ mutationKey: fixtureKeys.dueDateShiftWrite({ cloudId: "mock-cloud", accountId: "mock-user-000" }) })
    .map(({ state }) => ({ status: state.status, result: state.data }))
});`;
  },
}]);
