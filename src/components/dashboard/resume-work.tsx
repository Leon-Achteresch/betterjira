import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpRightIcon, BookOpenIcon, FilePenLineIcon } from "lucide-react";
import { useResumeWork } from "@/hooks/use-resume-work";
import { EASE_OUT, SPRING_PRESS } from "@/lib/ease";

export function ResumeWork() {
  const item = useResumeWork();
  const reduce = useReducedMotion();
  if (!item) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE_OUT }}
      whileHover={reduce ? undefined : { y: -1 }}
      whileTap={reduce ? undefined : { scale: 0.995 }}
    >
      <Link
        to="/issue/$key"
        params={{ key: item.key }}
        className="group flex items-center gap-4 rounded-xl bg-muted/60 px-5 py-4 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
      >
        <BookOpenIcon className="size-5 shrink-0 text-primary" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            Weiterlesen<span className="font-mono">{item.key}</span>
            {item.hasDraft && (
              <span className="flex items-center gap-1 text-primary">
                <FilePenLineIcon className="size-3" />
                Entwurf
              </span>
            )}
          </span>
          <span className="truncate text-sm font-medium">{item.summary}</span>
          {item.note && <span className="truncate text-xs text-muted-foreground">{item.note}</span>}
        </div>
        <motion.span whileHover={reduce ? undefined : { x: 2 }} transition={SPRING_PRESS}>
          <ArrowUpRightIcon className="size-4 text-muted-foreground group-hover:text-foreground" />
        </motion.span>
      </Link>
    </motion.div>
  );
}
