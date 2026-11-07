import { useMemo, useState } from "react";
import { type AttachmentKind, filterAttachments } from "@/lib/attachment-filter";

export const useAttachmentFilter = <T extends { id: string; filename: string; mimeType: string }>(attachments: readonly T[]) => {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<AttachmentKind>("all");
  const visibleIds = useMemo(
    () => new Set(filterAttachments(attachments, { query, kind }).map((attachment) => attachment.id)),
    [attachments, query, kind],
  );
  return {
    query,
    setQuery,
    kind,
    setKind,
    visibleIds,
    shown: visibleIds.size,
    active: query.trim() !== "" || kind !== "all",
    reset: () => {
      setQuery("");
      setKind("all");
    },
  };
};
