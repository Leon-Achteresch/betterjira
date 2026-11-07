import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { ArrowDownUpIcon, ListChecksIcon, RefreshCwIcon, SearchIcon, XIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { NAV_TAB_CLASS, NavTabIndicator, NavTabs } from "@/components/motion/nav-tabs";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { OptionSelect } from "@/components/ui/option-select";
import { EASE_OUT } from "@/lib/ease";
import { PULL_REQUEST_CHECK_FILTERS, PULL_REQUEST_CHECK_FILTER_LABELS } from "@/lib/scm/pull-request-checks";
import { PULL_REQUEST_SORTS, PULL_REQUEST_SORT_LABELS } from "@/lib/scm/pull-request-sort";
import { PULL_REQUEST_STATUSES, PULL_REQUEST_STATUS_LABELS } from "@/lib/scm/pull-requests";
import { cn } from "@/lib/utils";
import type { SelectOption } from "@/types/select-option";
import type { PullRequestFiltersProps } from "@/types/pull-requests";

const ALL_REPOS = "all";

const SORT_OPTIONS: SelectOption[] = PULL_REQUEST_SORTS.map((sort) => ({ value: sort, label: PULL_REQUEST_SORT_LABELS[sort] }));

const CHECK_OPTIONS: SelectOption[] = PULL_REQUEST_CHECK_FILTERS.map((filter) => ({ value: filter, label: PULL_REQUEST_CHECK_FILTER_LABELS[filter] }));

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
        <OptionSelect
          label="Repository filtern"
          value={props.repo || ALL_REPOS}
          options={[{ value: ALL_REPOS, label: "Alle Repositories" }, ...props.repoOptions]}
          onValueChange={(value) => props.onRepoChange(value === ALL_REPOS ? "" : value)}
        />
        <OptionSelect
          label="Prüfstatus filtern"
          value={props.checks}
          options={CHECK_OPTIONS}
          icon={<ListChecksIcon className="text-muted-foreground" />}
          onValueChange={props.onChecksChange}
        />
        <OptionSelect
          label="Sortieren"
          value={props.sort}
          options={SORT_OPTIONS}
          icon={<ArrowDownUpIcon className="text-muted-foreground" />}
          onValueChange={props.onSortChange}
        />
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
