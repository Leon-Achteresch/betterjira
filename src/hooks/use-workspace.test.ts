import { Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_WORKSPACE,
  Workspaces,
  rememberIssue,
  setIssueContext,
  workspaceId,
  type Workspace,
} from "@/lib/workspace";
import { useWorkspaceStore } from "./use-workspace";

const storage = vi.hoisted(() => {
  const data = new Map<string, string>();
  const fake = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
  vi.stubGlobal("localStorage", fake);
  vi.stubGlobal("window", { localStorage: fake });
  return data;
});

vi.mock("@/lib/jira/queries", () => ({ useJiraMyself: vi.fn(), useJiraSite: vi.fn() }));

const own = workspaceId("cloud", "own");
const colleague = workspaceId("cloud", "colleague");

const opened = (...keys: string[]): Workspace =>
  keys.reduceRight<Workspace>((workspace, key) => rememberIssue(workspace, { key, summary: key }), EMPTY_WORKSPACE);

const Persisted = Schema.Struct({ state: Schema.Struct({ workspaces: Workspaces }) });

const persistedRecent = (id: string) => {
  const parsed: unknown = JSON.parse(storage.get("betterjira-workspaces") ?? "null");
  return Schema.is(Persisted)(parsed) ? parsed.state.workspaces[id]?.recent.map(({ key }) => key) : undefined;
};

beforeEach(() => {
  storage.clear();
  useWorkspaceStore.setState({
    workspaces: {
      [own]: setIssueContext(opened("A-1", "A-2", "A-3"), "A-2", { note: "Privat" }),
      [colleague]: opened("A-2", "C-1"),
    },
  });
});

describe("Verlaufseintrag im Arbeitsplatz-Speicher entfernen", () => {
  it("entfernt nur im bestätigten Konto und speichert über window.localStorage", () => {
    const before = useWorkspaceStore.getState().workspaces;
    const removed = useWorkspaceStore.getState().removeRecent(own, "A-2");
    const after = useWorkspaceStore.getState().workspaces;
    expect(removed?.issue.key).toBe("A-2");
    expect(after[own].recent.map(({ key }) => key)).toEqual(["A-1", "A-3"]);
    expect(after[own].contexts?.["A-2"]?.note).toBe("Privat");
    expect(after[colleague]).toBe(before[colleague]);
    expect(persistedRecent(own)).toEqual(["A-1", "A-3"]);
    expect(persistedRecent(colleague)).toEqual(["A-2", "C-1"]);
  });

  it("löst bei wiederholtem Klick nichts ein zweites Mal aus", () => {
    useWorkspaceStore.getState().removeRecent(own, "A-2");
    const once = useWorkspaceStore.getState().workspaces;
    expect(useWorkspaceStore.getState().removeRecent(own, "A-2")).toBeUndefined();
    expect(useWorkspaceStore.getState().removeRecent(workspaceId("cloud", "unbekannt"), "A-2")).toBeUndefined();
    expect(useWorkspaceStore.getState().workspaces).toBe(once);
  });

  it("schreibt Rückgängig ins Ursprungskonto, auch wenn inzwischen ein anderes aktiv ist", () => {
    const removed = useWorkspaceStore.getState().removeRecent(own, "A-2");
    if (!removed) throw new Error("A-2 fehlt im Verlauf");
    useWorkspaceStore.getState().update(colleague, (workspace) => rememberIssue(workspace, { key: "C-9", summary: "C-9" }));
    const colleagueBefore = useWorkspaceStore.getState().workspaces[colleague];

    useWorkspaceStore.getState().restoreRecent(own, removed);
    useWorkspaceStore.getState().restoreRecent(own, removed);

    const after = useWorkspaceStore.getState().workspaces;
    expect(after[own].recent.map(({ key }) => key)).toEqual(["A-1", "A-2", "A-3"]);
    expect(after[colleague]).toBe(colleagueBefore);
    expect(persistedRecent(own)).toEqual(["A-1", "A-2", "A-3"]);
  });

  it("legt für ein verschwundenes Konto keinen Arbeitsplatz an", () => {
    const removed = useWorkspaceStore.getState().removeRecent(own, "A-2");
    if (!removed) throw new Error("A-2 fehlt im Verlauf");
    const missing = workspaceId("cloud", "entfernt");
    useWorkspaceStore.getState().restoreRecent(missing, removed);
    expect(useWorkspaceStore.getState().workspaces[missing]).toBeUndefined();
  });
});
