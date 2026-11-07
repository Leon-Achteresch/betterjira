import { AnimatePresence, useReducedMotion } from "motion/react";
import { FolderSearchIcon, SearchXIcon, TriangleAlertIcon } from "lucide-react";
import { Fade } from "@/components/motion/fade";
import { SearchField } from "@/components/motion/search-field";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { FavoriteButton } from "@/components/projects/favorite-button";
import { ProjectAvatar } from "@/components/shell/project-avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { RetryButton } from "@/components/ui/retry-button";
import { Switch } from "@/components/ui/switch";
import type { ProjectSettingsState } from "@/hooks/jira/use-project-settings";
import { EASE_OUT, SPRING_LAYOUT } from "@/lib/ease";
import { jiraErrors } from "@/lib/jira/field-values";
import { projectMatchLabel } from "@/lib/project-settings-search";

type Props = { settings: ProjectSettingsState };

type Entry = ProjectSettingsState["entries"][number];

export function ProjectSettingsSkeleton() {
  return (
    <div className="flex w-full max-w-xl flex-col gap-2" aria-busy="true" aria-label="Bereiche werden geladen" role="status">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-[50px] w-full rounded-xl" />
      ))}
    </div>
  );
}

function ProjectRow({ entry, onToggleFavorite, onToggleHidden }: { entry: Entry; onToggleFavorite: () => void; onToggleHidden: () => void }) {
  const reduce = useReducedMotion();
  const { project, favorite, hidden } = entry;
  return (
    <StaggerItem
      role="listitem"
      layout={reduce ? false : "position"}
      exit={{ opacity: 0, transition: { duration: 0.1, ease: EASE_OUT } }}
      transition={{ layout: SPRING_LAYOUT }}
    >
      <Item variant="outline" size="sm" className="rounded-xl">
        <ItemMedia>
          <ProjectAvatar project={project} />
        </ItemMedia>
        <ItemContent className="min-w-0">
          <ItemTitle className="w-full truncate">{project.name}</ItemTitle>
          <ItemDescription>{project.key}</ItemDescription>
        </ItemContent>
        <ItemActions>
          <FavoriteButton name={project.name} favorite={favorite} onToggle={onToggleFavorite} />
          <Switch checked={!hidden} onCheckedChange={onToggleHidden} aria-label={`${project.name} in Sidebar anzeigen`} />
        </ItemActions>
      </Item>
    </StaggerItem>
  );
}

function Content({ settings }: Props) {
  if (settings.loadError)
    return (
      <Fade>
        <Empty role="alert">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TriangleAlertIcon />
            </EmptyMedia>
            <EmptyTitle>Bereiche konnten nicht geladen werden</EmptyTitle>
            <EmptyDescription>{jiraErrors(settings.loadError).messages.join(" ")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <RetryButton retrying={settings.isFetching} onRetry={settings.retry}>Erneut versuchen</RetryButton>
          </EmptyContent>
        </Empty>
      </Fade>
    );
  if (settings.isPending)
    return (
      <Fade>
        <ProjectSettingsSkeleton />
      </Fade>
    );
  if (settings.empty === "none")
    return (
      <Fade>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderSearchIcon />
            </EmptyMedia>
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
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>Keine Treffer</EmptyTitle>
            <EmptyDescription>Kein geladener Bereich passt zu Name oder Schlüssel.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={() => settings.setQuery("")}>
              Suche zurücksetzen
            </Button>
          </EmptyContent>
        </Empty>
      </Fade>
    );
  return (
    <Fade>
      <Stagger role="list" aria-label="Bereiche" className="flex flex-col gap-2">
        <AnimatePresence mode="popLayout">
          {settings.entries.map((entry) => (
            <ProjectRow
              key={entry.project.id}
              entry={entry}
              onToggleFavorite={() => settings.toggleFavorite(entry.project.id)}
              onToggleHidden={() => settings.toggleHidden(entry.project.id)}
            />
          ))}
        </AnimatePresence>
      </Stagger>
    </Fade>
  );
}

export function ProjectVisibilitySettings({ settings }: Props) {
  return (
    <div className="flex w-full max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SearchField
          value={settings.query}
          onChange={settings.setQuery}
          label="Bereiche durchsuchen"
          placeholder="Name oder Schlüssel"
          className="w-full sm:w-72 [&_input::-webkit-search-cancel-button]:hidden [&_button]:min-h-8 [&_button]:min-w-8"
        />
        <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
          {settings.loaded && settings.counts.alle > 0 && projectMatchLabel(settings.entries.length, settings.counts.alle)}
        </p>
      </div>
      <AnimatePresence initial={false}>
        {settings.refreshError && (
          <Fade key="refresh">
            <Alert variant="warning" className="rounded-xl">
              <TriangleAlertIcon />
              <AlertTitle>Aktualisierung fehlgeschlagen. Angezeigt wird der zuletzt geladene Stand.</AlertTitle>
              <AlertDescription>{jiraErrors(settings.refreshError).messages.join(" ")}</AlertDescription>
              <div className="col-start-2 mt-2 flex flex-wrap gap-2">
                <RetryButton retrying={settings.isFetching} onRetry={settings.retry}>Erneut versuchen</RetryButton>
              </div>
            </Alert>
          </Fade>
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        <Content key={settings.loadError ? "error" : settings.isPending ? "pending" : (settings.empty ?? "list")} settings={settings} />
      </AnimatePresence>
    </div>
  );
}
