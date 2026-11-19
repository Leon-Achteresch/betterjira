import { Link } from "@tanstack/react-router";
import { useLayoutEffect, useRef } from "react";
import { Maximize2Icon, XIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { IssueView } from "@/components/issue-view";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import { EASE_OUT } from "@/lib/ease";

export function IssuePreviewPane({ id, issueKey, focus, onClose }: {
  id: string;
  issueKey: string;
  focus: boolean;
  onClose: () => void;
}) {
  const reduce = useReducedMotion();
  const pane = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (focus) pane.current?.focus({ preventScroll: true });
  }, [focus, issueKey]);

  return (
    <motion.aside
      ref={pane}
      id={id}
      aria-label={`Ticketvorschau ${issueKey}`}
      tabIndex={-1}
      data-slot="issue-preview-pane"
      initial={{ opacity: 0, x: reduce ? 0 : 8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
      transition={{ duration: 0.2, ease: EASE_OUT }}
      className="@container sticky top-2 min-w-0 self-start overflow-y-auto rounded-2xl border bg-background outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="sticky top-0 z-30 flex items-center gap-1 border-b bg-background px-3 py-1">
        <span className="mr-auto font-mono text-xs text-muted-foreground">{issueKey}</span>
        <Tooltip content="Ticket vollständig öffnen">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/issue/$key" params={{ key: issueKey }} aria-label="Ticket vollständig öffnen">
              <Maximize2Icon />
            </Link>
          </Button>
        </Tooltip>
        <Tooltip content="Vorschau schließen">
          <Button variant="ghost" size="icon" aria-label="Vorschau schließen" onClick={onClose}>
            <XIcon />
          </Button>
        </Tooltip>
      </div>
      <div className="p-3 sm:p-4">
        <IssueView key={issueKey} issueKey={issueKey} embedded />
      </div>
    </motion.aside>
  );
}
