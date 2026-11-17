import { resolve } from "node:path";
import { defineConfig, mergeConfig } from "vite";
import normalConfig from "../../../vite.config";

const jiraClient = resolve(import.meta.dirname, "../../../src/lib/jira/client.ts");
const productionUrl = "https://api.atlassian.com/ex/jira/";

export default defineConfig((env) => mergeConfig(normalConfig(env), {
  plugins: [{
    name: "c1-local-jira-transport",
    enforce: "pre",
    transform(source: string, id: string) {
      if (id !== jiraClient) return;
      if (source.split(productionUrl).length !== 2) throw new Error("C1 fixture could not isolate the Jira URL");
      return source.replace(productionUrl, "${window.__C1_JIRA_ORIGIN__}/ex/jira/");
    },
  }],
  build: { rolldownOptions: { input: resolve(import.meta.dirname, "fixture.html") } },
}));
