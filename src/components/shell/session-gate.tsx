import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SessionError } from "@/components/shell/session-error";
import type { JiraSession } from "@/hooks/jira/use-jira-session";
import { EASE_OUT } from "@/lib/ease";

export function SessionGate({
  session,
  pending,
  unconnected,
  children,
  className,
}: {
  session: JiraSession;
  pending: ReactNode;
  unconnected: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const content = {
    pending,
    unconnected,
    connected: children,
    error: <SessionError message={session.errorMessage} retrying={session.retrying} onRetry={session.retry} />,
  }[session.status];

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={session.status}
        initial={{ opacity: 0, y: reduce ? 0 : 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
        transition={{ duration: 0.24, ease: EASE_OUT }}
        className={className}
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );
}
