import { useCallback, useMemo, useState } from "react";
import {
  ATTACHMENT_SORT_DEFAULT,
  ATTACHMENT_SORT_OPTIONS,
  type AttachmentSortMode,
  isAttachmentSortMode,
  type SortableAttachment,
  sortAttachments,
} from "@/lib/attachment-sort";

export function useAttachmentSort<T extends SortableAttachment>(scope: string, attachments: readonly T[]) {
  const [choice, setChoice] = useState<{ scope: string; mode: AttachmentSortMode }>({ scope, mode: ATTACHMENT_SORT_DEFAULT });
  const mode = choice.scope === scope ? choice.mode : ATTACHMENT_SORT_DEFAULT;
  const sorted = useMemo(() => sortAttachments(attachments, mode), [attachments, mode]);
  const select = useCallback(
    (value: string) => {
      if (isAttachmentSortMode(value)) setChoice({ scope, mode: value });
    },
    [scope],
  );
  return { mode, sorted, select, options: ATTACHMENT_SORT_OPTIONS };
}
