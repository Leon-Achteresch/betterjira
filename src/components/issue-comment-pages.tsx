import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronsDownIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { IssueCommentPages as CommentPages } from "@/hooks/jira/use-issue-comment-pages";
import { EASE_OUT } from "@/lib/ease";
import { commentProgressLabel } from "@/lib/jira/comment-pages";

export function IssueCommentPages({ pages }: { pages: CommentPages }) {
  const reduce = useReducedMotion();
  const actionable = pages.next !== undefined || !!pages.error;
  const label = pages.error ? "Erneut versuchen" : "Weitere Kommentare laden";

  return (
    <motion.div
      layout={!reduce}
      initial={{ opacity: 0, y: reduce ? 0 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: EASE_OUT }}
      className="flex flex-col gap-2 rounded-xl border border-dashed px-3 py-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p
          ref={pages.statusRef}
          tabIndex={-1}
          role="status"
          className="min-w-0 text-xs text-muted-foreground tabular-nums outline-none"
        >
          {commentProgressLabel(pages)}
        </p>
        {actionable && (
          <Button
            type="button"
            variant="outline"
            aria-disabled={pages.loading}
            aria-busy={pages.loading}
            onClick={pages.loadMore}
            className="aria-disabled:opacity-70"
          >
            {pages.loading ? <Spinner /> : pages.error ? <RefreshCwIcon /> : <ChevronsDownIcon />}
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={label}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.15, ease: EASE_OUT }}
              >
                {label}
              </motion.span>
            </AnimatePresence>
          </Button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {pages.error && (
          <motion.p
            key="comment-pages-error"
            role="alert"
            initial={{ opacity: 0, y: reduce ? 0 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className="text-xs break-words text-destructive"
          >
            Weitere Kommentare konnten nicht geladen werden. Bereits geladene bleiben sichtbar. {pages.error}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
