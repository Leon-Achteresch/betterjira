import { resolve } from "node:path";
import { tauriFixtureConfig } from "../c1-tauri/vite.config";

const app = resolve(import.meta.dirname, "../../../src/main.tsx");
export default tauriFixtureConfig(
  resolve(import.meta.dirname, "fixture.html"),
  [
    {
      name: "n16-zammad-fixture-controls",
      transform(source: string, id: string) {
        if (id !== app) return;
        return `${source}
import { zammadKeys as fixtureKeys } from "@/lib/zammad/keys";
Object.defineProperty(window, "__N16_TICKET__", { value: (id) =>
  router.navigate({ to: "/helpdesk/$id", params: { id: String(id) } }) });
Object.defineProperty(window, "__N16_REFRESH_ACCOUNT__", { value: async () => {
  await queryClient.refetchQueries({ queryKey: fixtureKeys.connection, exact: true }, { throwOnError: true });
  await queryClient.refetchQueries({ queryKey: fixtureKeys.user, exact: true }, { throwOnError: true });
  return { revision: queryClient.getQueryData(fixtureKeys.connection)?.revision,
    userId: queryClient.getQueryData(fixtureKeys.user)?.id };
} });`;
      },
    },
  ],
);
