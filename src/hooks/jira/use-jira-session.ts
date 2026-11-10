import { useJiraSite } from "@/lib/jira/queries";
import { jiraSessionStatus } from "@/lib/jira/session-status";

export function useJiraSession() {
  const site = useJiraSite();
  return {
    status: jiraSessionStatus({ hasSite: !!site.data, isError: site.isError, isPending: site.isPending }),
    site: site.data ?? null,
    errorMessage: site.error?.message ?? "",
    retrying: site.isFetching,
    retry: () => void site.refetch(),
  };
}

export type JiraSession = ReturnType<typeof useJiraSession>;
