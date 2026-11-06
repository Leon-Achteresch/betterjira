import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FolderXIcon, TriangleAlertIcon } from "lucide-react";
import { IssueTable } from "@/components/issue-table";
import { ProjectPicker } from "@/components/search/project-picker";
import { StashedJql } from "@/components/search/stashed-jql";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import type { SimpleSearchState } from "@/hooks/search/use-simple-search";
import { EASE_OUT } from "@/lib/ease";

function ProjectProblem({ search }: { search: SimpleSearchState }) {
  const missing = search.status === "missing";
  return (
    <Alert variant="warning" className="rounded-xl">
      {missing ? <FolderXIcon /> : <TriangleAlertIcon />}
      <AlertTitle>
        {missing ? `Projekt „${search.projectKey}“ ist nicht verfügbar` : "Projekte konnten nicht geladen werden"}
      </AlertTitle>
      <AlertDescription>
        {missing
          ? "Es existiert nicht oder dir fehlt die Berechtigung. Es wurde keine Suche gestartet."
          : "Das gewählte Projekt lässt sich gerade nicht prüfen. Es wurde keine Suche gestartet."}
      </AlertDescription>
      <AlertAction>
        {missing ? (
          <Button variant="outline" size="sm" onClick={() => search.selectProject(undefined)}>
            Alle Projekte durchsuchen
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={search.retryProjects} disabled={search.retryingProjects}>
            {search.retryingProjects && <Spinner aria-hidden />}
            Erneut versuchen
          </Button>
        )}
      </AlertAction>
    </Alert>
  );
}

export function SimpleSearch({
  search,
  stashedJql,
  onDiscardStashedJql,
  onAdoptJql,
}: {
  search: SimpleSearchState;
  stashedJql?: string;
  onDiscardStashedJql: () => void;
  onAdoptJql: (jql: string) => void;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <ProjectPicker
          projects={search.projects}
          value={search.projectKey}
          pending={search.projectsPending}
          onChange={search.selectProject}
        />
        <AnimatePresence initial={false}>
          {stashedJql && <StashedJql key="stash" jql={stashedJql} onDiscard={onDiscardStashedJql} />}
        </AnimatePresence>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={search.status}
          initial={{ opacity: 0, y: reduce ? 0 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
        >
          {search.status === "ready" ? (
            <IssueTable scope="suche" jql={search.jql} openSearch={false} onAdoptJql={onAdoptJql} text={search.text} />
          ) : search.status === "pending" ? (
            <div className="flex flex-col gap-2" aria-busy>
              {Array.from({ length: 8 }, (_, index) => (
                <Skeleton key={index} className="h-9 w-full" />
              ))}
            </div>
          ) : (
            <ProjectProblem search={search} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
