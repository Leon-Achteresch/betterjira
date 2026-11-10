import { createFileRoute } from "@tanstack/react-router";
import { UpdateSettingsForm } from "@/components/settings/update-settings-form";
import { useUpdateSettings } from "@/hooks/use-update-settings";

export const Route = createFileRoute("/settings/updates")({
  component: Updates,
});

function Updates() {
  const settings = useUpdateSettings();
  return (
    <UpdateSettingsForm
      autoCheck={settings.autoCheck}
      onAutoCheckChange={settings.setAutoCheck}
      autoInstall={settings.autoInstall}
      onAutoInstallChange={settings.setAutoInstall}
      currentVersion={settings.currentVersion}
      available={settings.available}
      checking={settings.checking}
      onCheck={settings.checkNow}
      versions={settings.releases}
      versionsLoading={settings.releasesLoading}
      versionsError={settings.releasesError}
      selected={settings.selected}
      onSelect={settings.setSelected}
      direction={settings.direction}
      percent={settings.percent}
      installing={settings.installing}
      onInstall={settings.installSelected}
    />
  );
}
