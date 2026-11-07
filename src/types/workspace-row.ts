import type { Ref } from "react";
import type { WorkspaceEntry } from "@/lib/workspace-page";

export type WorkspaceEntryRowProps = {
  entry: WorkspaceEntry;
  linkRef?: Ref<HTMLAnchorElement>;
  onTogglePin: () => void;
  onRemoveRecent: () => void;
};
