import { useMemo } from "react";
import { useIssueMedia, type JiraAttachment } from "@/hooks/jira/use-issue-media";
import { createMediaMatchCache } from "@/lib/jira/adf-media";
import type { RenderedDoc } from "@/lib/jira/rendered-issue";

export type AdfMediaRender = {
  pending: boolean;
  matches: ReadonlyMap<object, JiraAttachment>;
  open?: (attachment: JiraAttachment) => void;
};

const resolveMedia = createMediaMatchCache<JiraAttachment>();

export function useAdfMedia(doc: unknown, rendered: RenderedDoc | undefined): AdfMediaRender | undefined {
  const media = useIssueMedia();
  const status = rendered?.status;
  const html = rendered?.status === "ready" ? rendered.html : undefined;
  return useMemo(() => {
    if (!status || !media) return undefined;
    return { ...resolveMedia(doc, status, html, media.attachments), open: media.open };
  }, [doc, status, html, media]);
}
