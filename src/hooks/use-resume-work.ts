import { useWorkspace } from "@/hooks/use-workspace";
import { workQueueItems } from "@/lib/workspace";

export function useResumeWork() {
  const { workspace, ready } = useWorkspace();
  return ready ? workQueueItems(workspace)[0] : undefined;
}
