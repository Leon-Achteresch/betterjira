import { useState } from "react";
import { formatDistanceStrict, isValid } from "date-fns";
import { de } from "date-fns/locale";
import { BRIEFING_PREVIEW_LIMIT, type BriefingStatus } from "@/lib/attention/briefing-state";
import type { AttentionResult } from "@/lib/attention/client";

export function useAttentionBriefingPanel(result: AttentionResult | null, status: BriefingStatus, now: number) {
  const [open, setOpen] = useState(false);
  const generatedAt = result ? new Date(result.generatedAt) : null;
  const updated =
    generatedAt && isValid(generatedAt)
      ? Math.abs(generatedAt.getTime() - now) < 60_000
        ? "gerade eben"
        : formatDistanceStrict(generatedAt, new Date(now), { locale: de, addSuffix: true })
      : null;

  return {
    open,
    setOpen,
    preview: result?.items.slice(0, BRIEFING_PREVIEW_LIMIT) ?? [],
    remaining: Math.max(0, (result?.items.length ?? 0) - BRIEFING_PREVIEW_LIMIT),
    updated,
    running: status.kind === "running" || status.kind === "loading",
    problem: status.kind === "failed" || status.kind === "timed-out",
  };
}
