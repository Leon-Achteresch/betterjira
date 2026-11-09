import { useCallback } from "react";
import { toast } from "sonner";
import { useWorkspaceStore } from "@/hooks/use-workspace";
import { useLatestRef } from "@/hooks/use-latest-ref";
import { focusKeyAfterRemoval } from "@/lib/focusable";
import type { Workspace } from "@/lib/workspace";
import type { WorkspaceEntry } from "@/lib/workspace-page";

export function useRecentRemoval(
  owner: string | undefined,
  visibleOf: (workspace: Workspace) => readonly WorkspaceEntry[],
  focus: (key: string | undefined) => void,
) {
  const latestOwner = useLatestRef(owner);
  return useCallback(
    (key: string) => {
      if (!owner || latestOwner.current !== owner) return;
      const store = useWorkspaceStore.getState();
      const before = store.workspaces[owner];
      const removed = store.removeRecent(owner, key);
      const after = useWorkspaceStore.getState().workspaces[owner];
      if (!before || !removed || !after) return;
      focus(focusKeyAfterRemoval(visibleOf(before), visibleOf(after), key));
      toast(`${key} aus Zuletzt entfernt`, {
        duration: 8_000,
        action: { label: "Rückgängig", onClick: () => useWorkspaceStore.getState().restoreRecent(owner, removed) },
      });
    },
    [owner, visibleOf, focus, latestOwner],
  );
}
