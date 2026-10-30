import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BookmarkPlusIcon, SearchIcon, TerminalSquareIcon } from "lucide-react";
import { IssueTable } from "@/components/issue-table";
import { JqlEditor } from "@/components/issues/jql-editor";
import { NameDialog } from "@/components/issues/name-dialog";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { useJqlSearch } from "@/hooks/use-jql-search";
import { useJiraSite } from "@/lib/jira/queries";

export const Route = createFileRoute("/suche")({
  validateSearch: (search: Record<string, unknown>): { jql?: string } =>
    typeof search.jql === "string" && search.jql.trim() ? { jql: search.jql } : {},
  component: Suche,
});

function Suche() {
  const { jql = "" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const site = useJiraSite();
  const search = useJqlSearch(jql, (next) => void navigate({ search: next ? { jql: next } : {} }));
  const [saving, setSaving] = useState(false);

  if (!site.isPending && !site.data) {
    return <p className="p-8 text-muted-foreground">Melde dich auf der Startseite an, um zu suchen.</p>;
  }
  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-md bg-muted">
          <TerminalSquareIcon className="size-5 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-semibold">JQL-Suche</h1>
      </div>
      <section className="rounded-xl border bg-muted/30 p-3">
        <JqlEditor value={search.value} onChange={search.setValue} onApply={search.search} errors={search.errors} validating={search.validating}>
          <Button size="sm" onClick={search.search} disabled={!search.value.trim() || search.errors.length > 0}>
            <SearchIcon />
            Suchen
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!jql}
            onClick={() => {
              search.resetCreate();
              setSaving(true);
            }}
          >
            <BookmarkPlusIcon />
            Als Filter speichern…
          </Button>
        </JqlEditor>
      </section>
      {jql ? (
        <IssueTable scope="suche" jql={jql} openSearch={false} onAdoptJql={search.setValue} />
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchIcon />
            </EmptyMedia>
            <EmptyTitle>Frei mit JQL suchen</EmptyTitle>
            <EmptyDescription>Gib eine Abfrage ein und drücke Suchen. Gute Treffer kannst du direkt als Filter speichern.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      <NameDialog
        open={saving}
        onOpenChange={setSaving}
        title="Als Filter speichern"
        description="Legt einen neuen Filter mit dieser JQL in Jira an."
        submitLabel="Anlegen"
        pending={search.creating}
        error={search.createError}
        onSubmit={(name) => {
          search.saveAs(name);
        }}
      />
    </div>
  );
}
