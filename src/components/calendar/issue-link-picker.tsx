import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckIcon, SearchIcon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { LinkedIssue } from "@/lib/calendar/model";
import { errorMessage } from "@/lib/calendar/presentation";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

type IssueLinkPickerProps = {
  linked: readonly LinkedIssue[];
  available: boolean;
  unavailableReason: string;
  checking: boolean;
  query: string;
  results: readonly LinkedIssue[];
  searching: boolean;
  error: Error | null;
  onQueryChange: (query: string) => void;
  onToggle: (issue: LinkedIssue) => void;
};

export function IssueLinkPicker({ linked, available, unavailableReason, checking, query, results, searching, error, onQueryChange, onToggle }: IssueLinkPickerProps) {
  const reduce = useReducedMotion();
  const linkedKeys = new Set(linked.map((issue) => issue.key));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-0 flex-wrap gap-1.5">
        <AnimatePresence initial={false}>
          {linked.map((issue) => (
            <motion.span
              key={issue.key}
              layout={!reduce}
              initial={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: reduce ? 1 : 0.96, transition: { duration: 0.12 } }}
              transition={{ duration: 0.16, ease: EASE_OUT }}
              className="inline-flex max-w-full items-center gap-1 rounded-md border bg-muted/40 py-0.5 pr-0.5 pl-2 text-xs"
            >
              <span className="font-mono font-medium">{issue.key}</span>
              <span className="max-w-48 truncate text-muted-foreground">{issue.summary}</span>
              <button
                type="button"
                aria-label={`${issue.key} entfernen`}
                onClick={() => onToggle(issue)}
                className="rounded p-0.5 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <XIcon className="size-3" />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
      {!available ? (
        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          {checking ? "Prüfe Jira-Anmeldung…" : unavailableReason}
        </p>
      ) : (
        <>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Tickets suchen"
              placeholder="Ticket-Schlüssel oder Text, z. B. ABC-123"
              className="pl-8"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
            {searching && <Spinner className="absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />}
          </div>
          <div role="listbox" aria-label="Suchergebnisse" aria-multiselectable className="max-h-44 overflow-y-auto rounded-md border">
            {error ? (
              <p role="alert" className="px-3 py-2 text-xs text-destructive">
                {errorMessage(error, "Suche fehlgeschlagen.")}
              </p>
            ) : results.length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">{searching ? "Suche…" : query.trim() ? "Keine Tickets gefunden." : "Keine zuletzt angesehenen Tickets."}</p>
            ) : (
              results.map((issue) => {
                const selected = linkedKeys.has(issue.key);
                return (
                  <button
                    key={issue.key}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => onToggle(issue)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm outline-none transition-colors hover:bg-muted focus-visible:bg-muted",
                      selected && "bg-primary/6",
                    )}
                  >
                    <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">{issue.key}</span>
                    <span className="min-w-0 flex-1 truncate">{issue.summary}</span>
                    <AnimatePresence initial={false}>
                      {selected && (
                        <motion.span
                          initial={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, transition: { duration: 0.1 } }}
                          transition={{ duration: 0.14, ease: EASE_OUT }}
                        >
                          <CheckIcon className="size-4 text-primary" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
