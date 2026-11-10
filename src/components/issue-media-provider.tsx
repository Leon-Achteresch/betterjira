import { useMemo, type ReactNode } from "react";
import { Preview } from "@/components/issue-attachments";
import { useAttachmentOpener } from "@/hooks/jira/use-attachment-opener";
import { IssueMediaContext, type IssueMedia, type JiraAttachment } from "@/hooks/jira/use-issue-media";

const NO_ATTACHMENTS: readonly JiraAttachment[] = [];

export function IssueMediaProvider({ attachments, children }: { attachments: readonly JiraAttachment[] | undefined; children: ReactNode }) {
  const { preview, open, close } = useAttachmentOpener();
  const list = attachments ?? NO_ATTACHMENTS;
  const value = useMemo<IssueMedia>(() => ({ attachments: list, open }), [list, open]);
  return (
    <IssueMediaContext.Provider value={value}>
      {children}
      {preview && <Preview attachment={preview} onClose={close} />}
    </IssueMediaContext.Provider>
  );
}
