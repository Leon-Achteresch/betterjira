import { Link } from "@tanstack/react-router";
import { formatDistanceToNowStrict } from "date-fns";
import { de } from "date-fns/locale";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { ArrowRightIcon, CornerDownRightIcon, RefreshCwIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import type { AttentionItem, AttentionResult, AttentionUrgency } from "@/lib/attention/client";
import { EASE_OUT, SPRING_PRESS } from "@/lib/ease";
import { cn } from "@/lib/utils";

const URGENCY: Record<AttentionUrgency, { label: string; dot: string; text: string }> = {
  now: { label: "Jetzt", dot: "bg-destructive", text: "text-destructive" },
  today: { label: "Heute", dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  soon: { label: "Bald", dot: "bg-muted-foreground/50", text: "text-muted-foreground" },
};

const listVariants: Variants = { show: { transition: { staggerChildren: 0.03 } } };

type AttentionBriefingProps = {
  configured: boolean;
  result: AttentionResult | null;
  error: Error | null;
  loading: boolean;
  analyzing: boolean;
  canRun: boolean;
  onRun: () => void;
};

export function AttentionBriefing({ configured, result, error, loading, analyzing, canRun, onRun }: AttentionBriefingProps) {
  const reduced = useReducedMotion();
  const fade = { initial: { opacity: 0, y: reduced ? 0 : 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 } };

  if (loading) return null;
  if (!configured) return <SetupPrompt />;

  return (
    <section aria-labelledby="attention-title" className="relative flex flex-col gap-5">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 id="attention-title" className="flex items-center gap-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
          <SparklesIcon className="size-3.5 text-sidebar-primary" />
          Braucht deine Aufmerksamkeit
          {result && <span className="tabular-nums text-foreground">{result.items.length}</span>}
        </h2>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={analyzing ? "analyzing" : (result?.runId ?? "none")} {...fade} transition={{ duration: 0.16, ease: EASE_OUT }}>
              {analyzing
                ? "Agent analysiert deine Tickets …"
                : result && `Aktualisiert ${formatDistanceToNowStrict(new Date(result.generatedAt), { locale: de, addSuffix: true })}`}
            </motion.span>
          </AnimatePresence>
          <Button variant="ghost" size="sm" onClick={onRun} disabled={!canRun || analyzing} aria-label="Briefing aktualisieren">
            {analyzing ? <Spinner /> : <RefreshCwIcon />}
            Aktualisieren
          </Button>
        </div>
      </header>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {result ? (
          <motion.div key={result.runId} {...fade} transition={{ duration: 0.28, ease: EASE_OUT }} className="flex flex-col gap-5">
            <p className="max-w-3xl text-lg text-balance">{result.summary}</p>
            {result.items.length > 0 && (
              <motion.ol variants={listVariants} initial="hidden" animate="show" className="flex flex-col gap-2">
                {result.items.map((item) => (
                  <AttentionRow key={item.key} item={item} reduced={!!reduced} />
                ))}
              </motion.ol>
            )}
          </motion.div>
        ) : analyzing ? (
          <motion.div key="skeleton" {...fade} className="flex flex-col gap-2" aria-busy>
            <Skeleton className="h-6 w-2/3" />
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </motion.div>
        ) : (
          <motion.p key="empty" {...fade} className="text-muted-foreground">
            Noch kein Briefing. Starte die erste Analyse mit „Aktualisieren“.
          </motion.p>
        )}
      </AnimatePresence>
    </section>
  );
}

function AttentionRow({ item, reduced }: { item: AttentionItem; reduced: boolean }) {
  const urgency = URGENCY[item.urgency];
  return (
    <motion.li
      variants={{ hidden: { opacity: 0, y: reduced ? 0 : 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.24, ease: EASE_OUT } } }}
      whileHover={reduced ? undefined : { y: -1 }}
      whileTap={reduced ? undefined : { scale: 0.99 }}
      transition={SPRING_PRESS}
      className="group relative grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1 rounded-xl border bg-card px-4 py-3 shadow-xs transition-colors hover:border-foreground/15 hover:bg-muted/40 has-[a:focus-visible]:ring-2 has-[a:focus-visible]:ring-ring"
    >
      <span className={cn("flex items-center gap-1.5 pt-0.5 text-xs font-medium", urgency.text)}>
        <span aria-hidden className={cn("size-1.5 rounded-full", urgency.dot)} />
        {urgency.label}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <Link
          to="/issue/$key"
          params={{ key: item.key }}
          className="flex min-w-0 items-baseline gap-2 outline-none after:absolute after:inset-0 after:rounded-xl"
        >
          <span className="shrink-0 font-mono text-xs text-muted-foreground">{item.key}</span>
          <span className="truncate font-medium">{item.title}</span>
        </Link>
        <p className="flex items-start gap-1.5 text-sm">
          <CornerDownRightIcon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-sidebar-primary" />
          <span>{item.action}</span>
        </p>
        <p className="text-sm text-muted-foreground">{item.reason}</p>
      </div>
      <span className="flex items-center gap-2 pt-0.5 text-xs whitespace-nowrap text-muted-foreground">
        {item.waitingOn && <span className="rounded-full bg-muted px-2 py-0.5">wartet: {item.waitingOn}</span>}
        <ArrowRightIcon className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100 group-has-[a:focus-visible]:opacity-100" />
      </span>
    </motion.li>
  );
}

function SetupPrompt() {
  return (
    <section className="flex flex-wrap items-center gap-4 rounded-xl border border-dashed px-5 py-4">
      <SparklesIcon className="size-5 text-sidebar-primary" />
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="font-medium">KI-Briefing einrichten</p>
        <p className="text-sm text-muted-foreground">
          Ein Agent in T3 Code liest deine Tickets und zeigt hier, was deine Aufmerksamkeit braucht und was zu tun ist.
        </p>
      </div>
      <Button variant="outline" size="sm" asChild>
        <Link to="/settings/briefing">Einrichten</Link>
      </Button>
    </section>
  );
}
