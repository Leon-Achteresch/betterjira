import { resolve } from "node:path";
import { tauriFixtureConfig } from "../c1-tauri/vite.config";

export default tauriFixtureConfig(resolve(import.meta.dirname, "fixture.html"));
