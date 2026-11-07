import { CircleAlertIcon, ExternalLinkIcon, GitPullRequestIcon, RotateCwIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { PullRequestRow } from "@/components/development/pull-request-row";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { EASE_OUT, SPRING_LAYOUT } from "@/lib/ease";
import { PULL_REQUEST_LIST_LIMIT } from "@/lib/scm/model";
import type { ListedPullRequest, PullRequestRepoState } from "@/lib/scm/pull-requests";

type PullRequestListProps = {
  pullRequests: ListedPullRequest[];
  repos: PullRequestRepoState[];
  filterLabel: string;
  query: string;
  onOpen: (url: string) => void;
};

const fade = (reduce: boolean | null) => ({
  initial: { opacity: 0, y: reduce ? 0 : 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, transition: { duration: 0.12 } },
  transition: { duration: 0.2, ease: EASE_OUT },
});

export function PullRequestList({ pullRequests, repos, filterLabel, query, onOpen }: PullRequestListProps) {
  const reduce = useReducedMotion();
  const failed = repos.filter((repo) => repo.error !== null);
  const truncated = repos.flatMap(({ id, repo, truncated, browseUrl }) => (truncated && browseUrl ? [{ id, repo, browseUrl }] : []));
  const waiting = repos.some((repo) => repo.status === "loading");

  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence initial={false}>
        {failed.map((repo) => (
          <motion.div key={`error:${repo.id}`} layout={!reduce} {...fade(reduce)}>
            <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm">
              <CircleAlertIcon className="size-4 shrink-0 text-destructive" />
              <span className="min-w-0 flex-1 text-destructive">
                <span className="font-medium">{repo.repo}</span> konnte nicht geladen werden: {repo.error}
              </span>
              <Button variant="outline" className="rounded-xl" onClick={repo.onRetry}>
                <RotateCwIcon />
                Erneut versuchen
              </Button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        {pullRequests.length === 0 && waiting ? (
          <motion.div key="loading" aria-busy="true" aria-label="Pull Requests werden geladen" className="flex flex-col gap-2" {...fade(reduce)}>
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-2 py-2">
                <Skeleton className="size-4 rounded-full" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-2/3 rounded-md" />
                  <Skeleton className="h-3 w-1/2 rounded-md" />
                </div>
                <Skeleton className="size-6 rounded-full" />
              </div>
            ))}
          </motion.div>
        ) : pullRequests.length === 0 ? (
          <motion.div key="empty" {...fade(reduce)}>
            <Empty className="rounded-2xl border border-dashed py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <GitPullRequestIcon />
                </EmptyMedia>
                <EmptyTitle className="text-balance">
                  {query ? `Keine Treffer für „${query}“` : `Keine Pull Requests mit Status „${filterLabel}“`}
                </EmptyTitle>
                <EmptyDescription>
                  {failed.length > 0 ? "Einige Repositories konnten nicht geladen werden." : "Durchsucht werden alle verknüpften Repositories."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </motion.div>
        ) : (
          <motion.div key="list" {...fade(reduce)}>
            <Stagger role="list" aria-busy={waiting || undefined} className="-mx-2 flex flex-col">
              <AnimatePresence initial={false}>
                {pullRequests.map((entry) => (
                  <StaggerItem
                    key={entry.pr.url}
                    role="listitem"
                    layout={!reduce}
                    transition={{ layout: SPRING_LAYOUT }}
                    exit={{ opacity: 0, transition: { duration: 0.12 } }}
                  >
                    <PullRequestRow pr={entry.pr} repo={entry.repo} onOpen={onOpen} />
                  </StaggerItem>
                ))}
              </AnimatePresence>
            </Stagger>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {truncated.length > 0 && (
          <motion.div key="truncated" layout={!reduce} {...fade(reduce)} className="flex flex-col gap-1 rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <p>Je Repository und Status werden die {PULL_REQUEST_LIST_LIMIT} zuletzt aktualisierten Pull Requests geladen; Suche und Sortierung gelten nur für diese. Weitere gibt es in:</p>
            <ul className="flex flex-wrap gap-1">
              {truncated.map((repo) => (
                <li key={repo.id}>
                  <Button variant="ghost" size="sm" className="h-8 rounded-xl" onClick={() => onOpen(repo.browseUrl)}>
                    {repo.repo}
                    <ExternalLinkIcon />
                  </Button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
