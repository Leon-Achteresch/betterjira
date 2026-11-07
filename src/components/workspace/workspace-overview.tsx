import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { InboxIcon, SearchIcon } from "lucide-react";
import { NAV_TAB_CLASS, NavTabIndicator, NavTabs } from "@/components/motion/nav-tabs";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { WorkspaceEntryRow } from "@/components/workspace/workspace-entry-row";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { EASE_OUT, SPRING_LAYOUT } from "@/lib/ease";
import {
  WORKSPACE_PAGE_FILTERS,
  type WorkspaceEntry,
  type WorkspacePageFilter,
  type WorkspacePageSearch,
} from "@/lib/workspace-page";

type WorkspaceOverviewProps = {
  ready: boolean;
  filter: WorkspacePageFilter;
  query: string;
  total: number;
  counts: Record<WorkspacePageFilter, number>;
  entries: readonly WorkspaceEntry[];
  emptyState: { title: string; description: string };
  recentLimit: number;
  searchFor: (filter: WorkspacePageFilter) => WorkspacePageSearch;
  onQueryChange: (value: string) => void;
  onTogglePin: (entry: WorkspaceEntry) => void;
  onEditNote: (entry: WorkspaceEntry) => void;
};

export function WorkspaceOverview(props: WorkspaceOverviewProps) {
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <NavTabs id="workspace-filters" label="Arbeitskontexte filtern" className="md:border-b-0">
          {WORKSPACE_PAGE_FILTERS.map(({ id, label }) => (
            <Link
              key={id}
              to="/arbeitsplatz"
              search={props.searchFor(id)}
              aria-current={id === props.filter ? "page" : undefined}
              className={NAV_TAB_CLASS}
            >
              {label}{" "}
              <span className="ml-0.5 text-xs tabular-nums text-muted-foreground">{props.counts[id]}</span>
              {id === props.filter && <NavTabIndicator />}
            </Link>
          ))}
        </NavTabs>
        <InputGroup className="md:max-w-72">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            data-workspace-search
            aria-label="Arbeitsplatz durchsuchen"
            placeholder="Ticket, Notiz oder Entwurf …"
            value={props.query}
            onChange={(event) => props.onQueryChange(event.target.value)}
          />
        </InputGroup>
      </div>
      <p aria-live="polite" className="sr-only">
        {props.ready ? `${props.entries.length} Arbeitskontexte` : ""}
      </p>
      {!props.ready ? (
        <div aria-busy className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-18 w-full rounded-xl" />
          ))}
        </div>
      ) : props.entries.length === 0 ? (
        <motion.div
          key={`${props.filter}:${props.query ? "search" : "empty"}`}
          initial={{ opacity: 0, y: reduce ? 0 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
        >
          <Empty className="rounded-2xl border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <InboxIcon />
              </EmptyMedia>
              <EmptyTitle>{props.emptyState.title}</EmptyTitle>
              <EmptyDescription>{props.emptyState.description}</EmptyDescription>
            </EmptyHeader>
            {props.query && (
              <EmptyContent>
                <Button variant="outline" size="sm" onClick={() => props.onQueryChange("")}>
                  Suche zurücksetzen
                </Button>
              </EmptyContent>
            )}
          </Empty>
        </motion.div>
      ) : (
        <Stagger role="list" aria-label="Arbeitskontexte" className="flex flex-col gap-1">
          <AnimatePresence initial={false}>
            {props.entries.map((entry) => (
              <StaggerItem
                key={entry.key}
                role="listitem"
                layout={reduce ? false : "position"}
                transition={SPRING_LAYOUT}
                exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
              >
                <WorkspaceEntryRow
                  entry={entry}
                  onTogglePin={() => props.onTogglePin(entry)}
                  onEditNote={() => props.onEditNote(entry)}
                />
              </StaggerItem>
            ))}
          </AnimatePresence>
        </Stagger>
      )}
      <p className="text-xs text-muted-foreground text-pretty">
        <span className="tabular-nums">{props.total}</span> Arbeitskontexte nur auf diesem Gerät und für dieses Konto.
        Der Verlauf behält die letzten <span className="tabular-nums">{props.recentLimit}</span> Tickets. Notizen und
        Entwürfe werden nicht veröffentlicht.
      </p>
    </div>
  );
}
