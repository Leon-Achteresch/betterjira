import { useWorkspace } from "@/hooks/use-workspace";
import { setIssueContext } from "@/lib/workspace";

export function useIssueNote(issueKey: string) {
  const { workspace, update, ready } = useWorkspace();
  return {
    ready,
    note: workspace.contexts?.[issueKey]?.note ?? "",
    setNote: (note: string) => update((current) => setIssueContext(current, issueKey, { note })),
  };
}
