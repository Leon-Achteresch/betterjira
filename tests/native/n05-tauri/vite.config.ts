import { resolve } from "node:path";
import { tauriFixtureConfig } from "../c1-tauri/vite.config";

const app = resolve(import.meta.dirname, "../../../src/main.tsx");

export default tauriFixtureConfig(resolve(import.meta.dirname, "fixture.html"), [{
  name: "n05-refresh-synthetic-account",
  transform(source: string, id: string) {
    if (id !== app) return;
    return `${source}
Object.defineProperty(window, "__N05_REFRESH_ACCOUNT__", { value: async () => {
  await queryClient.refetchQueries({ queryKey: jiraKeys.myself, exact: true }, { throwOnError: true });
  return queryClient.getQueryData(jiraKeys.myself)?.accountId;
}
});`;
  },
}]);
