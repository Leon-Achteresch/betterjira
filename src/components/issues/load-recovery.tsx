import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { RotateCwIcon, TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { EASE_OUT } from "@/lib/ease";

function RetryButton({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  return (
    <Button variant="outline" onClick={onRetry} disabled={retrying}>
      {retrying ? <Spinner aria-hidden /> : <RotateCwIcon />}
      Erneut versuchen
    </Button>
  );
}

export function LoadFailed({
  icon,
  title,
  description,
  detail,
  retrying,
  onRetry,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  detail?: string;
  retrying: boolean;
  onRetry: () => void;
  action?: ReactNode;
}) {
  return (
    <Empty role="alert" className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </EmptyHeader>
      <EmptyContent className="flex-row flex-wrap justify-center">
        <RetryButton retrying={retrying} onRetry={onRetry} />
        {action}
      </EmptyContent>
    </Empty>
  );
}

export function RefreshFailed({
  title,
  detail,
  retrying,
  onRetry,
}: {
  title: string;
  detail?: string;
  retrying: boolean;
  onRetry: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
      transition={{ duration: 0.18, ease: EASE_OUT }}
    >
      <Alert variant="warning" className="rounded-xl">
        <TriangleAlertIcon />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription className="flex flex-col items-start gap-2">
          {detail}
          <RetryButton retrying={retrying} onRetry={onRetry} />
        </AlertDescription>
      </Alert>
    </motion.div>
  );
}
