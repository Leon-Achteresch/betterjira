import { useWorkspace } from "@/hooks/use-workspace";
import { setIssueContext } from "@/lib/workspace";
import { storedNote } from "@/lib/workspace-note";

export function useIssueNote(issueKey: string) {
  const { workspace, update, ready } = useWorkspace();
  return {
    ready,
    note: storedNote(workspace, issueKey),
    setNote: (note: string) => update((current) => setIssueContext(current, issueKey, { note })),
  };
}
