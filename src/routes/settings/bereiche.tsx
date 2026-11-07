import { createFileRoute } from "@tanstack/react-router";
import { ProjectSettingsSkeleton } from "@/components/settings/project-settings-skeleton";
import { ProjectVisibilitySettings } from "@/components/settings/project-visibility-settings";
import { LoginPrompt } from "@/components/shell/login-prompt";
import { SessionGate } from "@/components/shell/session-gate";
import { useJiraSession } from "@/hooks/jira/use-jira-session";
import { useProjectSettings } from "@/hooks/jira/use-project-settings";
import { parseProjectSettingsSearch } from "@/lib/project-settings-search";
import { LegacyProjectPrefsNotice } from "@/components/settings/project-prefs-settings";
import { useLegacyProjectPrefs } from "@/hooks/use-project-prefs";

export const Route = createFileRoute("/settings/bereiche")({
  validateSearch: (search: Record<string, unknown>) => parseProjectSettingsSearch(search),
  component: BereicheSettings,
});

function BereicheSettings() {
  const session = useJiraSession();
  const settings = useProjectSettings(Route.useSearch());
  const legacy = useLegacyProjectPrefs();

  return (
    <section className="flex w-full flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium text-balance">Bereiche</h2>
        <p className="text-muted-foreground">Lege fest, welche Bereiche in der Sidebar erscheinen.</p>
      </div>
      <SessionGate
        session={session}
        pending={<ProjectSettingsSkeleton />}
        unconnected={<LoginPrompt description="Melde dich an, um Bereiche zu verwalten." />}
      >
        <LegacyProjectPrefsNotice legacy={legacy.legacy} accountLabel={legacy.accountLabel} onAdopt={legacy.adopt} onDiscard={legacy.discard} />
        <ProjectVisibilitySettings settings={settings} />
      </SessionGate>
    </section>
  );
}
