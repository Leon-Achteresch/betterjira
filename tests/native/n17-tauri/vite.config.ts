import { resolve } from "node:path";
import { tauriFixtureConfig } from "../c1-tauri/vite.config";

const app = resolve(import.meta.dirname, "../../../src/main.tsx");
export default tauriFixtureConfig(resolve(import.meta.dirname, "fixture.html"), [{
  name: "n17-observe-zammad-connection",
  transform(source: string, id: string) {
    if (id !== app) return;
    return `${source}
import { zammadKeys as fixtureKeys } from "@/lib/zammad/keys";
Object.defineProperty(window, "__N17_REFRESH_CONNECTION__", { value: async () => {
  await queryClient.refetchQueries({ queryKey: fixtureKeys.connection, exact: true }, { throwOnError: true });
  return queryClient.getQueryData(fixtureKeys.connection)?.revision;
} });`;
  },
}]);
