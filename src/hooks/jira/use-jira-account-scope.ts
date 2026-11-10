import { useJiraMyself, useJiraSite } from "@/lib/jira/queries";
import { workspaceId } from "@/lib/workspace";

export function useJiraAccountScope() {
  const site = useJiraSite();
  const myself = useJiraMyself();
  const scope =
    site.isSuccess && site.data && myself.isSuccess ? workspaceId(site.data.cloudId, myself.data.accountId) : null;
  return {
    scope,
    pending: site.isPending || (site.isSuccess && myself.isPending),
    accountLabel: scope && site.data && myself.data ? `${myself.data.displayName} (${site.data.siteName})` : "dieses Konto",
  };
}
