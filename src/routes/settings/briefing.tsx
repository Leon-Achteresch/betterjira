import { createFileRoute } from "@tanstack/react-router";
import { AttentionSettingsForm } from "@/components/attention/attention-settings-form";
import { useAttentionSettingsForm } from "@/hooks/attention/use-attention-settings-form";

export const Route = createFileRoute("/settings/briefing")({
  component: BriefingSettings,
});

function BriefingSettings() {
  const form = useAttentionSettingsForm();
  return <AttentionSettingsForm {...form} />;
}
