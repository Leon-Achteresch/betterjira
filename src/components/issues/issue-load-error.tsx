import { motion, useReducedMotion } from "motion/react";
import { TriangleAlertIcon } from "lucide-react";
import { RetryButton } from "@/components/issues/retry-button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { EASE_OUT } from "@/lib/ease";
import type { IssueLoadProblem } from "@/lib/jira/issue-load";

export function IssueLoadError({
  issueKey,
  problem,
  retrying,
  onRetry,
}: {
  issueKey: string;
  problem: IssueLoadProblem;
  retrying: boolean;
  onRetry: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: EASE_OUT }}
    >
      <Empty role="alert">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlertIcon />
          </EmptyMedia>
          <EmptyTitle className="text-balance">{problem.title}</EmptyTitle>
          <EmptyDescription>{problem.description}</EmptyDescription>
          <p className="font-mono text-xs text-muted-foreground">{issueKey}</p>
          {problem.detail && <p className="text-xs break-words text-muted-foreground">{problem.detail}</p>}
        </EmptyHeader>
        <EmptyContent>
          <RetryButton retrying={retrying} onRetry={onRetry} />
        </EmptyContent>
      </Empty>
    </motion.div>
  );
}
