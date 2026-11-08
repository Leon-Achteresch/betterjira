import { AnimatePresence } from "motion/react";
import { FolderSearchIcon, SearchXIcon, TriangleAlertIcon } from "lucide-react";
import { Fade } from "@/components/motion/fade";
import { Stagger } from "@/components/motion/stagger";
import { ProjectSettingsSkeleton } from "@/components/settings/project-settings-skeleton";
import { ProjectVisibilityRow } from "@/components/settings/project-visibility-row";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { RetryButton } from "@/components/ui/retry-button";
import type { ProjectVisibilitySettingsProps } from "@/types/project-settings";

export function ProjectVisibilityContent({ settings }: ProjectVisibilitySettingsProps) {
  if (settings.loadError)
    return (
      <Fade>
        <Empty role="alert">
          <EmptyHeader>
            <EmptyMedia variant="icon"><TriangleAlertIcon /></EmptyMedia>
            <EmptyTitle>Bereiche konnten nicht geladen werden</EmptyTitle>
            <EmptyDescription>{settings.loadErrorText}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <RetryButton retrying={settings.isFetching} onRetry={settings.retry}>Erneut versuchen</RetryButton>
          </EmptyContent>
        </Empty>
      </Fade>
    );
  if (settings.isPending) return <Fade><ProjectSettingsSkeleton /></Fade>;
  if (settings.empty === "none")
    return (
      <Fade>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><FolderSearchIcon /></EmptyMedia>
            <EmptyTitle>Keine Bereiche</EmptyTitle>
            <EmptyDescription>Dein Jira-Konto hat keinen Zugriff auf Bereiche.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </Fade>
    );
  if (settings.empty)
    return (
      <Fade>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><SearchXIcon /></EmptyMedia>
            <EmptyTitle>Keine Treffer</EmptyTitle>
            <EmptyDescription>Kein geladener Bereich passt zu Name oder Schlüssel.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent><Button variant="outline" onClick={settings.clearQuery}>Suche zurücksetzen</Button></EmptyContent>
        </Empty>
      </Fade>
    );
  return (
    <Fade>
      <Stagger role="list" aria-label="Bereiche" className="flex flex-col gap-2">
        <AnimatePresence mode="popLayout">
          {settings.entries.map((entry) => (
            <ProjectVisibilityRow
              key={entry.project.id}
              entry={entry}
              disabled={settings.disabled}
              onToggleFavorite={() => settings.toggleFavorite(entry.project.id)}
              onToggleHidden={() => settings.toggleHidden(entry.project.id)}
            />
          ))}
        </AnimatePresence>
      </Stagger>
    </Fade>
  );
}
