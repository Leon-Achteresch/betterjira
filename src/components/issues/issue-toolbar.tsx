import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  BookmarkIcon,
  BookmarkPlusIcon,
  ClipboardCopyIcon,
  CodeIcon,
  EllipsisIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  Rows3Icon,
  SearchIcon,
  TableIcon,
  TerminalSquareIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { ColumnPicker } from "@/components/issues/column-picker";
import { FacetMenu, FacetOptionIcon } from "@/components/issues/facet-menu";
import { NameDialog } from "@/components/issues/name-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import type { IssueTableState } from "@/hooks/use-issue-table";
import { EASE_OUT, SPRING_LAYOUT, SPRING_PRESS } from "@/lib/ease";
import { QUICK_FILTERS, type QuickFilter } from "@/lib/jira/issue-view";
import { cn } from "@/lib/utils";

const QUICK_KEYS = Object.keys(QUICK_FILTERS) as QuickFilter[];

function QuickFilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <motion.button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      transition={SPRING_PRESS}
      className={cn(
        "h-7 rounded-full border px-3 text-xs font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        active ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </motion.button>
  );
}

function ResultCount({ loaded, total }: { loaded: number; total?: number }) {
  const label = total === undefined || total === loaded ? `${loaded}` : `${loaded} von ${total}`;
  return (
    <span className="flex items-center text-xs text-muted-foreground tabular-nums" aria-live="polite">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={label}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
          transition={{ duration: 0.18, ease: EASE_OUT }}
        >
          {label} Vorgänge
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function ViewMenu({
  table,
  onAdoptJql,
  onOpenSearch,
}: {
  table: IssueTableState;
  onAdoptJql?: (jql: string) => void;
  onOpenSearch?: (jql: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" aria-label="Ansicht und Export">
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-60">
          <DropdownMenuCheckboxItem checked={table.dense} onCheckedChange={(checked) => table.setDense(checked === true)}>
            <Rows3Icon />
            Kompakte Zeilen
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ClipboardCopyIcon />
              Kopieren als
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-52">
              <DropdownMenuItem onSelect={() => void table.exportAs("tsv")}>
                <TableIcon />
                Tabelle (Excel, Numbers)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void table.exportAs("markdown")}>
                <CodeIcon />
                Markdown
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void table.exportAs("keys")}>Schlüsselliste</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void table.exportAs("jql")}>JQL</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {(onAdoptJql || onOpenSearch) && <DropdownMenuSeparator />}
          {onAdoptJql && (
            <DropdownMenuItem onSelect={() => onAdoptJql(table.jql)}>
              <CodeIcon />
              Ansicht in JQL übernehmen
            </DropdownMenuItem>
          )}
          {onOpenSearch && (
            <DropdownMenuItem onSelect={() => onOpenSearch(table.jql)}>
              <TerminalSquareIcon />
              In JQL-Suche öffnen
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Gespeicherte Ansichten</DropdownMenuLabel>
          {table.savedViews.map((view) => (
            <DropdownMenuItem key={view.name} onSelect={() => table.applyView(view)} className="group/view">
              <BookmarkIcon />
              <span className="flex-1 truncate">{view.name}</span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Ansicht ${view.name} löschen`}
                className="opacity-0 transition-opacity group-hover/view:opacity-100 group-focus/view:opacity-100"
                onClick={(event) => {
                  event.stopPropagation();
                  table.removeView(view.name);
                }}
              >
                <Trash2Icon />
              </Button>
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onSelect={() => setSaving(true)}>
            <BookmarkPlusIcon />
            Ansicht speichern…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={table.resetView}>
            <RotateCcwIcon />
            Auf Standard zurücksetzen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <NameDialog
        open={saving}
        onOpenChange={setSaving}
        title="Ansicht speichern"
        description="Spalten, Sortierung und Filter werden lokal gespeichert."
        onSubmit={(name) => {
          table.saveView(name);
          setSaving(false);
        }}
      />
    </>
  );
}

function ActiveFilters({ table }: { table: IssueTableState }) {
  const reduce = useReducedMotion();
  const chips = table.facets.flatMap((facet) =>
    facet.selected.map((value) => ({
      facet,
      option: facet.options.find((option) => option.value === value) ?? { value, label: value },
    })),
  );
  return (
    <AnimatePresence initial={false}>
      {chips.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
          className="flex flex-wrap items-center gap-1.5"
        >
          <AnimatePresence initial={false} mode="popLayout">
            {chips.map(({ facet, option }) => (
              <motion.span
                key={`${facet.id}:${option.value}`}
                layout={!reduce}
                initial={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: reduce ? 1 : 0.96, transition: { duration: 0.12 } }}
                transition={SPRING_LAYOUT}
                className="flex h-6 items-center gap-1 rounded-md bg-muted pr-0.5 pl-2 text-xs"
              >
                <span className="text-muted-foreground">{facet.label}:</span>
                <FacetOptionIcon option={option} />
                <span className="max-w-40 truncate">{option.label}</span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="size-5"
                  aria-label={`${facet.label} ${option.label} entfernen`}
                  onClick={() => table.toggleFacet(facet.id, option.value)}
                >
                  <XIcon />
                </Button>
              </motion.span>
            ))}
          </AnimatePresence>
          <motion.span layout={!reduce} transition={SPRING_LAYOUT}>
            <Button variant="link" size="xs" onClick={table.clearFilters}>
              Alle entfernen
            </Button>
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function IssueToolbar({
  table,
  onAdoptJql,
  onOpenSearch,
}: {
  table: IssueTableState;
  onAdoptJql?: (jql: string) => void;
  onOpenSearch?: (jql: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="h-8 w-64">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            placeholder="In Ergebnissen suchen"
            aria-label="Volltextsuche"
            value={table.text}
            onChange={(event) => table.setText(event.target.value)}
            onKeyDown={(event) => event.key === "Escape" && table.setText("")}
          />
          <AnimatePresence initial={false}>
            {table.text && (
              <InputGroupAddon align="inline-end">
                <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.12 }}>
                  <InputGroupButton size="icon-xs" aria-label="Suche leeren" onClick={() => table.setText("")}>
                    <XIcon />
                  </InputGroupButton>
                </motion.span>
              </InputGroupAddon>
            )}
          </AnimatePresence>
        </InputGroup>
        <div className="flex flex-wrap items-center gap-1.5">
          {QUICK_KEYS.map((key) => (
            <QuickFilterChip
              key={key}
              label={QUICK_FILTERS[key].label}
              active={table.quick.includes(key)}
              onClick={() => table.toggleQuick(key)}
            />
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ResultCount loaded={table.issues.length} total={table.total} />
          <Button variant="ghost" size="icon-sm" aria-label="Aktualisieren" onClick={table.refresh} disabled={table.isFetching}>
            <RefreshCwIcon className={cn(table.isFetching && "animate-spin")} />
          </Button>
          <FacetMenu
            groups={table.facets}
            count={table.facets.reduce((sum, facet) => sum + facet.selected.length, 0)}
            onToggle={table.toggleFacet}
            onClear={table.clearFilters}
          />
          <ColumnPicker
            columns={table.columns}
            fields={table.availableFields}
            onToggle={table.toggleColumn}
            onReorder={table.setColumns}
          />
          <ViewMenu table={table} onAdoptJql={onAdoptJql} onOpenSearch={onOpenSearch} />
        </div>
      </div>
      <ActiveFilters table={table} />
    </div>
  );
}
