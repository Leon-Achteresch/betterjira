import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Effect } from "effect";
import { toast } from "sonner";
import { fetchRemoteLinks, openableUrl, remoteLinkKeys } from "@/lib/jira/remote-links";
import { useJiraMyself, useJiraSite } from "@/lib/jira/queries";

const openLink = (href: string) => {
  const target = openableUrl(href);
  if (target) openUrl(target.href).catch(() => toast.error("Link konnte nicht geöffnet werden"));
};

export function useRemoteLinks(issueKey: string) {
  const site = useJiraSite();
  const myself = useJiraMyself();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [shownKey, setShownKey] = useState(issueKey);
  if (shownKey !== issueKey) {
    setShownKey(issueKey);
    setOpenKey(null);
  }
  const open = openKey === issueKey;
  const cloudId = site.data?.cloudId;
  const accountId = myself.data?.accountId;
  const query = useQuery({
    queryKey: remoteLinkKeys.issue(issueKey, cloudId ?? "", accountId ?? ""),
    queryFn: ({ signal }) => Effect.runPromise(fetchRemoteLinks(issueKey), { signal }),
    enabled: open && !!cloudId && !!accountId,
  });
  const accountError = open && !accountId && myself.isError ? myself.error : null;

  return {
    open,
    onOpenChange: (next: boolean) => setOpenKey(next ? issueKey : null),
    summary: query.data,
    error: query.data ? null : (query.error ?? accountError),
    refreshError: query.data && query.isRefetchError ? query.error : null,
    retrying: query.isFetching || myself.isFetching,
    onRetry: () => void (accountError ? myself.refetch() : query.refetch({ cancelRefetch: false })),
    onOpenLink: openLink,
  };
}

export type RemoteLinksState = ReturnType<typeof useRemoteLinks>;
