import { createFileRoute } from "@tanstack/react-router";
import { ConnectionsOverview } from "@/components/connections/connections-overview";
import { useConnectionsOverview } from "@/hooks/connections/use-connections-overview";

export const Route = createFileRoute("/settings/verbindungen")({
  component: VerbindungenSettings,
});

function VerbindungenSettings() {
  return <ConnectionsOverview {...useConnectionsOverview()} />;
}
