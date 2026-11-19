import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  BookmarkIcon,
  BookmarkPlusIcon,
  ChevronDownIcon,
  ClipboardCopyIcon,
  CodeIcon,
  EllipsisIcon,
  GroupIcon,
  ImportIcon,
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
import { ViewImportContent } from "@/components/issues/view-import-content";
import { LabelComparisonContent } from "@/components/issues/label-comparison-content";
import { CustomerChangeDraftContent } from "@/components/issues/customer-change-draft-content";
import { Tooltip } from "@/components/motion/tooltip";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import type { IssueTableState } from "@/hooks/use-issue-table";
import { useIssueToolbar, type IssueToolbarFilters } from "@/hooks/use-issue-toolbar";
import { useTheme } from "@/hooks/use-theme";
import { EASE_OUT, SPRING_LAYOUT, SPRING_PRESS } from "@/lib/ease";
import { QUICK_FILTERS } from "@/lib/jira/issue-view";
import { ISSUE_GROUPINGS } from "@/lib/jira/issue-grouping";
import { cn } from "@/lib/utils";

function QuickFilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      whileTap={reduce ? undefined : { scale: 0.96 }}
      transition={SPRING_PRESS}
      className={cn(
        "h-7 rounded-full border px-3 text-xs font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </motion.button>
  );
}

