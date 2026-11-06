import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { openUrl } from "@tauri-apps/plugin-opener";
import { appLinkTarget, issueSearch } from "@/lib/jira/issue-link";
import { useJiraSite } from "@/lib/jira/queries";

export function useAppLinkHandler() {
  const site = useJiraSite();
  const navigate = useNavigate();
  const siteUrl = site.data?.siteUrl;
  return useCallback(
    (href: string) => {
      const target = appLinkTarget(href, siteUrl);
      if (!target) return void openUrl(href);
      void navigate({ to: "/issue/$key", params: { key: target.issueKey }, search: issueSearch(target.commentId) });
    },
    [navigate, siteUrl],
  );
}
