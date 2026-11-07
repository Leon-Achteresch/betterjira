import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { AlertTriangleIcon, CircleAlertIcon, ClockIcon, RotateCwIcon } from "lucide-react";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { EASE_OUT } from "@/lib/ease";

export function TimeTrackingSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Buchungen werden geladen">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Skeleton className="col-span-2 h-20 rounded-xl sm:col-span-1" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="h-28 rounded-2xl" />
      ))}
    </div>
  );
}

export function TimeTrackingEmpty({
  title,
  description,
  icon = <ClockIcon />,
  action,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Empty className="rounded-2xl border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}

export function TimeTrackingNotice({
  tone,
  title,
  messages,
  retryLabel,
  onRetry,
}: {
  tone: "warning" | "destructive";
  title: string;
  messages: readonly string[];
  retryLabel?: string;
  onRetry?: () => void;
}) {
  return (
    <Alert variant={tone} className="rounded-xl">
      {tone === "warning" ? <AlertTriangleIcon /> : <CircleAlertIcon />}
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {messages.map((message) => (
          <p key={message}>{message}</p>
        ))}
      </AlertDescription>
      {onRetry && (
        <AlertAction>
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RotateCwIcon />
            {retryLabel ?? "Erneut versuchen"}
          </Button>
        </AlertAction>
      )}
    </Alert>
  );
}

export function TimeNoticeSlot({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
      transition={{ duration: 0.2, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}
