import { useId, useRef } from "react";
import { GitCompareArrowsIcon } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { Fade } from "@/components/motion/fade";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDuplicateComparison,
  type DuplicateComparisonContext,
} from "@/hooks/jira/use-duplicate-comparison";
import type { DuplicateComparison } from "@/lib/jira/duplicate-comparison";
import type { IssueLinkReference } from "@/lib/jira/issue-links";

const fields = [
  ["summary", "Titel"],
  ["status", "Status"],
  ["issueType", "Typ"],
  ["priority", "Priorität"],
] as const;

function ComparisonTable({ duplicate, original }: DuplicateComparison) {
  return (
    <table className="w-full table-fixed text-left text-xs">
      <thead>
        <tr className="border-b border-border">
          <th scope="col" className="w-[24%] p-2">
            <span className="sr-only">Feld</span>
          </th>
          <th scope="col" className="p-2 align-top wrap-anywhere">
            <span className="block font-normal text-muted-foreground">
              Duplikat
            </span>
            <span className="tabular-nums">{duplicate.key}</span>
          </th>
          <th scope="col" className="p-2 align-top wrap-anywhere">
            <span className="block font-normal text-muted-foreground">
              Ursprung laut Link
            </span>
            <span className="tabular-nums">{original.key}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {fields.map(([field, label]) => (
          <tr
            key={field}
            className="border-b border-border/60 align-top last:border-0"
          >
            <th scope="row" className="p-2 font-medium text-muted-foreground">
              {label}
            </th>
            {[duplicate, original].map((ticket) => (
              <td key={ticket.key} className="p-2 wrap-anywhere">
                {ticket[field] ?? (
                  <span className="text-muted-foreground">Nicht verfügbar</span>
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DuplicateComparisonAction({
  context,
  target,
  reference,
}: {
  context: DuplicateComparisonContext;
  target: string;
  reference: IssueLinkReference;
}) {
  const comparison = useDuplicateComparison(context, target, reference);
  const titleId = useId();
  const title = useRef<HTMLHeadingElement>(null);
  if (!comparison.available) return null;
  return (
    <Popover
      key={comparison.context}
      open={comparison.open}
      onOpenChange={comparison.setOpen}
    >
      <Tooltip content="Duplikat vergleichen">
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Duplikatlink zu ${target} vergleichen`}
          >
            <GitCompareArrowsIcon />
          </Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent
        side="top"
        align="end"
        collisionPadding={12}
        aria-labelledby={titleId}
        className="w-[min(31rem,calc(100vw-1.5rem))] p-3"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          title.current?.focus();
        }}
      >
        <h2
          id={titleId}
          ref={title}
          tabIndex={-1}
          className="px-2 font-medium text-balance outline-none"
        >
          Duplikat vergleichen
        </h2>
        <AnimatePresence initial={false} mode="wait">
          {comparison.result ? (
            <Fade key="comparison">
              <ComparisonTable {...comparison.result} />
            </Fade>
          ) : comparison.error ? (
            <Fade key="error">
              <p role="alert" className="px-2 text-xs text-destructive">
                {comparison.error}
              </p>
            </Fade>
          ) : (
            <Fade key="loading">
              <div
                role="status"
                aria-label="Beide Tickets werden geprüft"
                className="space-y-2 px-2 py-1"
              >
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-5/6" />
              </div>
            </Fade>
          )}
        </AnimatePresence>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-8"
            onClick={() => comparison.setOpen(false)}
          >
            {comparison.loading ? "Abbrechen" : "Schließen"}
          </Button>
          {comparison.error && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-8"
              onClick={comparison.retry}
            >
              Erneut versuchen
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
