import { resolve } from "node:path";
import { defineConfig, mergeConfig, type Plugin } from "vite";
import normalConfig from "../../../vite.config";

const jiraClient = resolve(import.meta.dirname, "../../../src/lib/jira/client.ts");
const productionUrl = "https://api.atlassian.com/ex/jira/";

export const tauriFixtureConfig = (entry: string, plugins: Plugin[] = []) => defineConfig((env) => mergeConfig(normalConfig(env), {
  plugins: [{
    name: "ipc-local-jira-transport",
    enforce: "pre",
    transform(source: string, id: string) {
      if (id !== jiraClient) return;
      if (source.split(productionUrl).length !== 2) throw new Error("IPC fixture could not isolate the Jira URL");
      return source.replace(productionUrl, "${window.__C1_JIRA_ORIGIN__}/ex/jira/");
    },
  }, ...plugins],
  build: { rolldownOptions: { input: entry } },
}));

export default tauriFixtureConfig(resolve(import.meta.dirname, "fixture.html"));
