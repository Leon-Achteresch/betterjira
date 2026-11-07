import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_WORKSPACE, rememberIssue, workspaceId, type Workspace } from "@/lib/workspace";
import { workspaceEntries } from "@/lib/workspace-page";
import { useRecentRemoval } from "./use-recent-removal";
import { useWorkspaceStore } from "./use-workspace";

const fixtures = vi.hoisted(() => {
  const storage = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); },
  };
  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("window", { localStorage });
  const ownerRef: { current: unknown } = { current: undefined };
  return {
    storage,
    ownerRef,
    toast: vi.fn<(message: string, options: { duration: number; action: { label: string; onClick: () => void } }) => void>(),
  };
});

vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useRef: () => fixtures.ownerRef,
  useCallback: <T>(callback: T) => callback,
}));
vi.mock("sonner", () => ({ toast: fixtures.toast }));
vi.mock("@/lib/jira/queries", () => ({ useJiraMyself: vi.fn(), useJiraSite: vi.fn() }));

const own = workspaceId("cloud", "own");
const other = workspaceId("cloud", "other");
const visible = (workspace: Workspace) => workspaceEntries(workspace, []);

beforeEach(() => {
  fixtures.storage.clear();
  fixtures.toast.mockClear();
  fixtures.ownerRef.current = undefined;
  useWorkspaceStore.setState({ workspaces: {
    [own]: rememberIssue(EMPTY_WORKSPACE, { key: "A-1", summary: "Eigener Verlauf" }),
    [other]: rememberIssue(EMPTY_WORKSPACE, { key: "B-1", summary: "Anderer Verlauf" }),
  } });
});

describe("kontogebundene Entfernen-Handler", () => {
  it("ignoriert den alten Handler nach Konto-Wechsel und nach Verlust der bestätigten Sitzung", () => {
    const focus = vi.fn();
    const old = useRecentRemoval(own, visible, focus);
    const current = useRecentRemoval(other, visible, focus);
    const before = useWorkspaceStore.getState().workspaces;
    old("A-1");
    expect(useWorkspaceStore.getState().workspaces).toBe(before);
    expect(focus).not.toHaveBeenCalled();
    expect(fixtures.toast).not.toHaveBeenCalled();

    useRecentRemoval(undefined, visible, focus);
    current("B-1");
    expect(useWorkspaceStore.getState().workspaces).toBe(before);
    expect(fixtures.toast).not.toHaveBeenCalled();
  });

  it("bindet den angezeigten Rückgängig-Callback an das Ursprungskonto", () => {
    const remove = useRecentRemoval(own, visible, vi.fn());
    remove("A-1");
    expect(useWorkspaceStore.getState().workspaces[own].recent).toEqual([]);
    const options = fixtures.toast.mock.calls.at(-1)?.[1];
    if (!options) throw new Error("Rückgängig-Aktion fehlt");
    expect(options.duration).toBeGreaterThanOrEqual(8_000);
    useRecentRemoval(other, visible, vi.fn());
    const untouched = useWorkspaceStore.getState().workspaces[other];
    options.action.onClick();
    expect(useWorkspaceStore.getState().workspaces[own].recent.map(({ key }) => key)).toEqual(["A-1"]);
    expect(useWorkspaceStore.getState().workspaces[other]).toBe(untouched);
  });
});
