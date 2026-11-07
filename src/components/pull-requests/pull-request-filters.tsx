import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ArrowDownUpIcon, RefreshCwIcon, SearchIcon, XIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { NAV_TAB_CLASS, NavTabIndicator, NavTabs } from "@/components/motion/nav-tabs";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EASE_OUT } from "@/lib/ease";
import { PULL_REQUEST_SORTS, PULL_REQUEST_SORT_LABELS, type PullRequestSort } from "@/lib/scm/pull-request-sort";
import { PULL_REQUEST_STATUSES, PULL_REQUEST_STATUS_LABELS, type PullRequestStatus } from "@/lib/scm/pull-requests";
import { cn } from "@/lib/utils";

const ALL_REPOS = "all";

type PullRequestFiltersProps = {
  filter: PullRequestStatus;
  query: string;
  sort: PullRequestSort;
  repo: string;
  repoOptions: Array<{ value: string; label: string }>;
  count: number;
  loading: boolean;
  refreshing: boolean;
  updatedAt: Date | null;
  onQueryChange: (query: string) => void;
  onRepoChange: (repo: string) => void;
  onSortChange: (sort: string) => void;
  onRefresh: () => void;
};

export function PullRequestFilters(props: PullRequestFiltersProps) {
  const reduce = useReducedMotion();
  const summary = props.loading
    ? "Lädt …"
    : `${props.count} ${props.count === 1 ? "Pull Request" : "Pull Requests"}${props.updatedAt ? ` · Stand ${format(props.updatedAt, "HH:mm")}` : ""}`;

  return (
    <div className="flex flex-col gap-4">
      <NavTabs id="pull-request-status" label="Pull-Request-Status" className="self-start">
        {PULL_REQUEST_STATUSES.map((status) => (
          <Link
            key={status}
            from="/pull-requests"
            to="/pull-requests"
            search={(previous) => ({ ...previous, status: status === "open" ? undefined : status })}
            replace
            aria-current={status === props.filter ? "page" : undefined}
            className={NAV_TAB_CLASS}
          >
            {PULL_REQUEST_STATUS_LABELS[status]}
            {status === props.filter && <NavTabIndicator />}
          </Link>
        ))}
      </NavTabs>
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="h-8 min-w-48 flex-1 rounded-xl sm:max-w-sm">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Pull Requests durchsuchen"
            placeholder="Titel, Nummer, Branch oder Person …"
            value={props.query}
            onChange={(event) => props.onQueryChange(event.target.value)}
          />
          <AnimatePresence initial={false}>
            {props.query && (
              <InputGroupAddon align="inline-end">
                <motion.span
                  initial={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.1 } }}
                  transition={{ duration: 0.15, ease: EASE_OUT }}
                >
                  <Tooltip content="Suche leeren">
                    <InputGroupButton size="icon-xs" className="relative after:absolute after:-inset-1" aria-label="Suche leeren" onClick={() => props.onQueryChange("")}>
                      <XIcon />
                    </InputGroupButton>
                  </Tooltip>
                </motion.span>
              </InputGroupAddon>
            )}
          </AnimatePresence>
        </InputGroup>
        <Select value={props.repo || ALL_REPOS} onValueChange={(value) => props.onRepoChange(value === ALL_REPOS ? "" : value)}>
          <SelectTrigger aria-label="Repository filtern" className="h-8 max-w-64 min-w-40 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_REPOS}>Alle Repositories</SelectItem>
            {props.repoOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={props.sort} onValueChange={props.onSortChange}>
          <SelectTrigger aria-label="Sortieren" className="h-8 max-w-64 min-w-40 rounded-xl *:data-[slot=select-value]:flex-1">
            <ArrowDownUpIcon className="text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PULL_REQUEST_SORTS.map((sort) => (
              <SelectItem key={sort} value={sort}>
                {PULL_REQUEST_SORT_LABELS[sort]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={summary}
              aria-live="polite"
              initial={{ opacity: 0, y: reduce ? 0 : 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.16, ease: EASE_OUT }}
              className="text-xs text-muted-foreground tabular-nums"
            >
              {summary}
            </motion.span>
          </AnimatePresence>
          <Tooltip content="Aktualisieren">
            <Button variant="ghost" size="icon" className="rounded-xl" aria-label="Aktualisieren" onClick={props.onRefresh} disabled={props.refreshing}>
              <RefreshCwIcon className={cn("transition-transform duration-300", props.refreshing && !reduce && "rotate-180")} />
            </Button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
