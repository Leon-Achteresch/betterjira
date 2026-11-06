import { useState } from "react";
import { BookmarkPlusIcon, SearchIcon } from "lucide-react";
import { IssueTable } from "@/components/issue-table";
import { JqlEditor } from "@/components/issues/jql-editor";
import { NameDialog } from "@/components/issues/name-dialog";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import type { JqlSearchState } from "@/hooks/use-jql-search";

export function JqlSearch({ jql, search }: { jql?: string; search: JqlSearchState }) {
  const [saving, setSaving] = useState(false);
  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border bg-muted/30 p-3">
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
        onSubmit={search.saveAs}
      />
    </div>
  );
}
