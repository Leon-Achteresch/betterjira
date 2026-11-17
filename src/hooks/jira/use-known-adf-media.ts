import { useMemo } from "react";
import { useAdfMedia, type AdfMediaRender } from "@/hooks/jira/use-adf-media";
import { useEditorMedia, type EditorMediaSource } from "@/hooks/jira/use-editor-media";
import { useIssueMedia } from "@/hooks/jira/use-issue-media";
import { matchKnownMedia } from "@/lib/jira/adf-media";

export function useKnownAdfMedia(doc: unknown, source: EditorMediaSource | undefined): AdfMediaRender | undefined {
  const issueMedia = useIssueMedia();
  const saved = useAdfMedia(source?.doc, source?.rendered);
  const editor = useEditorMedia(source);
  const pending = saved?.pending ?? false;
  return useMemo(
    () => (issueMedia ? { pending, matches: matchKnownMedia(doc, editor.known, editor.attachments), open: issueMedia.open } : undefined),
    [doc, issueMedia, pending, editor],
  );
}