function ResultCount({ loaded, total }: { loaded: number; total?: number }) {
  const reduce = useReducedMotion();
  const label = total === undefined || total === loaded ? `${loaded}` : `${loaded} von ${total}`;
  return (
    <span className="flex items-center text-xs text-muted-foreground tabular-nums" aria-live="polite">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={label}
          initial={{ opacity: 0, y: reduce ? 0 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduce ? 0 : -4, transition: { duration: 0.1 } }}
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
  const trigger = useRef<HTMLButtonElement>(null);
  const draftEditor = useRef<HTMLTextAreaElement>(null);
  const restoreDraftFocus = useRef(false);
  const draft = table.customerChangeDraft;
  const panelOpen = table.transfer.open || table.labelComparison.open || draft.open;
  return (
    <>
      <Popover open={panelOpen} onOpenChange={(open) => { if (!open) { table.transfer.setOpen(false); table.labelComparison.setOpen(false); draft.setOpen(false); } }}>
      <DropdownMenu>
        <Tooltip content="Ansicht und Export">
        <PopoverAnchor asChild>
        <DropdownMenuTrigger asChild>
          <Button ref={trigger} variant="outline" size="icon-sm" aria-label="Ansicht und Export">
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        </PopoverAnchor>
        </Tooltip>
        <DropdownMenuContent align="end" className="min-w-60 [&_[role=menuitem]]:min-h-8 [&_[role=menuitem]]:rounded-xl" onCloseAutoFocus={(event) => { if (panelOpen) event.preventDefault(); }}>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <GroupIcon />
              Gruppieren nach
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-48">
              <DropdownMenuRadioGroup value={table.groupBy} onValueChange={table.setGrouping}>
                {Object.entries(ISSUE_GROUPINGS).map(([value, label]) => (
                  <DropdownMenuRadioItem key={value} value={value} className="min-h-8 rounded-xl">{label}</DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {table.groupBy !== "none" && (
            <>
              <DropdownMenuItem onSelect={table.expandGroups} disabled={!table.hasCollapsedGroups}>Alle Gruppen aufklappen</DropdownMenuItem>
              <DropdownMenuItem onSelect={table.collapseGroups}>Alle Gruppen einklappen</DropdownMenuItem>
            </>
          )}
          <DropdownMenuCheckboxItem
            checked={table.dense}
            onCheckedChange={(checked) => table.setDense(checked === true)}
          >
            <Rows3Icon />
            Kompakte Zeilen
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={table.labelComparison.disabled} onSelect={() => table.labelComparison.setOpen(true)}>Labelvarianten vergleichen…</DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ClipboardCopyIcon />
              Kopieren als
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="min-w-52">
              <DropdownMenuLabel>Nur geladene Treffer kopieren</DropdownMenuLabel>
              <DropdownMenuItem disabled={table.searchLoad.pending ? false : !table.searchLoad.canStart} onSelect={table.searchLoad.pending ? table.searchLoad.stop : table.searchLoad.start}>
                {table.searchLoad.pending ? "Nachladen abbrechen" : "Übrige Treffer begrenzt laden…"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={table.isPlaceholder} onSelect={() => void table.exportAs("tsv")}>
                <TableIcon />
                Tabelle (Excel, Numbers)
              </DropdownMenuItem>
              <DropdownMenuItem disabled={table.isPlaceholder} onSelect={() => void table.exportAs("markdown")}>
                <CodeIcon />
                Markdown
              </DropdownMenuItem>
              <DropdownMenuItem disabled={table.isPlaceholder} onSelect={() => void table.exportAs("keys")}>
                Schlüsselliste
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void table.exportAs("jql")}>JQL</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={draft.disabled} onSelect={() => draft.setOpen(true)}>Kundenhinweis entwerfen…</DropdownMenuItem>
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
          <DropdownMenuItem onSelect={() => void table.transfer.copy()}>
            <CodeIcon />
            Ansichtsdefinition kopieren
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => table.transfer.setOpen(true)}>
            <ImportIcon />
            Ansicht importieren…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={table.resetView}>
            <RotateCcwIcon />
            Auf Standard zurücksetzen
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <PopoverContent align="end" collisionPadding={draft.open ? 16 : undefined}
        aria-label={draft.open ? "Kundenhinweis entwerfen" : table.labelComparison.open ? "Labelvarianten vergleichen" : "Ansicht importieren"}
        className={cn("overflow-y-auto rounded-2xl", draft.open
          ? "max-h-[min(42rem,85vh,var(--radix-popover-content-available-height))] w-[min(38rem,calc(100vw-2rem))] p-4"
          : "max-h-[min(42rem,85vh)] w-[min(26rem,calc(100vw-2rem))]")}
        onOpenAutoFocus={(event) => {
          restoreDraftFocus.current = !!draftEditor.current;
          if (!draftEditor.current) return;
          event.preventDefault();
          draftEditor.current.focus();
        }}
        onInteractOutside={() => { restoreDraftFocus.current = false; }}
        onCloseAutoFocus={(event) => {
          if (!restoreDraftFocus.current || event.defaultPrevented) return;
          event.preventDefault();
          trigger.current?.focus();
        }}
      >
        {draft.open && <CustomerChangeDraftContent state={draft} editorRef={draftEditor} />}
        {table.labelComparison.open && <LabelComparisonContent state={table.labelComparison} />}
        {table.transfer.open && <ViewImportContent transfer={table.transfer} />}
      </PopoverContent>
      </Popover>
      <NameDialog
        open={saving}
        onOpenChange={setSaving}
        title="Ansicht speichern"
        description="Spalten, Gruppierung, Sortierung und Filter werden für dieses Konto lokal gespeichert."
        onSubmit={(name) => {
          table.saveView(name);
          setSaving(false);
        }}
      />
    </>
  );
}

function ActiveFilters({ table, filters }: { table: IssueTableState; filters: IssueToolbarFilters }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {(filters.facetChips.length > 0 || filters.activeSecondary.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: reduce ? 0 : -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
          className="flex flex-wrap items-center gap-1.5"
        >
          <AnimatePresence initial={false} mode="popLayout">
            {filters.activeSecondary.map((key) => (
              <motion.span
                key={`quick:${key}`}
                layout={!reduce}
                initial={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: reduce ? 1 : 0.96, transition: { duration: 0.12 } }}
                transition={SPRING_LAYOUT}
                className="flex h-6 items-center gap-1 rounded-md bg-primary/10 pr-0.5 pl-2 text-xs text-primary"
              >
                {QUICK_FILTERS[key].label}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="size-5"
                  aria-label={`${QUICK_FILTERS[key].label} entfernen`}
                  onClick={() => table.toggleQuick(key)}
                >
                  <XIcon />
                </Button>
              </motion.span>
            ))}
            {filters.facetChips.map(({ facet, option }) => (
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
  const filters = useIssueToolbar(table);
  const { theme } = useTheme();
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className={cn("h-8", theme === "studio" ? "w-48" : "w-64")}>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            placeholder={table.textPlaceholder}
            aria-label="Volltextsuche"
            value={table.text}
            onChange={(event) => table.setText(event.target.value)}
            onKeyDown={(event) => event.key === "Escape" && table.setText("")}
          />
          <AnimatePresence initial={false}>
            {table.text && (
              <InputGroupAddon align="inline-end">
                <motion.span
                  initial={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
                  transition={{ duration: 0.12, ease: EASE_OUT }}
                >
                  <InputGroupButton size="icon-xs" aria-label="Suche leeren" onClick={() => table.setText("")}>
                    <XIcon />
                  </InputGroupButton>
                </motion.span>
              </InputGroupAddon>
            )}
          </AnimatePresence>
        </InputGroup>
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.primary.map((key) => (
            <QuickFilterChip
              key={key}
              label={QUICK_FILTERS[key].label}
              active={table.quick.includes(key)}
              onClick={() => table.toggleQuick(key)}
            />
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground">
                Schnellfilter
                {filters.activeSecondary.length > 0 && (
                  <span className="text-primary tabular-nums">{filters.activeSecondary.length}</span>
                )}
                <ChevronDownIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-48">
              {filters.secondary.map((key) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={table.quick.includes(key)}
                  onCheckedChange={() => table.toggleQuick(key)}
                  onSelect={(event) => event.preventDefault()}
                >
                  {QUICK_FILTERS[key].label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className={cn("ml-auto flex items-center gap-2", theme === "studio" && "flex-wrap justify-end")}>
          <ResultCount loaded={table.issues.length} total={table.total} />
          {theme === "studio" && (
            <Button
              variant={table.groupBy === "status" ? "secondary" : "outline"}
              aria-pressed={table.groupBy === "status"}
              onClick={() => table.setGrouping(table.groupBy === "status" ? "none" : "status")}
            >
              <GroupIcon aria-hidden />
              Nach Status
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Aktualisieren"
            onClick={table.refresh}
            disabled={table.isFetching || table.searchLoad.pending}
          >
            <RefreshCwIcon className={cn(table.isFetching && !reduce && "animate-spin")} />
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
      <ActiveFilters table={table} filters={filters} />
      <AnimatePresence initial={false}>
        {table.groupBy !== "none" && (
          <motion.p
            key={table.groupBy}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: EASE_OUT }}
            className="text-xs text-muted-foreground"
            role="status"
          >
            Gruppiert nach {ISSUE_GROUPINGS[table.groupBy]}. Gruppen zählen nur die geladenen Vorgänge.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
