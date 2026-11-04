import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { attentionKeys, type AttentionResult } from "@/lib/attention/client";
import { isAttentionPending } from "@/lib/attention/briefing-state";
import { useAttention } from "./use-attention";
import { useAttentionEvents } from "./use-attention-events";
import { useAttentionRun } from "./use-attention-run";
import { useAttentionRunHistory } from "./use-attention-run-history";
import { isAttentionConfigured, useAttentionSettings } from "./use-attention-settings";

const CHECK_EVERY_MS = 60_000;

export const useAttentionScheduler = () => {
  useAttentionEvents();
  useAttention();
  const run = useAttentionRun();
  const queryClient = useQueryClient();
  const configured = useAttentionSettings(isAttentionConfigured);
  const intervalMinutes = useAttentionSettings((state) => state.intervalMinutes);
  const active = configured && intervalMinutes > 0 && run.ready;
  const { run: start, scope } = run;

  useEffect(() => {
    if (!active || !scope) return;
    const tick = () => {
      const { lastTriggeredAt, pendingRunId } = useAttentionSettings.getState();
      const owners = useAttentionRunHistory.getState().owners;
      const result = queryClient.getQueryData<AttentionResult | null>(attentionKeys.result);
      const pending = pendingRunId && owners[pendingRunId] === scope ? pendingRunId : null;
      if (isAttentionPending(pending, lastTriggeredAt, result?.runId ?? null, Date.now())) return;
      const ownedTriggeredAt = pendingRunId && owners[pendingRunId] === scope ? lastTriggeredAt : null;
      if (Date.now() - (ownedTriggeredAt ?? 0) >= intervalMinutes * 60_000) start();
    };
    tick();
    const timer = window.setInterval(tick, CHECK_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [active, intervalMinutes, start, scope, queryClient]);
};
