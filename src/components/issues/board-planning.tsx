import { useId, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  EllipsisIcon,
  ListOrderedIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Fade } from "@/components/motion/fade";
import { Tooltip } from "@/components/motion/tooltip";
import { IssuePreviewTooltip } from "@/components/issues/issue-preview";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import type { BoardPlanningState } from "@/hooks/jira/use-board-planning";
import { EASE_OUT, SPRING_LAYOUT } from "@/lib/ease";

function PlanningNotice({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children?: ReactNode;
}) {
  return (
    <Fade>
      <Alert variant="warning" className="rounded-xl">
        <TriangleAlertIcon />
        <AlertTitle className="text-balance">{title}</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-2 wrap-anywhere [&_p:not(:last-child)]:mb-0">
          <p>{detail}</p>
          {children}
        </AlertDescription>
      </Alert>
    </Fade>
  );
}

function PlanningRow({
  row,
  plan,
}: {
  row: BoardPlanningState["rows"][number];
  plan: BoardPlanningState;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      layout={reduce ? false : "position"}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={SPRING_LAYOUT}
      className="flex min-h-12 items-center gap-3 border-b border-border/60 py-2 last:border-0"
    >
      <IssuePreviewTooltip issueKey={row.key}>
        <Link
          ref={plan.rowRef(row.key)}
          to="/issue/$key"
          params={{ key: row.key }}
          className="line-clamp-2 min-w-0 flex-1 rounded-xl wrap-anywhere outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="mr-2 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
            {row.key}
          </span>
          <span className="text-sm">{row.summary}</span>
        </Link>
      </IssuePreviewTooltip>
      <Tooltip content={row.status}>
        <span className="hidden max-w-32 shrink-0 truncate text-xs text-muted-foreground sm:inline">
          {row.status}
        </span>
      </Tooltip>
      <DropdownMenu>
        <Tooltip content={`${row.key} planen`}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`${row.key} planen`}
              disabled={plan.busy}
            >
              <EllipsisIcon />
            </Button>
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent
          align="end"
          onCloseAutoFocus={plan.restoreMenuFocus}
          className="max-h-80 max-w-[calc(100vw-2rem)] min-w-60 [&_[role=menuitem]]:min-h-8 [&_[role=menuitem]]:rounded-xl"
        >
          <DropdownMenuLabel>Reihenfolge in dieser Liste</DropdownMenuLabel>
          <DropdownMenuItem
            disabled={!row.before}
            onSelect={() => {
              if (row.before) plan.rank(row.key, row.before, "before");
            }}
          >
            <ArrowUpIcon />
            Nach oben
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!row.after}
            onSelect={() => {
              if (row.after) plan.rank(row.key, row.after, "after");
            }}
          >
            <ArrowDownIcon />
            Nach unten
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Verschieben nach</DropdownMenuLabel>
          <DropdownMenuItem
            disabled={plan.source === "backlog"}
            onSelect={() => plan.move(row.key, "backlog")}
          >
            Backlog
          </DropdownMenuItem>
          {plan.sprints.map((sprint) => (
            <DropdownMenuItem
              key={sprint.id}
              disabled={plan.source === String(sprint.id)}
              onSelect={() => plan.move(row.key, String(sprint.id))}
            >
              <span className="min-w-0 flex-1 truncate">{sprint.name}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {sprint.state === "active" ? "Aktiv" : "Geplant"}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.li>
  );
}

function PlanningItems({ plan }: { plan: BoardPlanningState }) {
  const reduce = useReducedMotion();
  if (plan.error)
    return (
      <PlanningNotice
        title="Planung konnte nicht geladen werden"
        detail={plan.error}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={plan.retry}
          disabled={plan.refreshing}
        >
          Erneut laden
        </Button>
      </PlanningNotice>
    );
  if (plan.loading)
    return (
      <div
        role="status"
        aria-label="Planung wird geladen"
        aria-busy="true"
        className="space-y-2"
      >
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-12 rounded-xl" />
        <Skeleton className="h-12 rounded-xl" />
      </div>
    );
  if (plan.rows.length === 0)
    return (
      <p className="py-3 text-sm text-muted-foreground">
        Keine Vorgänge in dieser Planungsliste.
      </p>
    );
  return (
    <motion.ul
      layout={reduce ? false : "position"}
      transition={SPRING_LAYOUT}
      aria-label="Geplante Vorgänge"
      aria-busy={plan.busy}
    >
      <AnimatePresence initial={false}>
        {plan.rows.map((row) => (
          <PlanningRow key={row.key} row={row} plan={plan} />
        ))}
      </AnimatePresence>
    </motion.ul>
  );
}

export function BoardPlanning({ plan }: { plan: BoardPlanningState }) {
  const reduce = useReducedMotion();
  const contentId = useId();
  return (
    <section
      aria-label="Sprint-Planung"
      className="min-w-0 rounded-2xl border border-border/70 p-3"
    >
      <Button
        ref={plan.toggleRef}
        variant="ghost"
        size="sm"
        onClick={plan.toggle}
        aria-expanded={plan.open}
        aria-controls={contentId}
      >
        <ListOrderedIcon />
        Sprint-Planung
        <motion.span
          animate={{ rotate: plan.open ? 180 : 0 }}
          transition={{ duration: reduce ? 0 : 0.16, ease: EASE_OUT }}
        >
          <ChevronDownIcon className="size-4" />
        </motion.span>
      </Button>
      <AnimatePresence initial={false}>
        {plan.open && (
          <motion.div
            id={contentId}
            initial={{ opacity: 0, y: reduce ? 0 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className="mt-3 flex min-w-0 flex-col gap-3"
          >
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={plan.source}
                onValueChange={plan.setSource}
                disabled={plan.pending}
              >
                <SelectTrigger
                  aria-label="Planungsliste wählen"
                  className="max-w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="backlog">Backlog</SelectItem>
                  {plan.sprints.map((sprint) => (
                    <SelectItem key={sprint.id} value={String(sprint.id)}>
                      {sprint.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p
                role="status"
                className="min-w-0 flex-1 text-xs text-muted-foreground tabular-nums"
              >
                {plan.loading
                  ? "Wird geladen…"
                  : `${plan.total} geladen${plan.points === undefined ? "" : ` · ${plan.points} Punkte`}${plan.hasMore ? " · weitere verfügbar" : ""}`}
              </p>
              <Tooltip content="Planung aktualisieren">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Planung aktualisieren"
                  disabled={plan.busy}
                  onClick={plan.refresh}
                >
                  <RefreshCwIcon />
                </Button>
              </Tooltip>
            </div>
            <p className="text-xs text-muted-foreground">
              Rangänderungen und Sprint-Zuweisungen werden in Jira gespeichert.
              Nach oben und unten bezieht sich auf diese geladene Liste.
            </p>
            <AnimatePresence initial={false}>
              {plan.sprintError && (
                <PlanningNotice
                  key="sprints"
                  title="Sprints konnten nicht geladen werden"
                  detail={plan.sprintError}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={plan.retrySprints}
                    disabled={plan.sprintsLoading}
                  >
                    Sprints erneut laden
                  </Button>
                </PlanningNotice>
              )}
              {plan.refreshError && (
                <PlanningNotice
                  key="refresh"
                  title="Aktualisierung fehlgeschlagen"
                  detail={`Bisherige Vorgänge bleiben sichtbar. ${plan.refreshError}`}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={plan.retry}
                    disabled={plan.refreshing}
                  >
                    Planung erneut laden
                  </Button>
                </PlanningNotice>
              )}
            </AnimatePresence>
            <PlanningItems plan={plan} />
            <AnimatePresence initial={false}>
              {plan.loadMoreError && (
                <PlanningNotice
                  key="more"
                  title="Weitere Vorgänge konnten nicht geladen werden"
                  detail={`Bisherige Vorgänge bleiben sichtbar. ${plan.loadMoreError}`}
                />
              )}
            </AnimatePresence>
            {plan.hasMore && (
              <Button
                variant="outline"
                size="sm"
                onClick={plan.loadMore}
                disabled={plan.busy}
              >
                {plan.loadingMore
                  ? "Weitere Vorgänge werden geladen…"
                  : plan.loadMoreError
                    ? "Weitere Vorgänge erneut laden"
                    : "Weitere Vorgänge laden"}
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
