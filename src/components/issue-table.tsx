import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SearchXIcon, TriangleAlertIcon } from "lucide-react";
import { IssueGrid } from "@/components/issues/issue-grid";
import { IssueToolbar } from "@/components/issues/issue-toolbar";
import { SelectionToolbar } from "@/components/issues/selection-toolbar";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { type IssueTableText, useIssueTable } from "@/hooks/use-issue-table";
import { EASE_OUT, SPRING_LAYOUT } from "@/lib/ease";
import { jiraErrors } from "@/lib/jira/field-values";
import { useJiraSite } from "@/lib/jira/queries";

function Notice({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.12 } }}
      transition={{ duration: 0.18, ease: EASE_OUT }}
      className="w-full"
    >
      {children}
    </motion.div>
  );
}

function FailedNotice({
  title,
  error,
  retryLabel,
  retrying,
  disabled = false,
  onRetry,
}: {
  title: string;
  error: unknown;
  retryLabel: string;
  retrying: boolean;
  disabled?: boolean;
  onRetry: () => void;
}) {
  return (
    <Alert variant="warning" className="rounded-xl">
      <TriangleAlertIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{jiraErrors(error).messages.join(" ")}</AlertDescription>
      <AlertAction>
        <Button variant="outline" size="xs" onClick={onRetry} disabled={disabled || retrying}>
          {retrying && <Spinner aria-hidden />}
          {retryLabel}
        </Button>
      </AlertAction>
    </Alert>
  );
}

export function IssueTable({
  jql,
  scope = jql,
  openSearch = true,
  onAdoptJql,
  text,
}: {
  jql: string;
  scope?: string;
  openSearch?: boolean;
  onAdoptJql?: (jql: string) => void;
  text?: IssueTableText;
}) {
  const table = useIssueTable(scope, jql, text);
  const reduce = useReducedMotion();
  const site = useJiraSite();
  const navigate = useNavigate();
  const filtered = table.filterCount > 0 || table.text.trim() !== "";

  return (
    <div className="flex flex-col gap-4">
      <IssueToolbar
        table={table}
        onAdoptJql={onAdoptJql}
        onOpenSearch={openSearch ? (composed) => void navigate({ to: "/suche", search: { jql: composed } }) : undefined}
      />
      <SelectionToolbar
        count={table.selection.selected.length}
        loaded={table.issues.length}
        disabled={table.isPlaceholder}
        onCopyKeys={() => void table.exportAs("keys", true)}
        onCopyTable={() => void table.exportAs("tsv", true)}
        onCopyMarkdown={() => void table.exportAs("markdown", true)}
        onClear={table.selection.clear}
      />
      <AnimatePresence initial={false}>
        {table.isPlaceholder ? (
          <Notice key="placeholder">
            <Alert role="status" className="rounded-xl text-muted-foreground">
              <Spinner aria-hidden />
              <AlertDescription>
                Ergebnisse für die geänderte Abfrage werden geladen. Bis dahin sind Auswahl, Export und Weiterladen
                gesperrt.
              </AlertDescription>
            </Alert>
          </Notice>
        ) : table.refreshError ? (
          <Notice key="refresh">
            <FailedNotice
              title="Aktualisierung fehlgeschlagen. Angezeigt wird der zuletzt geladene Stand."
              error={table.refreshError}
              retryLabel="Erneut versuchen"
              retrying={table.isFetching}
              onRetry={table.refresh}
            />
          </Notice>
        ) : null}
      </AnimatePresence>
      {table.error ? (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <div className="flex flex-col gap-1">
            {jiraErrors(table.error).messages.map((message) => (
              <p key={message}>{message}</p>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={table.refresh} disabled={table.isFetching}>
            {table.isFetching && <Spinner aria-hidden />}
            Erneut versuchen
          </Button>
        </div>
      ) : table.isPending || (table.isPlaceholder && table.issues.length === 0) ? (
        <div className="flex flex-col gap-2" aria-busy>
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </div>
      ) : table.issues.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon />
            </EmptyMedia>
            <EmptyTitle>Keine Vorgänge</EmptyTitle>
            <EmptyDescription>
              {filtered ? "Kein Vorgang passt zu den aktiven Filtern." : "Diese Abfrage liefert keine Vorgänge."}
            </EmptyDescription>
          </EmptyHeader>
          {filtered && (
            <Button variant="outline" size="sm" onClick={table.clearFilters}>
              Filter zurücksetzen
            </Button>
          )}
        </Empty>
      ) : (
        <>
          <motion.div
            layout={reduce ? false : "position"}
            aria-busy={table.isPlaceholder || undefined}
            animate={{ opacity: table.isFetching ? 0.6 : 1 }}
            transition={{ opacity: { duration: 0.15, ease: EASE_OUT }, layout: SPRING_LAYOUT }}
            className="flex flex-col items-center gap-3"
          >
            <IssueGrid
              columns={table.columns}
              issues={table.issues}
              dense={table.dense}
              selectedKeys={table.selection.selectedKeys}
              allSelected={table.selection.allSelected}
              selectionDisabled={table.isPlaceholder}
              onToggleSelection={table.selection.toggle}
              onToggleAll={table.selection.toggleAll}
              siteUrl={site.data?.siteUrl}
              onSort={table.toggleSort}
              onSortDirection={table.setSortDirection}
              onHide={table.toggleColumn}
              onMove={table.moveColumn}
            />
            <AnimatePresence initial={false}>
              {table.loadMoreError && (
                <Notice key="more">
                  <FailedNotice
                    title="Weitere Vorgänge konnten nicht geladen werden. Die bisherigen Treffer bleiben erhalten."
                    error={table.loadMoreError}
                    retryLabel="Erneut laden"
                    retrying={table.isLoadingMore}
                    disabled={!table.canLoadMore}
                    onRetry={table.loadMore}
                  />
                </Notice>
              )}
            </AnimatePresence>
            {table.hasMore && !table.loadMoreError && (
              <Button variant="outline" size="sm" onClick={table.loadMore} disabled={!table.canLoadMore}>
                {table.isLoadingMore && <Spinner />}
                Weitere laden
                {table.total !== undefined && (
                  <span className="text-muted-foreground tabular-nums">
                    ({table.issues.length} von {table.total})
                  </span>
                )}
              </Button>
            )}
          </motion.div>
        </>
      )}
    </div>
  );
}
