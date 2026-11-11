import { useWorkspace } from "@/hooks/use-workspace";
import { useFieldDraftStore } from "@/hooks/use-field-drafts";
import { scopedFieldDraftKeys, workQueueItems } from "@/lib/workspace";

export function useResumeWork() {
  const { id, workspace, ready } = useWorkspace();
  const fieldDrafts = useFieldDraftStore((state) => state.drafts);
  const draftKeys = scopedFieldDraftKeys(Object.keys(fieldDrafts), id);
  return ready ? workQueueItems(workspace, "recent", "", draftKeys)[0] : undefined;
}
