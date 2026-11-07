import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CircleAlertIcon, FunnelIcon, RotateCwIcon, SearchIcon, TerminalSquareIcon, TriangleAlertIcon } from "lucide-react";
import { FilterOverviewRow } from "@/components/filters/filter-overview-row";
import { NAV_TAB_CLASS, NavTabIndicator, NavTabs } from "@/components/motion/nav-tabs";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { EASE_OUT, SPRING_LAYOUT } from "@/lib/ease";
import {
  FILTER_OVERVIEW_VIEWS,
  type FilterOverviewSearch,
  type FilterOverviewStatus,
  type FilterOverviewView,
} from "@/lib/filter-overview";

type OverviewFilter = { id: string; name: string; favourite?: boolean };

type FilterOverviewProps<T extends OverviewFilter> = {
  status: FilterOverviewStatus;
  view: FilterOverviewView;
  query: string;
  counts: Record<FilterOverviewView, number>;
  filters: readonly T[];
  pendingIds: readonly string[];
  errorText: string;
  retrying: boolean;
  emptyState: { title: string; description: string };
  searchFor: (view: FilterOverviewView) => FilterOverviewSearch;
  onQueryChange: (value: string) => void;
  onRetry: () => void;
  onToggleFavourite: (filter: T) => void;
};

function RetryButton({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onRetry} disabled={retrying}>
      {retrying ? <Spinner aria-hidden /> : <RotateCwIcon />}
      Erneut versuchen
    </Button>
  );
}

const fade = (reduce: boolean | null) => ({
  initial: { opacity: 0, y: reduce ? 0 : 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } },
  transition: { duration: 0.2, ease: EASE_OUT },
});

export function FilterOverview<T extends OverviewFilter>(props: FilterOverviewProps<T>) {
  const reduce = useReducedMotion();
  const ready = props.status === "ready";
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <NavTabs id="filter-overview-views" label="Filter-Ansicht" className="md:border-b-0">
          {FILTER_OVERVIEW_VIEWS.map(({ id, label }) => (
            <Link
              key={id}
              to="/filter"
              search={props.searchFor(id)}
              aria-current={id === props.view ? "page" : undefined}
              className={NAV_TAB_CLASS}
            >
              {label}{" "}
              {ready && <span className="ml-0.5 text-xs tabular-nums text-muted-foreground">{props.counts[id]}</span>}
              {id === props.view && <NavTabIndicator />}
            </Link>
          ))}
        </NavTabs>
        <InputGroup className="md:max-w-72">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            aria-label="Filter durchsuchen"
            placeholder="Filtername …"
            value={props.query}
            onChange={(event) => props.onQueryChange(event.target.value)}
          />
        </InputGroup>
      </div>
      <p aria-live="polite" className="sr-only">
        {ready ? `${props.filters.length} Filter` : ""}
      </p>
      <AnimatePresence initial={false}>
        {ready && props.errorText && (
          <motion.div key="refresh-error" {...fade(reduce)}>
            <Alert variant="warning" role="alert" className="rounded-xl">
              <TriangleAlertIcon />
              <AlertTitle>Aktualisierung fehlgeschlagen. Angezeigt wird der zuletzt geladene Stand.</AlertTitle>
              <AlertDescription>{props.errorText}</AlertDescription>
              <AlertAction>
                <RetryButton retrying={props.retrying} onRetry={props.onRetry} />
              </AlertAction>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>
      {props.status === "pending" ? (
        <div aria-busy aria-label="Filter werden geladen" className="flex flex-col gap-1">
          {[0, 1, 2, 3, 4].map((index) => (
            <Skeleton key={index} className="h-12 w-full rounded-xl" />
          ))}
        </div>
      ) : props.status === "error" ? (
        <motion.div {...fade(reduce)}>
          <Empty role="alert" className="rounded-2xl border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CircleAlertIcon />
              </EmptyMedia>
              <EmptyTitle>Filter konnten nicht geladen werden</EmptyTitle>
              <EmptyDescription>{props.errorText}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <RetryButton retrying={props.retrying} onRetry={props.onRetry} />
            </EmptyContent>
          </Empty>
        </motion.div>
      ) : props.filters.length === 0 ? (
        <motion.div key={`${props.view}:${props.query ? "search" : "empty"}`} {...fade(reduce)}>
          <Empty className="rounded-2xl border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FunnelIcon />
              </EmptyMedia>
              <EmptyTitle>{props.emptyState.title}</EmptyTitle>
              <EmptyDescription>{props.emptyState.description}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              {props.query ? (
                <Button variant="outline" size="sm" onClick={() => props.onQueryChange("")}>
                  Suche zurücksetzen
                </Button>
              ) : (
                props.view === "alle" && (
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/suche" search={{}}>
                      <TerminalSquareIcon />
                      Zur JQL-Suche
                    </Link>
                  </Button>
                )
              )}
            </EmptyContent>
          </Empty>
        </motion.div>
      ) : (
        <Stagger role="list" aria-label="Filter" className="flex flex-col gap-1">
          <AnimatePresence initial={false}>
            {props.filters.map((filter) => (
              <StaggerItem
                key={filter.id}
                role="listitem"
                layout={reduce ? false : "position"}
                transition={SPRING_LAYOUT}
                exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
              >
                <FilterOverviewRow
                  id={filter.id}
                  name={filter.name}
                  favourite={!!filter.favourite}
                  pending={props.pendingIds.includes(filter.id)}
                  onToggleFavourite={() => props.onToggleFavourite(filter)}
                />
              </StaggerItem>
            ))}
          </AnimatePresence>
        </Stagger>
      )}
      <p className="text-xs text-muted-foreground text-pretty">
        Zeigt deine eigenen Filter und die Filter, die du in Jira als Favorit markiert hast. Andere geteilte Filter
        werden hier nicht durchsucht. Entfernst du einen fremden Filter aus den Favoriten, verschwindet er aus dieser
        Liste.
      </p>
    </div>
  );
}
