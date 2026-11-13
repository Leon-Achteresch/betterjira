import { toast } from "sonner";
import { useWorkspace, useWorkspaceStore } from "./use-workspace";
import { useLatestRef } from "./use-latest-ref";
import { movePlannedIssue, planIssue, restorePlannedIssue, type PlanBucket } from "@/lib/workspace-plan";
import type { RememberedIssue } from "@/lib/workspace";

export const usePersonalPlan = () => {
  const { id, workspace, ready, update } = useWorkspace();
  const latestId = useLatestRef(id);
  return {
    ready,
    entries: workspace.plan ?? [],
    assign: (issue: RememberedIssue, bucket: PlanBucket | null) => {
      if (!id || latestId.current !== id) return;
      const previous = useWorkspaceStore.getState().workspaces[id]?.plan ?? [];
      if ((previous.find((entry) => entry.key === issue.key)?.bucket ?? null) === bucket) return;
      update((current) => planIssue(current, issue, bucket));
      toast(bucket ? `${issue.key} für ${bucket === "today" ? "heute" : "später"} geplant` : `${issue.key} aus dem Plan entfernt`, {
        action: { label: "Rückgängig", onClick: () => {
          if (latestId.current === id) update((current) => restorePlannedIssue(current, issue.key, bucket, previous));
        } },
      });
    },
    move: (key: string, direction: -1 | 1) => update((current) => movePlannedIssue(current, key, direction)),
  };
};
