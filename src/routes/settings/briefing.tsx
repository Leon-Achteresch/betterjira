import { createFileRoute } from "@tanstack/react-router";
import { AttentionSettingsForm } from "@/components/attention/attention-settings-form";
import { useAttentionServer } from "@/hooks/attention/use-attention-server";
import { useAttentionSettings } from "@/hooks/attention/use-attention-settings";
import { useAttentionStatus } from "@/hooks/attention/use-attention-status";
import { ATTENTION_PORT } from "@/lib/attention/client";
import { attentionPrompt } from "@/lib/attention/prompt";

export const Route = createFileRoute("/settings/briefing")({
  component: BriefingSettings,
});

function BriefingSettings() {
  const settings = useAttentionSettings();
  const server = useAttentionServer();
  const status = useAttentionStatus();

  return (
    <AttentionSettingsForm
      enabled={settings.enabled}
      onEnabledChange={settings.setEnabled}
      webhookUrl={settings.webhookUrl}
      onWebhookUrlChange={settings.setWebhookUrl}
      intervalMinutes={settings.intervalMinutes}
      onIntervalChange={settings.setIntervalMinutes}
      prompt={attentionPrompt(ATTENTION_PORT, settings.token)}
      endpoint={{
        url: server.data ? `http://127.0.0.1:${server.data}/attention` : null,
        error: server.error?.message ?? null,
      }}
      canRun={status.canRun}
      analyzing={status.analyzing}
      onRun={status.run}
    />
  );
}
