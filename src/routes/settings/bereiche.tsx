import { createFileRoute } from "@tanstack/react-router";
import { LegacyProjectPrefsNotice, ProjectPrefsList } from "@/components/settings/project-prefs-settings";
import { LoginPrompt } from "@/components/shell/login-prompt";
import { Spinner } from "@/components/ui/spinner";
import { useLegacyProjectPrefs, useProjectPrefs } from "@/hooks/use-project-prefs";
import { useJiraMyself, useJiraProjects, useJiraSite } from "@/lib/jira/queries";

export const Route = createFileRoute("/settings/bereiche")({
  component: BereicheSettings,
});

function BereicheSettings() {
  const site = useJiraSite();
  const myself = useJiraMyself();
  const projects = useJiraProjects();
  const prefs = useProjectPrefs();
  const legacy = useLegacyProjectPrefs();

  return (
    <section className="flex w-full flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">Bereiche</h2>
        <p className="text-muted-foreground">Lege fest, welche Bereiche in der Sidebar erscheinen.</p>
      </div>
      {!site.isPending && !site.data ? (
        <LoginPrompt description="Melde dich an, um Bereiche zu verwalten." />
      ) : projects.isPending || prefs.pending ? (
        <Spinner />
      ) : projects.error ? (
        <p role="alert" className="text-sm text-destructive">
          {projects.error.message}
        </p>
      ) : projects.data.length === 0 ? (
        <p className="text-muted-foreground">Keine Bereiche gefunden</p>
      ) : (
        <>
          <LegacyProjectPrefsNotice
            legacy={legacy.legacy}
            accountLabel={`${myself.data?.displayName ?? "dieses Konto"} (${site.data?.siteName ?? "Jira"})`}
            onAdopt={legacy.adopt}
            onDiscard={legacy.discard}
          />
          <ProjectPrefsList
            projects={projects.data}
            favoriteIds={prefs.favoriteIds}
            hiddenIds={prefs.hiddenIds}
            disabled={!prefs.ready}
            onToggleFavorite={prefs.toggleFavorite}
            onToggleHidden={prefs.toggleHidden}
          />
        </>
      )}
    </section>
  );
}
