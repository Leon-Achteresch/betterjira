import { useEffect, useState } from "react";
import {
  ATTENTION_TIMEOUT_MS,
  briefingStatus,
  isAttentionWebhook,
  scopedBriefingResult,
} from "@/lib/attention/briefing-state";
import { useAttention } from "./use-attention";
import { useAttentionRun } from "./use-attention-run";
import { useAttentionRunHistory } from "./use-attention-run-history";
import { isAttentionConfigured, useAttentionSettings } from "./use-attention-settings";

export const useAttentionStatus = () => {
  const query = useAttention();
  const run = useAttentionRun();
  const configured = useAttentionSettings(isAttentionConfigured);
  const enabled = useAttentionSettings((state) => state.enabled);
  const webhook = useAttentionSettings((state) => state.webhookUrl.trim());
  const pendingRunId = useAttentionSettings((state) => state.pendingRunId);
  const lastTriggeredAt = useAttentionSettings((state) => state.lastTriggeredAt);
  const owners = useAttentionRunHistory((state) => state.owners);
  const failure = useAttentionRunHistory((state) => (run.scope ? state.errors[run.scope] : undefined));
  const [now, setNow] = useState(Date.now);

  const result = scopedBriefingResult(query.data, run.scope, owners);
  const ownedPendingId = pendingRunId && run.scope && owners[pendingRunId] === run.scope ? pendingRunId : null;
  const resultRunId = result?.runId ?? null;

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    const deadline =
      ownedPendingId && ownedPendingId !== resultRunId && lastTriggeredAt !== null
        ? window.setTimeout(() => setNow(Date.now()), Math.max(0, lastTriggeredAt + ATTENTION_TIMEOUT_MS - Date.now()))
        : undefined;
    return () => {
      window.clearInterval(interval);
      if (deadline !== undefined) window.clearTimeout(deadline);
    };
  }, [ownedPendingId, lastTriggeredAt, resultRunId]);

  const failureMessage = failure && failure.runId !== resultRunId ? failure.message : undefined;
  const invalidWebhook =
    webhook && !isAttentionWebhook(webhook) ? "Prüfe die Webhook-URL in den KI-Einstellungen." : null;
  const message =
    failureMessage ??
    invalidWebhook ??
    query.error?.message ??
    (configured ? run.serverError?.message : undefined) ??
    null;
  const error = message ? new Error(message) : null;
  const status = briefingStatus({
    enabled,
    hasWebhook: webhook !== "",
    loading: query.isPending || !run.scope,
    sending: run.isPending,
    pendingRunId: ownedPendingId,
    lastTriggeredAt,
    resultRunId: result?.runId ?? null,
    resultCount: result?.items.length ?? 0,
    error: message,
    unrecognizedResult: !!run.scope && !!query.data && !result,
    now,
  });

  return {
    configured,
    result,
    error,
    loading: query.isPending || !run.scope,
    analyzing: status.kind === "running",
    canRun: run.ready && status.kind !== "running",
    status,
    now,
    run: run.run,
  };
};
