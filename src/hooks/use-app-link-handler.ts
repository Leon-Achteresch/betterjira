import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { LinkOpener } from "@/components/adf-content";
import { useIssueTabStore } from "@/hooks/use-issue-tabs";
import { appLinkTarget, issueSearch } from "@/lib/jira/issue-link";
import { useJiraSite } from "@/lib/jira/queries";

export function useAppLinkHandler(): LinkOpener {
  const site = useJiraSite();
  const navigate = useNavigate();
  const siteUrl = site.data?.siteUrl;
  return useCallback(
    (href, options) => {
      const target = appLinkTarget(href, siteUrl);
      if (!target) return void openUrl(href);
      // Ctrl/Cmd-click opens a background tab, like an in-app issue link (useBackgroundTabClick).
      if (options?.background) return void useIssueTabStore.getState().open(target.issueKey);
      void navigate({ to: "/issue/$key", params: { key: target.issueKey }, search: issueSearch(target.commentId) });
    },
    [navigate, siteUrl],
  );
}
