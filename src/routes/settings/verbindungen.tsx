import { createFileRoute } from "@tanstack/react-router";
import { ZammadConnectionSettings } from "@/components/zammad/connection-settings";
import { useZammadSettings } from "@/hooks/zammad/use-zammad-connection";
import { ConnectionsOverview } from "@/components/connections/connections-overview";
import { useConnectionsOverview } from "@/hooks/connections/use-connections-overview";

export const Route = createFileRoute("/settings/verbindungen")({
  component: VerbindungenSettings,
});

function VerbindungenSettings() {
  const connections = useConnectionsOverview();
  const zammad = useZammadSettings();
  return <div className="flex w-full max-w-2xl flex-col gap-4"><ConnectionsOverview {...connections} /><ZammadConnectionSettings {...zammad} /></div>;
}
