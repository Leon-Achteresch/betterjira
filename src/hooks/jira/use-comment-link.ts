import { useRef } from "react";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/clipboard";
import { jiraCommentUrl } from "@/lib/jira/comment-link";
import { useJiraSite } from "@/lib/jira/queries";

export function useCommentLink(issueKey: string) {
  const site = useJiraSite();
  const copying = useRef(false);
  const siteUrl = site.data?.siteUrl;

  return {
    available: (commentId: string) => jiraCommentUrl(siteUrl, issueKey, commentId) !== null,
    copy: async (commentId: string) => {
      const url = jiraCommentUrl(siteUrl, issueKey, commentId);
      if (!url) {
        toast.error("Kein Jira-Link verfügbar: keine gültige Jira-Verbindung");
        return;
      }
      if (copying.current) return;
      copying.current = true;
      try {
        await copyToClipboard(url, "Link zum Kommentar kopiert");
      } finally {
        copying.current = false;
      }
    },
  };
}
