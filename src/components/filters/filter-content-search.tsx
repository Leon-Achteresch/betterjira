import { useId } from "react";
import { Link } from "@tanstack/react-router";
import { SearchCodeIcon } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { Fade } from "@/components/motion/fade";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useFilterContentSearch } from "@/hooks/use-filter-content-search";
import type { JiraFilter } from "@/lib/jira/saved-filters";

type FilterContentSearchProps = {
  filters: readonly JiraFilter[];
  context: string;
};

function ContentSearchForm({ filters }: { filters: readonly JiraFilter[] }) {
  const search = useFilterContentSearch(filters);
  return (
    <>
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          search.submit();
        }}
      >
        <Input
          type="search"
          aria-label="Text in gespeicherten Abfragen"
          value={search.input}
          placeholder="z. B. component = Versand"
          onChange={(event) => search.change(event.target.value)}
        />
        <Button
          type="submit"
          size="sm"
          className="min-h-8"
          disabled={!search.input.trim()}
        >
          Suchen
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        Nur geladene eigene und favorisierte Filter. {search.coverage.loaded}{" "}
        geladen · {search.coverage.missing} ohne verfügbares JQL.
      </p>
      <p
        role="status"
        className={search.searched ? "text-xs tabular-nums" : "sr-only"}
      >
        {search.searched &&
          (search.total === 0
            ? "Kein Treffer im verfügbaren JQL."
            : `${search.total} Treffer · Seite ${search.page} von ${search.pageCount}`)}
      </p>
      <AnimatePresence initial={false} mode="wait">
        {search.matches.length > 0 && (
          <Fade key={search.page}>
            <Stagger
              role="list"
              aria-label="JQL-Treffer"
              className="divide-y divide-border/60 border-y border-border/60"
            >
              {search.matches.map(({ id, name, snippet }) => (
                <StaggerItem key={id} role="listitem">
                  <Link
                    to="/filter/$id"
                    params={{ id }}
                    search={{ abfrage: true }}
                    preload={false}
                    aria-label={name}
                    className="block min-h-8 rounded-xl px-2 py-2 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="block text-sm font-medium wrap-anywhere">
                      {name}
                    </span>
                    <code className="block text-xs text-muted-foreground whitespace-pre-wrap wrap-anywhere">
                      {snippet}
                    </code>
                  </Link>
                </StaggerItem>
              ))}
            </Stagger>
          </Fade>
        )}
      </AnimatePresence>
      {search.pageCount > 1 && (
        <nav
          aria-label="Trefferseiten"
          className="flex flex-wrap justify-between gap-2"
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-8"
            onClick={search.previous}
            disabled={search.page === 1}
          >
            Vorherige Seite
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-8"
            onClick={search.next}
            disabled={search.page === search.pageCount}
          >
            Nächste Seite
          </Button>
        </nav>
      )}
    </>
  );
}

export function FilterContentSearch({
  filters,
  context,
}: FilterContentSearchProps) {
  const title = useId();
  return (
    <Popover key={context}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="min-h-8 self-end md:self-auto"
        >
          <SearchCodeIcon aria-hidden /> JQL-Inhalte prüfen
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={12}
        aria-labelledby={title}
        className="w-[min(30rem,calc(100vw-1.5rem))] p-3"
      >
        <h2 id={title} className="font-medium text-balance">
          JQL-Inhalte prüfen
        </h2>
        <ContentSearchForm filters={filters} />
      </PopoverContent>
    </Popover>
  );
}
