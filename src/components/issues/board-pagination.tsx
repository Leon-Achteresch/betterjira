import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { EASE_OUT } from "@/lib/ease";

export function BoardPagination({ hasMore, fetching, error, onLoadMore, onRetry, sentinelRef }: {
  hasMore: boolean;
  fetching: boolean;
  error?: string;
  onLoadMore: () => void;
  onRetry: () => void;
  sentinelRef?: React.Ref<HTMLDivElement>;
}) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {(hasMore || error) && (
        <motion.div
          key="pagination"
          ref={sentinelRef}
          initial={{ opacity: 0, y: reduce ? 0 : 4 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.16, ease: EASE_OUT } }}
          exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
          className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground"
        >
          {error && <p role="alert">Weitere Vorgänge konnten nicht geladen werden: {error}</p>}
          <Button variant="outline" disabled={fetching} onClick={error ? onRetry : onLoadMore}>
            {fetching ? "Weitere Vorgänge werden geladen …" : error ? "Erneut versuchen" : "Weitere Vorgänge laden"}
          </Button>
          {hasMore && <span>Filter und Insights berücksichtigen die geladenen Vorgänge.</span>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
