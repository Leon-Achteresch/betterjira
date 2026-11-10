import { useCallback, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { JiraAttachment } from "@/hooks/jira/use-issue-media";
import { isImageAttachment } from "@/lib/jira/adf-media";
import { useJiraSite } from "@/lib/jira/queries";

export function useAttachmentOpener() {
  const site = useJiraSite();
  const siteUrl = site.data?.siteUrl;
  const [preview, setPreview] = useState<JiraAttachment>();
  const open = useCallback(
    (attachment: JiraAttachment) => {
      if (isImageAttachment(attachment)) return setPreview(attachment);
      if (siteUrl) void openUrl(`${siteUrl}/rest/api/3/attachment/content/${attachment.id}`);
    },
    [siteUrl],
  );
  const close = useCallback(() => setPreview(undefined), []);
  return { preview, open, close };
}
