import { useAttention } from "./use-attention";
import { useAttentionRun } from "./use-attention-run";
import { isAttentionConfigured, useAttentionSettings } from "./use-attention-settings";

const PENDING_TIMEOUT_MS = 15 * 60_000;

export const useAttentionStatus = () => {
  const result = useAttention();
  const run = useAttentionRun();
  const configured = useAttentionSettings(isAttentionConfigured);
  const pendingRunId = useAttentionSettings((state) => state.pendingRunId);
  const lastTriggeredAt = useAttentionSettings((state) => state.lastTriggeredAt);
  const waiting =
    pendingRunId !== null &&
    result.data?.runId !== pendingRunId &&
    Date.now() - (lastTriggeredAt ?? 0) < PENDING_TIMEOUT_MS;

  return {
    configured,
    result: result.data ?? null,
    error: result.error,
    loading: result.isPending,
    analyzing: run.isPending || waiting,
    canRun: run.ready,
    run: run.run,
  };
};
