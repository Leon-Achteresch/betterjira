import { Schema } from "effect";
import { useCallback, useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useJiraMyself, useJiraSite } from "@/lib/jira/queries";
import {
  EMPTY_WORKSPACE,
  WORKSPACE_STORAGE_KEY,
  Workspaces,
  workspaceId,
  type Workspace,
} from "@/lib/workspace";

type WorkspaceState = {
  workspaces: typeof Workspaces.Type;
  update: (id: string, transform: (workspace: Workspace) => Workspace) => void;
};

const PersistedState = Schema.Struct({ workspaces: Workspaces });

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      workspaces: {},
      update: (id, transform) =>
        set(({ workspaces }) => ({
          workspaces: {
            ...workspaces,
            [id]: transform(workspaces[id] ?? EMPTY_WORKSPACE),
          },
        })),
    }),
    {
      name: WORKSPACE_STORAGE_KEY,
      merge: (persisted, current) =>
        Schema.is(PersistedState)(persisted)
          ? { ...current, workspaces: persisted.workspaces }
          : current,
    },
  ),
);

export function useWorkspace() {
  const site = useJiraSite();
  const myself = useJiraMyself();
  const id =
    site.data && myself.data
      ? workspaceId(site.data.cloudId, myself.data.accountId)
      : undefined;
  const workspace = useWorkspaceStore((state) =>
    id ? (state.workspaces[id] ?? EMPTY_WORKSPACE) : EMPTY_WORKSPACE,
  );
  const update = useWorkspaceStore((state) => state.update);

  const updateWorkspace = useCallback(
    (transform: (workspace: Workspace) => Workspace) => {
      if (id) update(id, transform);
    },
    [id, update],
  );
  return { id, workspace, ready: !!id, update: updateWorkspace };
}

export function useWorkspaceStorageSync(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const sync = (event: StorageEvent) => {
      if (event.key === WORKSPACE_STORAGE_KEY) void useWorkspaceStore.persist.rehydrate();
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [active]);
}
