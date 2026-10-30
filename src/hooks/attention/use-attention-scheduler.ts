import { useEffect } from "react";
import { useAttentionRun } from "./use-attention-run";
import { useAttentionServer } from "./use-attention-server";
import { isAttentionConfigured, useAttentionSettings } from "./use-attention-settings";

const CHECK_EVERY_MS = 60_000;

export const useAttentionScheduler = () => {
  useAttentionServer();
  const run = useAttentionRun();
  const configured = useAttentionSettings(isAttentionConfigured);
  const intervalMinutes = useAttentionSettings((state) => state.intervalMinutes);
  const active = configured && intervalMinutes > 0 && run.ready;
  const { run: start, isPending } = run;

  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const { lastTriggeredAt } = useAttentionSettings.getState();
      if (!isPending && Date.now() - (lastTriggeredAt ?? 0) >= intervalMinutes * 60_000) start();
    };
    tick();
    const timer = window.setInterval(tick, CHECK_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [active, intervalMinutes, isPending, start]);
};
