import { useJiraMyself, useJiraSite } from "@/lib/jira/queries";

export function useJiraQueryScope() {
  const site = useJiraSite();
  const myself = useJiraMyself();
  const scope = site.data && myself.data
    ? { cloudId: site.data.cloudId, accountId: myself.data.accountId }
    : undefined;
  return {
    scope,
    error: !site.data ? site.error : !myself.data ? myself.error : null,
    fetching: !scope && (site.isFetching || myself.isFetching),
    retry: () => void (!site.data ? site.refetch({ cancelRefetch: false }) : myself.refetch({ cancelRefetch: false })),
  };
}
