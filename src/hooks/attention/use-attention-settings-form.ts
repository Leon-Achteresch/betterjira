import { attentionCallbackUrl } from "@/lib/attention/client";
import { attentionPrompt } from "@/lib/attention/prompt";
import { useAttentionServer } from "./use-attention-server";
import { useAttentionSettings } from "./use-attention-settings";
import { useAttentionStatus } from "./use-attention-status";

export function useAttentionSettingsForm() {
  const settings = useAttentionSettings();
  const server = useAttentionServer();
  const status = useAttentionStatus();

  return {
    enabled: settings.enabled,
    onEnabledChange: settings.setEnabled,
    webhookUrl: settings.webhookUrl,
    onWebhookUrlChange: settings.setWebhookUrl,
    intervalMinutes: settings.intervalMinutes,
    onIntervalChange: settings.setIntervalMinutes,
    prompt: attentionPrompt(settings.token),
    endpoint: {
      url: server.data ? attentionCallbackUrl(server.data) : null,
      error: server.error?.message ?? null,
    },
    canRun: status.canRun,
    analyzing: status.analyzing,
    onRun: status.run,
  };
}
