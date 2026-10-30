import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CircleAlertIcon, GitBranchPlusIcon, RefreshCwIcon } from "lucide-react";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EASE_OUT } from "@/lib/ease";
import type { DevelopmentRepo, DevelopmentStatus } from "@/lib/scm/development";
import { cn } from "@/lib/utils";
import { BranchRow } from "./branch-row";
import { PullRequestRow } from "./pull-request-row";

type IssueDevelopmentProps = {
  status: DevelopmentStatus;
  issueKey: string;
  projectName: string;
  repos: DevelopmentRepo[];
  refreshing: boolean;
  pendingBranch: string | null;
  onRefresh: () => void;
  onCreateBranch: () => void;
  onOpen: (url: string) => void;
  onCopyCheckout: (branch: string) => void;
  onCreatePullRequest: (repoId: string, branch: string) => void;
};

const HINTS: Record<"unconfigured" | "unlinked", (projectName: string) => string> = {
  unconfigured: () => "Verbinde GitHub oder Bitbucket, um Branches und Pull Requests zu sehen.",
  unlinked: (projectName) => `Verknüpfe Repositories mit ${projectName}, um Branches und Pull Requests zu sehen.`,
};

function Row({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      layout={!reduce}
      initial={{ opacity: 0, y: reduce ? 0 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ duration: 0.2, ease: EASE_OUT }}
    >
      {children}
    </motion.li>
  );
}

export function IssueDevelopment(props: IssueDevelopmentProps) {
  const reduce = useReducedMotion();

  if (props.status === "unconfigured" || props.status === "unlinked") {
    return (
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        {HINTS[props.status](props.projectName)}
        <Button variant="outline" size="sm" asChild>
          <Link to="/settings/code-hosting">Einrichten</Link>
        </Button>
      </div>
    );
  }

  const pullRequests = props.repos.flatMap((repo) => repo.pullRequests.map((pr) => ({ pr, repo })));
  const branches = props.repos.flatMap((repo) => repo.branches.map((branch) => ({ branch, repo })));
  const errors = props.repos.filter((repo) => repo.error);
  const empty = props.status === "ready" && pullRequests.length === 0 && branches.length === 0 && errors.length === 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={props.onCreateBranch}>
          <GitBranchPlusIcon />
          Branch erstellen
        </Button>
        <Tooltip content="Aktualisieren">
          <Button variant="ghost" size="icon-sm" aria-label="Aktualisieren" onClick={props.onRefresh} disabled={props.refreshing}>
            <RefreshCwIcon className={cn("transition-transform duration-300", props.refreshing && "rotate-180")} />
          </Button>
        </Tooltip>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {props.status === "loading" ? (
          <motion.div key="loading" exit={{ opacity: 0, transition: { duration: 0.12 } }} className="flex flex-col gap-2 py-1">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
          </motion.div>
        ) : (
          <motion.div
            key="ready"
            initial={{ opacity: 0, y: reduce ? 0 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
          >
            {empty && <p className="py-1 text-sm text-muted-foreground">Noch keine Branches oder Pull Requests zu {props.issueKey}.</p>}
            <ul className="-mx-2 flex flex-col">
              <AnimatePresence initial={false}>
                {pullRequests.map(({ pr, repo }) => (
                  <Row key={pr.url}>
                    <PullRequestRow pr={pr} repo={repo.repo} onOpen={props.onOpen} />
                  </Row>
                ))}
                {branches.map(({ branch, repo }) => (
                  <Row key={`${repo.id}:${branch.name}`}>
                    <BranchRow
                      branch={branch}
                      repo={repo.repo}
                      creating={props.pendingBranch === branch.name}
                      onOpen={props.onOpen}
                      onCopyCheckout={props.onCopyCheckout}
                      onCreatePullRequest={(name) => props.onCreatePullRequest(repo.id, name)}
                    />
                  </Row>
                ))}
                {errors.map((repo) => (
                  <Row key={`${repo.id}:error`}>
                    <p role="alert" className="flex items-center gap-2 px-2 py-1.5 text-sm text-destructive">
                      <CircleAlertIcon className="size-4 shrink-0" />
                      <span className="truncate">
                        {repo.repo}: {repo.error}
                      </span>
                    </p>
                  </Row>
                ))}
              </AnimatePresence>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
