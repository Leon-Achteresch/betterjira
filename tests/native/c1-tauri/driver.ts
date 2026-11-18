import { getIdentifier } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { fetch as nativeFetch } from "@tauri-apps/plugin-http";

declare global {
  interface Window {
    __C1_JIRA_ORIGIN__: string;
    __C1_CANARY_ORIGIN__: string;
  }
}

export const check = (condition: unknown, detail: string) => {
  if (!condition) throw new Error(detail);
};
const reject = async (request: Promise<unknown>, detail: string, expected?: RegExp) => {
  try {
    await request;
  } catch (error) {
    check(!expected || expected.test(String(error)), `${detail}: ${String(error)}`);
    return;
  }
  throw new Error(detail);
};
export const wait = async <T>(read: () => T | Promise<T>, detail: string) => {
  const deadline = performance.now() + 12_000;
  while (performance.now() < deadline) {
    const value = await read();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`Timed out waiting for ${detail} at ${location.pathname}. ${document.body.innerText.slice(-650)}`);
};
export const button = (label: string, root: ParentNode | null = document) => [...(root?.querySelectorAll("button") ?? [])].find(
  (item) => item.getClientRects().length && (item.getAttribute("aria-label") ?? item.textContent.trim()) === label,
);
export const click = async (find: () => HTMLElement | undefined | null, detail: string) => {
  const control = await wait(find, detail);
  check(!control.matches(":disabled,[aria-disabled=true]"), `${detail} is disabled`);
  control.click();
};
export const same = (actual: unknown, expected: unknown, detail: string) => {
  const sorted = (value: unknown) => JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
  check(sorted(actual) === sorted(expected), `${detail}: ${sorted(actual)}`);
};

export const fixtureDriver = (scenario: "c1" | "n01" | "n02" | "n03" | "n04" | "n05" | "n09" | "n22") => {
  const origin = window.__C1_JIRA_ORIGIN__;
  const canary = window.__C1_CANARY_ORIGIN__;
  const control = async (path: string, method = "GET") => {
    const response = await nativeFetch(`${origin}/__${scenario}/${path}`, { method, headers: { Authorization: "Bearer mock" } });
    check(response.ok, `Fixture endpoint ${path} returned ${response.status}`);
    return response;
  };
  const preflight = async () => {
    check(await getIdentifier() === `com.leon.betterjira.${scenario}-ipc-fixture`, "Wrong Tauri application identifier");
    check(!localStorage.length && !sessionStorage.length && !document.cookie, "WebView data is not fresh");
    await reject(window.fetch(`${canary}/webkit`), "WKWebView made a direct network request");
    await reject(window.fetch(`${origin}/__${scenario}/browser-probe`), "WKWebView bypassed the native HTTP plugin");
    await reject(nativeFetch(`${canary}/http-plugin`), "HTTP plugin reached the blocked canary", /not allowed/i);
    await reject(invoke("oauth_login"), "OAuth command is registered", /not found/i);
    await reject(invoke("plugin:updater|check"), "Updater command is available", /not found|not allowed/i);
    const raw = await invoke<string>("session_get");
    check(JSON.parse(raw).accessToken === "mock", "Native session_get returned the wrong session");
    await invoke("session_set", { value: raw });
    check(await invoke("session_get") === raw, "Native session IPC round trip failed");
    check((await control("probe")).ok, "Stock HTTP plugin could not reach the local Jira fixture");
  };
  return { control, preflight };
};

export const signOut = async () => {
  await click(() => button("Suchen"), "command palette");
  const search = await wait(() => document.querySelector<HTMLInputElement>('input[role=combobox][placeholder*="Befehle suchen"]'), "palette search");
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(search, "Abmelden");
  search.dispatchEvent(new Event("input", { bubbles: true }));
  await click(() => [...document.querySelectorAll<HTMLElement>("[role=option]")].find(
    (item) => item.textContent.includes("Abmelden"),
  ), "Jira logout");
  await wait(() => !!button("Mit Atlassian verbinden"), "scope loss after logout");
  check(await invoke("session_get") === null, "Logout did not delete the private session");
};
