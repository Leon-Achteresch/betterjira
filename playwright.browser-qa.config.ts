import { defineConfig } from "@playwright/test";
import { join } from "node:path";
import { tmpdir } from "node:os";
import base from "./playwright.config";

const directory = process.env.BROWSER_QA_DIRECTORY ?? join(tmpdir(), "betterjira-browser-qa");
const url = "http://127.0.0.1:5341";

export default defineConfig({
  ...base,
  workers: 1,
  maxFailures: 8,
  reporter: [["line"], ["json", { outputFile: join(directory, "report.json") }]],
  outputDir: join(directory, "results"),
  use: { ...base.use, baseURL: url, screenshot: "only-on-failure" },
  webServer: {
    command: `node .github/scripts/serve-browser-fixture.mjs "${join(directory, "dist")}"`,
    url: `${url}/tests/browser/fixture.html`,
    reuseExistingServer: false,
  },
});
