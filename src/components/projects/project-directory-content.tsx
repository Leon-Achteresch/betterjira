import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { FolderSearchIcon, SearchXIcon, StarIcon, TriangleAlertIcon } from "lucide-react";
import { Fade } from "@/components/motion/fade";
import { ProjectDirectoryRow } from "@/components/projects/project-directory-row";
import { ProjectDirectorySkeleton } from "@/components/projects/project-directory-skeleton";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { RetryButton } from "@/components/ui/retry-button";
import { EASE_OUT } from "@/lib/ease";
import { jiraErrors } from "@/lib/jira/field-values";
import { projectDirectorySearch } from "@/lib/project-directory";
import { PROJECT_DIRECTORY_EMPTY_TEXT } from "@/lib/project-directory-copy";
import type { ProjectDirectoryProps as Props } from "@/types/project-directory";

export function ProjectDirectoryContent({ directory, query, onQueryChange }: Props) {
  if (directory.loadError)
    return (
      <Fade>
        <Empty role="alert">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TriangleAlertIcon />
            </EmptyMedia>
            <EmptyTitle>Bereiche konnten nicht geladen werden</EmptyTitle>
            <EmptyDescription>{jiraErrors(directory.loadError).messages.join(" ")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <RetryButton size="sm" retrying={directory.isFetching} onRetry={directory.retry}>Erneut versuchen</RetryButton>
          </EmptyContent>
        </Empty>
      </Fade>
    );
  if (directory.isPending)
    return (
      <Fade>
        <ProjectDirectorySkeleton />
      </Fade>
    );
  if (directory.empty)
    return (
      <Fade>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              {directory.empty === "no-matches" ? <SearchXIcon /> : directory.empty === "no-favorites" ? <StarIcon /> : <FolderSearchIcon />}
            </EmptyMedia>
            <EmptyTitle>{PROJECT_DIRECTORY_EMPTY_TEXT[directory.empty].title}</EmptyTitle>
            <EmptyDescription>{PROJECT_DIRECTORY_EMPTY_TEXT[directory.empty].description}</EmptyDescription>
          </EmptyHeader>
          {directory.empty === "no-matches" && (
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={() => onQueryChange("")}>
                Suche zurücksetzen
              </Button>
            </EmptyContent>
          )}
          {directory.empty === "no-favorites" && (
            <EmptyContent>
              <Button variant="outline" size="sm" asChild>
                <Link to="/bereiche" search={projectDirectorySearch({ q: query, sort: directory.sort })}>
                  Alle Bereiche zeigen
                </Link>
              </Button>
            </EmptyContent>
          )}
        </Empty>
      </Fade>
    );
  return (
    <Fade>
      <motion.ul
        aria-label="Bereiche"
        animate={{ opacity: directory.isFetching ? 0.7 : 1 }}
        transition={{ duration: 0.15, ease: EASE_OUT }}
        className="flex flex-col gap-0.5"
      >
        <AnimatePresence initial={false} mode="popLayout">
          {directory.entries.map((entry) => (
            <ProjectDirectoryRow key={entry.project.id} entry={entry} disabled={directory.favoriteDisabled} onToggleFavorite={() => directory.toggleFavorite(entry.project.id)} />
          ))}
        </AnimatePresence>
      </motion.ul>
    </Fade>
  );
}
