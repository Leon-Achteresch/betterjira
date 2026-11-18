import { useId, useRef } from "react";
import { ExternalLinkIcon, MessagesSquareIcon } from "lucide-react";
import { Fade } from "@/components/motion/fade";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import type { PullRequestReviewState } from "@/hooks/scm/use-pull-request-review-threads";
import type { ListedPullRequest } from "@/lib/scm/pull-requests";

type Preview = NonNullable<ReturnType<PullRequestReviewState["forEntry"]>>;

function ReviewThreadsContent({
  preview,
  onOpen,
}: {
  preview: Preview;
  onOpen: (url: string) => void;
}) {
  if (preview.fallback) {
    const url = preview.fallback;
    return (
      <Fade>
        <p className="text-sm text-muted-foreground">
          Gesprächsstatus und Codebezug stehen hier für Bitbucket nicht zur
          Verfügung.
        </p>
        <Button
          className="mt-2 min-h-8"
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onOpen(url)}
        >
          PR auf Bitbucket öffnen <ExternalLinkIcon aria-hidden />
        </Button>
      </Fade>
    );
  }
  if (preview.error)
    return (
      <Fade>
        <p role="alert" className="text-sm text-destructive">
          {preview.error}
        </p>
      </Fade>
    );
  if (!preview.result)
    return (
      <Fade>
        <div
          role="status"
          aria-label="Reviewgespräche werden geladen"
          className="space-y-2"
        >
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </Fade>
    );
  const { threads, partial } = preview.result;
  return (
    <Fade>
      {partial && (
        <p role="status" className="mb-2 text-xs text-muted-foreground">
          Teilansicht. Weitere oder unvollständige Gespräche sind möglich.
        </p>
      )}
      {!partial && !threads.length && (
        <p className="text-sm text-muted-foreground">
          GitHub meldet keine Reviewgespräche für diesen Pull Request.
        </p>
      )}
      {!!threads.length && (
        <ul
          aria-label="Gemeldete Reviewgespräche"
          className="divide-y divide-border/60"
        >
          {threads.map(({ id, path, resolved, outdated, url }) => (
            <li key={id} className="space-y-1 py-2">
              <p className="font-mono text-xs wrap-anywhere">{path}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-xl bg-muted px-2 py-1 font-medium">
                  {resolved ? "Gelöst" : "Offen"}
                </span>
                <span className="text-muted-foreground">
                  {outdated ? "Codebezug veraltet" : "Codebezug aktuell"}
                </span>
              </div>
              {url ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-2 min-h-8"
                  onClick={() => onOpen(url)}
                >
                  Original öffnen <ExternalLinkIcon aria-hidden />
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Originallink nicht bestätigt
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Fade>
  );
}

export function ReviewThreadsPopover({
  entry,
  preview,
  onOpen,
}: {
  entry: ListedPullRequest;
  preview: Preview;
  onOpen: (url: string) => void;
}) {
  const titleId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  return (
    <Popover
      key={preview.context}
      open={preview.open}
      onOpenChange={preview.onOpenChange}
    >
      <Tooltip content="Reviewgespräche prüfen">
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Reviewgespräche zu ${entry.repo} #${entry.pr.number} prüfen`}
          >
            <MessagesSquareIcon aria-hidden />
          </Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent
        align="end"
        collisionPadding={12}
        aria-labelledby={titleId}
        className="w-[min(28rem,calc(100vw-1.5rem))] p-3"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          heading.current?.focus();
        }}
      >
        <div>
          <h2
            id={titleId}
            ref={heading}
            tabIndex={-1}
            className="font-medium outline-none"
          >
            Reviewgespräche
          </h2>
          <p className="text-xs text-muted-foreground wrap-anywhere">
            {entry.repo} #{entry.pr.number}
          </p>
        </div>
        <ReviewThreadsContent preview={preview} onOpen={onOpen} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-8"
            onClick={() => preview.onOpenChange(false)}
          >
            {preview.loading ? "Abbrechen" : "Schließen"}
          </Button>
          {preview.error && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-8"
              onClick={() => {
                heading.current?.focus();
                preview.onOpenChange(true);
              }}
            >
              Erneut versuchen
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
