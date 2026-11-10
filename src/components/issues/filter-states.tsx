import { motion, useReducedMotion } from "motion/react";
import { AlertTriangleIcon, CircleAlertIcon, RotateCwIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { EASE_OUT } from "@/lib/ease";

type Retry = { retrying: boolean; onRetry: () => void };

function RetryButton({ retrying, onRetry }: Retry) {
  return (
    <Button variant="outline" onClick={onRetry} disabled={retrying}>
      {retrying ? <Spinner aria-hidden /> : <RotateCwIcon />}
      Erneut versuchen
    </Button>
  );
}

export function FilterSkeleton() {
  return (
    <div role="status" aria-label="Filter wird geladen" className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-xl" />
        <Skeleton className="h-7 w-56 rounded-xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}

export function FilterLoadError({
  title,
  description,
  detail,
  retrying,
  onRetry,
}: { title: string; description: string; detail: string } & Retry) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: EASE_OUT }}
    >
      <Empty role="alert" className="rounded-2xl border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <CircleAlertIcon />
          </EmptyMedia>
          <EmptyTitle className="text-balance">{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
          {detail && <p className="text-xs break-words text-muted-foreground">{detail}</p>}
        </EmptyHeader>
        <EmptyContent>
          <RetryButton retrying={retrying} onRetry={onRetry} />
        </EmptyContent>
      </Empty>
    </motion.div>
  );
}

export function FilterRefreshNotice({ retrying, onRetry }: Retry) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
      transition={{ duration: 0.2, ease: EASE_OUT }}
    >
      <Alert variant="warning" className="flex flex-wrap items-center gap-3 rounded-xl p-3">
        <AlertTriangleIcon className="shrink-0" />
        <div className="min-w-0 flex-1">
          <AlertTitle>Filter konnte nicht aktualisiert werden</AlertTitle>
          <AlertDescription>Name und JQL zeigen den zuletzt geladenen Stand.</AlertDescription>
        </div>
        <RetryButton retrying={retrying} onRetry={onRetry} />
      </Alert>
    </motion.div>
  );
}
