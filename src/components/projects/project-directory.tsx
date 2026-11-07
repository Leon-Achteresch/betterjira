import { Link } from "@tanstack/react-router";
import { AnimatePresence } from "motion/react";
import { TriangleAlertIcon } from "lucide-react";
import { NAV_TAB_CLASS, NavTabIndicator, NavTabs } from "@/components/motion/nav-tabs";
import { Fade } from "@/components/motion/fade";
import { ProjectDirectoryContent } from "@/components/projects/project-directory-content";
import { ProjectDirectorySearch } from "@/components/projects/project-directory-search";
import { SortMenu } from "@/components/motion/sort-menu";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RetryButton } from "@/components/ui/retry-button";
import { jiraErrors } from "@/lib/jira/field-values";
import { PROJECT_VIEW_IDS, PROJECT_VIEWS, PROJECT_SORT_IDS, PROJECT_SORTS, projectDirectorySearch } from "@/lib/project-directory";
import type { ProjectDirectoryProps as Props } from "@/types/project-directory";

export function ProjectDirectory(props: Props) {
  const { directory, query, view, onQueryChange } = props;
  const shown = directory.entries.length;
  const total = directory.counts.alle;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <NavTabs id="project-views" label="Bereichsansicht" className="self-start">
          {PROJECT_VIEW_IDS.map((id) => (
            <Link
              key={id}
              to="/bereiche"
              search={projectDirectorySearch({ q: query, ansicht: id })}
              aria-current={id === view ? "page" : undefined}
              className={NAV_TAB_CLASS}
            >
              {PROJECT_VIEWS[id].label}
              {directory.loaded && <span className="ml-1.5 text-muted-foreground tabular-nums">{directory.counts[id]}</span>}
              {id === view && <NavTabIndicator />}
            </Link>
          ))}
        </NavTabs>
        <div className="flex flex-wrap gap-2">
          <ProjectDirectorySearch query={query} onQueryChange={onQueryChange} />
          <SortMenu value={props.sort} options={PROJECT_SORT_IDS.map((value) => ({ value, label: PROJECT_SORTS[value] }))} onValueChange={props.onSortChange} />
        </div>
      </div>
      <AnimatePresence initial={false}>
        {directory.refreshError && (
          <Fade key="refresh">
            <Alert variant="warning" className="rounded-xl">
              <TriangleAlertIcon />
              <AlertTitle>Aktualisierung fehlgeschlagen. Angezeigt wird der zuletzt geladene Stand.</AlertTitle>
              <AlertDescription>{jiraErrors(directory.refreshError).messages.join(" ")}</AlertDescription>
              <AlertAction>
                <RetryButton size="xs" retrying={directory.isFetching} onRetry={directory.retry}>Erneut versuchen</RetryButton>
              </AlertAction>
            </Alert>
          </Fade>
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait" initial={false}>
        <ProjectDirectoryContent key={directory.loadError ? "error" : directory.isPending ? "pending" : directory.empty ?? `list-${view}`} {...props} />
      </AnimatePresence>
      {directory.loaded && shown > 0 && (
        <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
          {shown === total
            ? `${total} ${total === 1 ? "geladener Bereich" : "geladene Bereiche"}`
            : `${shown} von ${total} ${total === 1 ? "geladenen Bereich" : "geladenen Bereichen"}`}
        </p>
      )}
    </div>
  );
}
