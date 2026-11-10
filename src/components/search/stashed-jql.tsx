import { motion, useReducedMotion } from "motion/react";
import { TerminalSquareIcon, XIcon } from "lucide-react";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import { EASE_OUT } from "@/lib/ease";

export function StashedJql({ jql, onDiscard }: { jql: string; onDiscard: () => void }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, scale: reduce ? 1 : 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: reduce ? 1 : 0.96, transition: { duration: 0.12 } }}
      transition={{ duration: 0.18, ease: EASE_OUT }}
      className="flex h-8 min-w-0 max-w-full items-center gap-2 rounded-xl border bg-muted/40 pr-0.5 pl-2.5 text-xs text-muted-foreground"
    >
      <TerminalSquareIcon className="size-3.5 shrink-0" />
      <span className="shrink-0">JQL gemerkt:</span>
      <code className="min-w-0 truncate font-mono text-foreground" title={jql}>
        {jql}
      </code>
      <Tooltip content="Gemerkte JQL verwerfen" side="bottom">
        <Button variant="ghost" size="icon-sm" aria-label="Gemerkte JQL verwerfen" onClick={onDiscard}>
          <XIcon />
        </Button>
      </Tooltip>
    </motion.div>
  );
}
