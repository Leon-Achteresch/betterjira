import { useState } from "react";
import { toast } from "sonner";
import { copyToClipboard } from "@/lib/clipboard";
import { parseIssueView, serializeIssueView } from "@/lib/issue-view-transfer";
import type { IssueView } from "@/lib/jira/issue-view";

export function useIssueViewTransfer(view: IssueView, onApply: (view: IssueView) => void) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("");
  const [error, setError] = useState<string>();
  return {
    open,
    setOpen,
    source,
    error,
    setSource: (value: string) => { setSource(value); setError(undefined); },
    copy: () => copyToClipboard(serializeIssueView(view), "Ansichtsdefinition kopiert"),
    apply: () => {
      const result = parseIssueView(source);
      if (!result.ok) { setError(result.error); return; }
      onApply(result.view);
      setSource("");
      setError(undefined);
      setOpen(false);
      toast.success("Ansicht importiert");
    },
  };
}

export type IssueViewTransferState = ReturnType<typeof useIssueViewTransfer>;
