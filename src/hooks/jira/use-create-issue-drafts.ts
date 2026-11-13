import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useJiraMyself, useJiraSite } from "@/lib/jira/queries";
import { workspaceId } from "@/lib/workspace";
import { LOCAL_PREFERENCE_STORAGE } from "@/lib/local-preference-storage";
import {
  CREATE_DRAFT_STORAGE_KEY,
  EMPTY_CREATION_WORKSPACE,
  EMPTY_CREATION_DRAFT,
  readCreationWorkspaces,
  type CreationWorkspace,
} from "@/lib/jira/create-issue-drafts";

type CreationStore = {
  workspaces: Record<string, CreationWorkspace>;
  update: (id: string, transform: (workspace: CreationWorkspace) => CreationWorkspace) => void;
};

export const useCreationStore = create<CreationStore>()(
  persist(
    (set) => ({
      workspaces: {},
      update: (id, transform) => set(({ workspaces }) => ({
        workspaces: { ...workspaces, [id]: transform(workspaces[id] ?? EMPTY_CREATION_WORKSPACE) },
      })),
    }),
    {
      name: CREATE_DRAFT_STORAGE_KEY,
      storage: createJSONStorage(() => LOCAL_PREFERENCE_STORAGE),
      partialize: ({ workspaces }) => ({ workspaces }),
      merge: (persisted, current) => ({ ...current, workspaces: readCreationWorkspaces(persisted) }),
    },
  ),
);

export function useCreateIssueDrafts(parentKey?: string) {
  const site = useJiraSite();
  const myself = useJiraMyself();
  const id = site.isSuccess && site.data && myself.isSuccess && myself.data
    ? workspaceId(site.data.cloudId, myself.data.accountId)
    : undefined;
  const workspace = useCreationStore((state) => id ? state.workspaces[id] ?? EMPTY_CREATION_WORKSPACE : EMPTY_CREATION_WORKSPACE);
  const update = useCreationStore((state) => state.update);
  const scopedWorkspace = (current: CreationWorkspace): CreationWorkspace => parentKey
    ? { ...current, draft: current.parentDrafts?.[parentKey] ?? EMPTY_CREATION_DRAFT }
    : current;
  return {
    id,
    workspace: scopedWorkspace(workspace),
    update: (account: string, transform: (current: CreationWorkspace) => CreationWorkspace) => update(account, (current) => {
      const next = transform(scopedWorkspace(current));
      return parentKey ? { ...next, draft: current.draft, parentDrafts: { ...current.parentDrafts, [parentKey]: next.draft } } : next;
    }),
  };
}
