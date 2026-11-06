import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Effect } from "effect";
import { issueSearch } from "@/lib/jira/issue-link";
import { deliver, fetchActivity, pollInterval, recordPoll, selectUnread, useNotifications } from "@/lib/jira/notifications";
import { jiraKeys, useJiraMyself, useJiraSite } from "@/lib/jira/queries";

export const useNotificationPoller = () => {
  const site = useJiraSite();
  const myself = useJiraMyself();
  const me = myself.data?.accountId;
  const siteUrl = site.data?.siteUrl;
  const navigate = useNavigate();
  const openIssue = (key: string, commentId?: string) =>
    void navigate({ to: "/issue/$key", params: { key }, search: issueSearch(commentId) });

  useQuery({
    queryKey: [...jiraKeys.all, "notifications", me],
    queryFn: async ({ signal }) => {
      const startedAt = Date.now();
      const { checkedAt, receive } = useNotifications.getState();
      if (checkedAt === null) {
        receive([], startedAt);
        return startedAt;
      }
      const activity = await Effect.runPromise(fetchActivity(me!, checkedAt), { signal });
      const fresh = receive(activity, startedAt);
      recordPoll(fresh.length);
      deliver(fresh, openIssue);
      return startedAt;
    },
    enabled: !!me && !!siteUrl,
    refetchInterval: pollInterval,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: "always",
    staleTime: 0,
    gcTime: 0,
  });

  const unread = useNotifications(selectUnread);
  useEffect(() => {
    void getCurrentWindow().setBadgeCount(unread || undefined).catch(() => undefined);
  }, [unread]);
};
