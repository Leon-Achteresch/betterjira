import { createFileRoute } from "@tanstack/react-router";
import { ActivityAlertSettings } from "@/components/settings/activity-alert-settings";
import { useActivityAlertSettings } from "@/hooks/notifications/use-activity-alert-settings";

export const Route = createFileRoute("/settings/benachrichtigungen")({
  component: BenachrichtigungenSettings,
});

function BenachrichtigungenSettings() {
  return <ActivityAlertSettings {...useActivityAlertSettings()} />;
}
