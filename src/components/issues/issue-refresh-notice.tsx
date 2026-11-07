import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { TriangleAlertIcon } from "lucide-react";
import { RetryButton } from "@/components/issues/retry-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { EASE_OUT } from "@/lib/ease";
import type { IssueLoadProblem } from "@/lib/jira/issue-load";

export function IssueRefreshNotice({
  problem,
  loadedLabel,
  retrying,
  onRetry,
}: {
  problem: IssueLoadProblem | null;
  loadedLabel: string;
  retrying: boolean;
  onRetry: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {problem && (
        <motion.div
          key="refresh-problem"
          initial={{ opacity: 0, y: reduce ? 0 : -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
          transition={{ duration: 0.22, ease: EASE_OUT }}
        >
          <Alert variant="warning" className="rounded-xl">
            <TriangleAlertIcon />
            <AlertTitle className="text-balance">Aktualisierung fehlgeschlagen. Angezeigt wird der zuletzt geladene Stand.</AlertTitle>
            <AlertDescription className="flex min-w-0 flex-col items-start gap-2">
              <span>
                <span className="tabular-nums">{loadedLabel}</span> · {problem.title}. {problem.description}
              </span>
              {problem.detail && <span className="text-xs break-words">{problem.detail}</span>}
              <RetryButton retrying={retrying} onRetry={onRetry} />
            </AlertDescription>
          </Alert>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
