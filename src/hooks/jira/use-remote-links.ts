import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Effect } from "effect";
import { toast } from "sonner";
import { fetchRemoteLinks, remoteLinkKeys } from "@/lib/jira/remote-links";
import { useJiraMyself, useJiraSite } from "@/lib/jira/queries";
import { openExternalLink } from "@/lib/external-links/client";

export function useRemoteLinks(issueKey: string) {
  const site = useJiraSite();
  const myself = useJiraMyself();
  const opener = useMutation({
    mutationFn: (href: string) => Effect.runPromise(openExternalLink(href)),
    onError: () => toast.error("Link konnte nicht geöffnet werden"),
  });
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
    onOpenLink: (href: string) => opener.mutate(href),
  };
}

export type RemoteLinksState = ReturnType<typeof useRemoteLinks>;
