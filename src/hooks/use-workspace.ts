import { Schema } from "effect";
import { useCallback } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useLatestRef } from "@/hooks/use-latest-ref";
import { useJiraMyself, useJiraSite } from "@/lib/jira/queries";
import {
  EMPTY_WORKSPACE,
  Workspaces,
  workspaceId,
  type Workspace,
} from "@/lib/workspace";
import { removeRecentIssue, restoreRecentIssue, type RemovedRecentIssue } from "@/lib/workspace-recent";

type WorkspaceState = {
  workspaces: typeof Workspaces.Type;
  update: (id: string, transform: (workspace: Workspace) => Workspace) => void;
  removeRecent: (id: string, key: string) => RemovedRecentIssue | undefined;
  restoreRecent: (id: string, removed: RemovedRecentIssue) => void;
};

const PersistedState = Schema.Struct({ workspaces: Workspaces });

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      workspaces: {},
      update: (id, transform) =>
        set(({ workspaces }) => ({
          workspaces: {
            ...workspaces,
            [id]: transform(workspaces[id] ?? EMPTY_WORKSPACE),
          },
        })),
      removeRecent: (id, key) => {
        const current = get().workspaces[id];
        if (!current) return undefined;
        const { workspace, removed } = removeRecentIssue(current, key);
        if (removed) set(({ workspaces }) => ({ workspaces: { ...workspaces, [id]: workspace } }));
        return removed;
      },
      restoreRecent: (id, removed) => {
        const current = get().workspaces[id];
        if (current) set(({ workspaces }) => ({ workspaces: { ...workspaces, [id]: restoreRecentIssue(current, removed) } }));
      },
    }),
    {
      name: "betterjira-workspaces",
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
    site.isSuccess && site.data && myself.isSuccess && myself.data
      ? workspaceId(site.data.cloudId, myself.data.accountId)
      : undefined;
  const latestId = useLatestRef(id);
  const workspace = useWorkspaceStore((state) =>
    id ? (state.workspaces[id] ?? EMPTY_WORKSPACE) : EMPTY_WORKSPACE,
  );
  const update = useWorkspaceStore((state) => state.update);

  const updateWorkspace = useCallback(
    (transform: (workspace: Workspace) => Workspace) => {
      if (id && latestId.current === id) update(id, transform);
    },
    [id, update, latestId],
  );
  return { id, workspace, ready: !!id, update: updateWorkspace };
}
