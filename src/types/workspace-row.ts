import type { Ref } from "react";
import type { WorkspaceEntry } from "@/lib/workspace-page";
import type { PlanBucket } from "@/lib/workspace-plan";

export type WorkspaceEntryRowProps = {
  entry: WorkspaceEntry;
  linkRef?: Ref<HTMLAnchorElement>;
  onTogglePin: () => void;
  onRemoveRecent: () => void;
  onEditNote: () => void;
  onPlan: (bucket: PlanBucket | null) => void;
  onMovePlan: (direction: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
};
