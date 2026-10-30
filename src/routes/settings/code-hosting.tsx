import { createFileRoute } from "@tanstack/react-router";
import { CodeHostingSettings } from "@/components/code-hosting/code-hosting-settings";
import { useCodeHostingSettings } from "@/hooks/scm/use-code-hosting-settings";

export const Route = createFileRoute("/settings/code-hosting")({
  component: CodeHostingSettingsRoute,
});

function CodeHostingSettingsRoute() {
  return <CodeHostingSettings {...useCodeHostingSettings()} />;
}
