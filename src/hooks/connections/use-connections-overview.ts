import { useQueryClient } from "@tanstack/react-query";
import { useOutlookAccount } from "@/hooks/calendar/use-outlook";
import { useJiraSession } from "@/hooks/jira/use-jira-session";
import { useScmConnections } from "@/hooks/scm/use-scm-connections";
import { JIRA_SESSION_LABELS, OUTLOOK_LABELS, checkLabel, checkState, checkedAt, lastReachable, outlookStatus, scmLabel } from "@/lib/connections/status";
import { jiraKeys, useJiraLogin, useJiraMyself } from "@/lib/jira/queries";
import { SCM_KIND_LABELS } from "@/lib/scm/model";
import { useDeviceOnline } from "./use-device-online";

const hostOf = (baseUrl: string) => baseUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

export const useConnectionsOverview = () => {
  const online = useDeviceOnline();
  const queryClient = useQueryClient();
  const session = useJiraSession();
  const login = useJiraLogin();
  const myself = useJiraMyself();
  const { connections, gh } = useScmConnections();
  const outlook = useOutlookAccount();

  const jiraCheck = checkState(myself);
  const outlookCheck = checkState(outlook);
  const outlookState = outlookStatus({
    isPending: outlook.isPending,
    paused: outlook.fetchStatus === "paused",
    hasAccount: !!outlook.data,
    failed: outlookCheck === "failed",
  });

  return {
    online,
    jira: {
      status: JIRA_SESSION_LABELS[session.status],
      sessionStatus: session.status,
      siteName: session.site?.siteName ?? null,
      siteUrl: session.site?.siteUrl ?? null,
      sessionError: session.errorMessage || null,
      retrying: session.retrying,
      onRetry: session.retry,
      loggingIn: login.isPending,
      loginError: login.error?.message ?? null,
      onLogin: () => login.mutate(),
      check: {
        status: checkLabel(jiraCheck),
        detail: lastReachable(myself.dataUpdatedAt),
        error: jiraCheck === "failed" ? (myself.error?.message ?? null) : null,
        checking: jiraCheck === "checking",
        canCheck: online && jiraCheck !== "checking",
        onCheck: () => void myself.refetch(),
        onCancel: () => void queryClient.cancelQueries({ queryKey: jiraKeys.myself, exact: true }),
      },
    },
    scm: {
      status: scmLabel(connections.length, gh.isPending),
      loading: gh.isPending && gh.fetchStatus !== "paused",
      waiting: gh.fetchStatus === "paused",
      cliError: gh.error?.message ?? null,
      connections: connections.map((connection) => ({
        id: connection.id,
        label: connection.label,
        kind: SCM_KIND_LABELS[connection.kind],
        host: hostOf(connection.baseUrl),
        account: connection.account,
        viaCli: connection.auth.kind === "gh",
      })),
      cliReadAt: gh.dataUpdatedAt > 0 ? checkedAt(gh.dataUpdatedAt) : null,
    },
    outlook: {
      status: OUTLOOK_LABELS[outlookState],
      configured: outlook.data !== null,
      canCheck: online && outlook.data !== null && !outlook.isPending,
      account: outlook.data ? outlook.data.email || outlook.data.displayName : null,
      checkedAt: outlook.dataUpdatedAt > 0 && outlook.data ? checkedAt(outlook.dataUpdatedAt) : null,
      error: outlookCheck === "failed" ? (outlook.error?.message ?? null) : null,
      checking: outlook.isFetching,
      onCheck: () => void outlook.refetch(),
    },
  };
};

export type ConnectionsOverviewModel = ReturnType<typeof useConnectionsOverview>;
