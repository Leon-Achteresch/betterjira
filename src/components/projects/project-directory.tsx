import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { EyeOffIcon, FolderSearchIcon, SearchIcon, SearchXIcon, StarIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { NAV_TAB_CLASS, NavTabIndicator, NavTabs } from "@/components/motion/nav-tabs";
import { Tooltip } from "@/components/motion/tooltip";
import { FavoriteButton } from "@/components/projects/favorite-button";
import { ProjectAvatar } from "@/components/shell/project-avatar";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import type { ProjectDirectoryState } from "@/hooks/jira/use-project-directory";
import { EASE_OUT, SPRING_LAYOUT } from "@/lib/ease";
import { jiraErrors } from "@/lib/jira/field-values";
import { PROJECT_VIEW_IDS, PROJECT_VIEWS, projectDirectorySearch, type ProjectView } from "@/lib/project-directory";

type Props = {
  directory: ProjectDirectoryState;
  query: string;
  view: ProjectView;
  onQueryChange: (query: string) => void;
};

const EMPTY_TEXT = {
  none: { title: "Keine Bereiche", description: "Dein Jira-Konto hat keinen Zugriff auf Bereiche." },
  "no-favorites": {
    title: "Noch keine Favoriten",
    description: "Markiere Bereiche unter „Alle“ mit dem Stern, um sie hier und oben in der Seitenleiste zu sammeln.",
  },
  "no-matches": { title: "Keine Treffer", description: "Kein geladener Bereich passt zu Name oder Schlüssel." },
};

function Fade({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
      transition={{ duration: 0.2, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

function SearchField({ query, onQueryChange }: Pick<Props, "query" | "onQueryChange">) {
  return (
    <InputGroup className="h-9 w-full sm:w-72">
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        placeholder="Name oder Schlüssel"
        aria-label="Bereiche durchsuchen"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => event.key === "Escape" && query && onQueryChange("")}
      />
      {query && (
        <InputGroupAddon align="inline-end">
          <Tooltip content="Suche leeren">
            <InputGroupButton size="icon-sm" aria-label="Suche leeren" onClick={() => onQueryChange("")}>
              <XIcon />
            </InputGroupButton>
          </Tooltip>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}

function ProjectRow({ entry, onToggleFavorite, favoriteDisabled }: { entry: ProjectDirectoryState["entries"][number]; onToggleFavorite: () => void; favoriteDisabled: boolean }) {
  const reduce = useReducedMotion();
  const { project, favorite, hidden } = entry;
  return (
    <motion.li
      layout={reduce ? false : "position"}
      initial={{ opacity: 0, y: reduce ? 0 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.1, ease: EASE_OUT } }}
      transition={{ duration: 0.18, ease: EASE_OUT, layout: SPRING_LAYOUT }}
      className="flex items-center gap-1 rounded-xl pr-1.5 transition-colors hover:bg-muted/60"
    >
      <Link
        to="/bereiche/$key"
        params={{ key: project.key }}
        search={{}}
        className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ProjectAvatar project={project} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{project.name}</span>
          <span className="truncate text-xs text-muted-foreground">{project.key}</span>
        </span>
        {hidden && (
          <Badge variant="outline" className="ml-auto shrink-0 text-muted-foreground">
            <EyeOffIcon />
            Nicht in Seitenleiste
          </Badge>
        )}
      </Link>
      <FavoriteButton name={project.name} favorite={favorite} onToggle={onToggleFavorite} disabled={favoriteDisabled} />
    </motion.li>
  );
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-1" aria-busy aria-label="Bereiche werden geladen" role="status">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex min-h-12 items-center gap-3 px-3">
          <Skeleton className="size-6 rounded-md" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

function RetryButton({ retrying, onRetry, size }: { retrying: boolean; onRetry: () => void; size: "xs" | "sm" }) {
  return (
    <Button variant="outline" size={size} onClick={onRetry} disabled={retrying}>
      {retrying && <Spinner aria-hidden />}
      Erneut versuchen
    </Button>
  );
}

function Content({ directory, query, onQueryChange }: Props) {
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
            <RetryButton size="sm" retrying={directory.isFetching} onRetry={directory.retry} />
          </EmptyContent>
        </Empty>
      </Fade>
    );
  if (directory.isPending)
    return (
      <Fade>
        <ListSkeleton />
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
            <EmptyTitle>{EMPTY_TEXT[directory.empty].title}</EmptyTitle>
            <EmptyDescription>{EMPTY_TEXT[directory.empty].description}</EmptyDescription>
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
                <Link to="/bereiche" search={projectDirectorySearch({ q: query })}>
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
            <ProjectRow key={entry.project.id} entry={entry} onToggleFavorite={() => directory.toggleFavorite(entry.project.id)} favoriteDisabled={!directory.favoritesReady} />
          ))}
        </AnimatePresence>
      </motion.ul>
    </Fade>
  );
}

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
        <SearchField query={query} onQueryChange={onQueryChange} />
      </div>
      <AnimatePresence initial={false}>
        {directory.refreshError && (
          <Fade key="refresh">
            <Alert variant="warning" className="rounded-xl">
              <TriangleAlertIcon />
              <AlertTitle>Aktualisierung fehlgeschlagen. Angezeigt wird der zuletzt geladene Stand.</AlertTitle>
              <AlertDescription>{jiraErrors(directory.refreshError).messages.join(" ")}</AlertDescription>
              <AlertAction>
                <RetryButton size="xs" retrying={directory.isFetching} onRetry={directory.retry} />
              </AlertAction>
            </Alert>
          </Fade>
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait" initial={false}>
        <Content key={directory.loadError ? "error" : directory.isPending ? "pending" : directory.empty ?? `list-${view}`} {...props} />
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
