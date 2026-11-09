import { useJiraMyself, useJiraSite } from "@/lib/jira/queries";
import { workspaceId } from "@/lib/workspace";

export function useConfirmedWorkspace() {
  const site = useJiraSite();
  const myself = useJiraMyself();
  if (!site.data || !myself.data) return undefined;
  return {
    id: workspaceId(site.data.cloudId, myself.data.accountId),
    siteName: site.data.siteName,
  };
}
