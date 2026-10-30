import { useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { SearchXIcon } from "lucide-react";
import { IssueGrid } from "@/components/issues/issue-grid";
import { IssueToolbar } from "@/components/issues/issue-toolbar";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useIssueTable } from "@/hooks/use-issue-table";
import { EASE_OUT } from "@/lib/ease";
import { jiraErrors } from "@/lib/jira/field-values";
import { useJiraSite } from "@/lib/jira/queries";

export function IssueTable({
  jql,
  scope = jql,
  openSearch = true,
  onAdoptJql,
}: {
  jql: string;
  scope?: string;
  openSearch?: boolean;
  onAdoptJql?: (jql: string) => void;
}) {
  const table = useIssueTable(scope, jql);
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
      {table.error ? (
        <div role="alert" className="flex flex-col gap-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {jiraErrors(table.error).messages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      ) : table.isPending ? (
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
            <EmptyDescription>{filtered ? "Kein Vorgang passt zu den aktiven Filtern." : "Diese Abfrage liefert keine Vorgänge."}</EmptyDescription>
          </EmptyHeader>
          {filtered && (
            <Button variant="outline" size="sm" onClick={table.clearFilters}>
              Filter zurücksetzen
            </Button>
          )}
        </Empty>
      ) : (
        <motion.div
          animate={{ opacity: table.isFetching ? 0.6 : 1 }}
          transition={{ duration: 0.15, ease: EASE_OUT }}
          className="flex flex-col items-center gap-3"
        >
          <IssueGrid
            columns={table.columns}
            issues={table.issues}
            dense={table.dense}
            siteUrl={site.data?.siteUrl}
            onSort={table.toggleSort}
            onSortDirection={table.setSortDirection}
            onHide={table.toggleColumn}
            onMove={table.moveColumn}
          />
          {table.hasMore && (
            <Button variant="outline" size="sm" onClick={table.loadMore} disabled={table.isLoadingMore}>
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
      )}
    </div>
  );
}
