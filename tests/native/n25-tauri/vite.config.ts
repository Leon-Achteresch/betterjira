import { resolve } from "node:path";
import { tauriFixtureConfig } from "../c1-tauri/vite.config";

const app = resolve(import.meta.dirname, "../../../src/main.tsx");
const scmGate = resolve(import.meta.dirname, "../../../src/lib/scm/review-threads-capability.ts");

export default tauriFixtureConfig(resolve(import.meta.dirname, "fixture.html"), [{
  name: "n25-refresh-synthetic-account",
  transform(source, id) {
    if (id === scmGate) return `
export const reviewThreadsAllowed = (connection) =>
  location.protocol === "tauri:" && location.hostname === "localhost" &&
  /^https:\\/\\/127\\.0\\.0\\.1:\\d+$/.test(window.__C1_SCM_ORIGIN__) &&
  connection.baseUrl === window.__C1_SCM_ORIGIN__ && connection.kind === "github" &&
  connection.auth.kind === "token" && connection.auth.id === "private-n23" && connection.auth.username === null &&
  connection.account === "fixture-viewer";`;
    if (id !== app) return;
    return `${source}
Object.defineProperty(window, "__N25_REFRESH_ACCOUNT__", { value: async () => {
  await queryClient.refetchQueries({ queryKey: jiraKeys.myself, exact: true }, { throwOnError: true });
  return queryClient.getQueryData(jiraKeys.myself)?.accountId;
} });`;
  },
}]);
