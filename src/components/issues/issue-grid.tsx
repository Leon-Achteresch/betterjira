import { useNavigate } from "@tanstack/react-router";
import { openUrl } from "@tauri-apps/plugin-opener";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  CopyIcon,
  ExternalLinkIcon,
  EyeOffIcon,
  LinkIcon,
  SquareArrowOutUpRightIcon,
  XIcon,
} from "lucide-react";
import { IssueCell } from "@/components/issues/issue-cell";
import { IssuePreviewTooltip } from "@/components/issues/issue-preview";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { copyToClipboard } from "@/lib/clipboard";
import { EASE_OUT, SPRING_SWAP } from "@/lib/ease";
import { KEY_COLUMN } from "@/lib/jira/issue-view";
import type { SortDirection } from "@/lib/jira/jql";
import type { SearchIssue } from "@/lib/jira/search";
import { cn } from "@/lib/utils";

export type GridColumn = { id: string; label: string; sortable: boolean; direction?: SortDirection; sortIndex?: number };

const MotionRow = motion.create(TableRow);

const BODY: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.025, delayChildren: 0.04 } } };
const ROW: Variants = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE_OUT } },
  exit: { opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } },
};
const ROW_REDUCED: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

function SortIndicator({ direction, index }: { direction?: SortDirection; index?: number }) {
  return (
    <AnimatePresence initial={false}>
      {direction && (
        <motion.span
          key="sort"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1, rotate: direction === "DESC" ? 180 : 0 }}
          exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.1 } }}
          transition={SPRING_SWAP}
          className="inline-flex text-primary"
        >
          <ArrowUpIcon className="size-3.5" />
        </motion.span>
      )}
      {index && (
        <motion.span
          key="index"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.1 } }}
          className="text-[0.65rem] text-primary tabular-nums"
        >
          {index}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

function ColumnHeader({
  column,
  first,
  last,
  onSort,
  onSortDirection,
  onHide,
  onMove,
}: {
  column: GridColumn;
  first: boolean;
  last: boolean;
  onSort: (additive: boolean) => void;
  onSortDirection: (direction: SortDirection | undefined) => void;
  onHide: () => void;
  onMove: (offset: number) => void;
}) {
  return (
    <span className="group/head flex items-center gap-0.5">
      {column.sortable ? (
        <button
          type="button"
          onClick={(event) => onSort(event.shiftKey)}
          title="Sortieren (Umschalt für mehrere Spalten)"
          className="-mx-1 flex items-center gap-1 rounded-md px-1 py-0.5 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
        >
          {column.label}
          <SortIndicator direction={column.direction} index={column.sortIndex} />
        </button>
      ) : (
        <span>{column.label}</span>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Spalte ${column.label}`}
            className="opacity-0 transition-opacity group-hover/head:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
          >
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-auto min-w-48">
          {column.sortable && (
            <>
              <DropdownMenuItem onSelect={() => onSortDirection("ASC")}>
                <ArrowUpIcon />
                Aufsteigend
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onSortDirection("DESC")}>
                <ArrowDownIcon />
                Absteigend
              </DropdownMenuItem>
              {column.direction && (
                <DropdownMenuItem onSelect={() => onSortDirection(undefined)}>
                  <XIcon />
                  Sortierung entfernen
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem disabled={first} onSelect={() => onMove(-1)}>
            <ArrowLeftIcon />
            Nach links
          </DropdownMenuItem>
          <DropdownMenuItem disabled={last} onSelect={() => onMove(1)}>
            <ArrowRightIcon />
            Nach rechts
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onHide}>
            <EyeOffIcon />
            Ausblenden
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}

export function IssueGrid({
  columns,
  issues,
  dense,
  siteUrl,
  onSort,
  onSortDirection,
  onHide,
  onMove,
}: {
  columns: GridColumn[];
  issues: SearchIssue[];
  dense: boolean;
  siteUrl?: string;
  onSort: (column: string, additive: boolean) => void;
  onSortDirection: (column: string, direction: SortDirection | undefined) => void;
  onHide: (column: string) => void;
  onMove: (column: string, offset: number) => void;
}) {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const row = reduce ? ROW_REDUCED : ROW;

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {columns.map((column, index) => (
            <TableHead
              key={column.id}
              aria-sort={column.direction === "ASC" ? "ascending" : column.direction === "DESC" ? "descending" : undefined}
              className={cn(column.id === KEY_COLUMN && "sticky left-0 z-20 bg-background")}
            >
              <ColumnHeader
                column={column}
                first={index === 0}
                last={index === columns.length - 1}
                onSort={(additive) => onSort(column.id, additive)}
                onSortDirection={(direction) => onSortDirection(column.id, direction)}
                onHide={() => onHide(column.id)}
                onMove={(offset) => onMove(column.id, offset)}
              />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <motion.tbody variants={BODY} initial="hidden" animate="show" data-slot="table-body" className="[&_tr:last-child]:border-0">
        <AnimatePresence initial={false}>
          {issues.map((issue) => {
            const url = siteUrl && `${siteUrl}/browse/${issue.key}`;
            return (
              <ContextMenu key={issue.id}>
                <IssuePreviewTooltip issueKey={issue.key}>
                  <ContextMenuTrigger asChild>
                    <MotionRow variants={row} exit="exit" className="group/row relative">
                      {columns.map((column) => (
                        <TableCell
                          key={column.id}
                          className={cn(
                            dense ? "py-1" : "py-2.5",
                            column.id === KEY_COLUMN && "sticky left-0 z-10 bg-background transition-colors group-hover/row:bg-muted",
                          )}
                        >
                          <IssueCell issue={issue} column={column.id} />
                        </TableCell>
                      ))}
                    </MotionRow>
                  </ContextMenuTrigger>
                </IssuePreviewTooltip>
                <ContextMenuContent className="w-auto min-w-52">
                  <ContextMenuItem onSelect={() => void navigate({ to: "/issue/$key", params: { key: issue.key } })}>
                    <SquareArrowOutUpRightIcon />
                    Öffnen
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={() => void copyToClipboard(issue.key, `${issue.key} kopiert`)}>
                    <CopyIcon />
                    Schlüssel kopieren
                  </ContextMenuItem>
                  {url && (
                    <>
                      <ContextMenuItem onSelect={() => void copyToClipboard(url, "Link kopiert")}>
                        <LinkIcon />
                        Link kopieren
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem onSelect={() => void openUrl(url)}>
                        <ExternalLinkIcon />
                        In Jira öffnen
                      </ContextMenuItem>
                    </>
                  )}
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </AnimatePresence>
      </motion.tbody>
    </Table>
  );
}
