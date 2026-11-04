import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  Clock3Icon,
  RefreshCwIcon,
  SparklesIcon,
} from "lucide-react";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAttentionBriefingPanel } from "@/hooks/attention/use-attention-briefing-panel";
import { briefingStatus, type BriefingStatus } from "@/lib/attention/briefing-state";
import type { AttentionItem, AttentionResult, AttentionUrgency } from "@/lib/attention/client";
import { EASE_OUT, SPRING_LAYOUT, SPRING_PRESS } from "@/lib/ease";
import { cn } from "@/lib/utils";

const URGENCY: Record<AttentionUrgency, { label: string; dot: string; text: string }> = {
  now: { label: "Jetzt", dot: "bg-destructive", text: "text-destructive" },
  today: { label: "Heute", dot: "bg-warning", text: "text-warning" },
  soon: { label: "Bald", dot: "bg-muted-foreground", text: "text-muted-foreground" },
};

const LIST: Variants = { show: { transition: { staggerChildren: 0.035 } } };
const MotionButton = motion.create(Button);

export type AttentionBriefingProps = {
  configured: boolean;
  result: AttentionResult | null;
  error: Error | null;
  loading: boolean;
  analyzing: boolean;
  canRun: boolean;
  onRun: () => void;
  status?: BriefingStatus;
  now?: number;
};

export function AttentionBriefing({
  configured,
  result,
  error,
  loading,
  analyzing,
  canRun,
  onRun,
  status: suppliedStatus,
  now = Date.now(),
}: AttentionBriefingProps) {
  const reduced = useReducedMotion();
  const status =
    suppliedStatus ??
    briefingStatus({
      enabled: configured,
      hasWebhook: configured,
      loading,
      sending: analyzing,
      pendingRunId: null,
      lastTriggeredAt: null,
      resultRunId: result?.runId ?? null,
      resultCount: result?.items.length ?? 0,
      error: error?.message ?? null,
      unrecognizedResult: false,
      now,
    });
  const panel = useAttentionBriefingPanel(result, status, now);
  const fade = {
    initial: { opacity: 0, y: reduced ? 0 : 6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, transition: { duration: 0.12 } },
  };

  if (status.kind === "unconfigured" || status.kind === "paused") {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <SparklesIcon className="size-4 text-primary" />
        <span>KI-Briefing</span>
        <span className="text-xs">· {status.label}</span>
        <Button variant="ghost" size="sm" className="ml-auto" asChild>
          <Link to="/settings/briefing">
            {status.kind === "paused" ? "Einstellungen" : "Einrichten"}
            <ChevronRightIcon />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <section aria-labelledby="attention-title" className="flex flex-col gap-3 rounded-xl bg-muted/40 px-4 py-3">
        <header className="flex flex-wrap items-center gap-2">
          <SparklesIcon className="size-4 text-primary" />
          <h2 id="attention-title" className="text-sm font-medium">
            KI-Briefing
          </h2>
          <div className="min-w-0 text-xs text-muted-foreground" role="status" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={status.kind}
                {...fade}
                transition={{ duration: 0.18, ease: EASE_OUT }}
                className={cn("inline-flex items-center gap-1.5", panel.problem && "text-warning")}
              >
                {panel.running ? (
                  <Spinner className="size-3" />
                ) : panel.problem ? (
                  <CircleAlertIcon className="size-3.5" />
                ) : result ? (
                  <CheckIcon className="size-3.5 text-success" />
                ) : (
                  <Clock3Icon className="size-3.5" />
                )}
                {status.label}
              </motion.span>
            </AnimatePresence>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Tooltip content={panel.running ? "Analyse läuft. Du kannst weiterarbeiten." : "Briefing aktualisieren"}>
              <MotionButton
                variant="ghost"
                size="icon-sm"
                aria-label="Briefing aktualisieren"
                onClick={onRun}
                disabled={!canRun || analyzing}
                whileTap={reduced ? undefined : { scale: 0.96 }}
                transition={SPRING_PRESS}
              >
                <RefreshCwIcon />
              </MotionButton>
            </Tooltip>
            <Tooltip content="Briefing und Begründungen ansehen">
              <MotionButton
                variant="ghost"
                size="icon-sm"
                aria-label="Briefing und Begründungen ansehen"
                onClick={() => panel.setOpen(true)}
                whileTap={reduced ? undefined : { scale: 0.96 }}
                transition={SPRING_PRESS}
              >
                <ArrowRightIcon />
              </MotionButton>
            </Tooltip>
          </div>
        </header>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={result?.runId ?? status.kind}
            {...fade}
            transition={{ duration: reduced ? 0.15 : 0.42, ease: EASE_OUT }}
            className="flex flex-col gap-2"
          >
            {panel.problem ? (
              <p role="alert" className="text-sm text-muted-foreground">
                {status.message}
              </p>
            ) : result ? (
              <p className="line-clamp-2 text-sm text-muted-foreground">{result.summary}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{status.message}</p>
            )}
            {panel.preview.length > 0 && (
              <motion.ol
                variants={LIST}
                initial="hidden"
                animate="show"
                className="flex flex-col divide-y divide-border/60"
              >
                {panel.preview.map((item) => (
                  <BriefingPreviewRow key={item.key} item={item} reduced={!!reduced} />
                ))}
              </motion.ol>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{panel.updated ? `Stand ${panel.updated}` : "Vorschläge, keine Jira-Änderungen"}</span>
          <Button
            variant="link"
            size="xs"
            className="h-auto px-0 text-muted-foreground"
            onClick={() => panel.setOpen(true)}
          >
            {panel.remaining ? `Alle ${result?.items.length} Vorschläge` : "Warum diese Vorschläge?"}
            <ChevronRightIcon />
          </Button>
        </div>
      </section>

      <Sheet open={panel.open} onOpenChange={panel.setOpen}>
        <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-xl">
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle className="flex items-center gap-2">
              <SparklesIcon className="size-4 text-primary" />
              Dein KI-Briefing
            </SheetTitle>
            <SheetDescription className="pr-4">
              Vorschläge für deinen nächsten Schritt. Du entscheidest, was du in Jira änderst.
            </SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
            <motion.div layout={!reduced} transition={SPRING_LAYOUT} className="flex flex-col gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 text-sm font-medium",
                  panel.problem ? "text-warning" : "text-foreground",
                )}
              >
                {panel.running && <Spinner className="size-3.5" />}
                {status.label}
              </span>
              <p className="text-sm leading-relaxed text-muted-foreground">{status.message}</p>
              {panel.updated && <p className="text-xs text-muted-foreground">Letzter Stand {panel.updated}</p>}
            </motion.div>
            {result && (
              <motion.div
                key={result.runId}
                {...fade}
                transition={{ duration: 0.3, ease: EASE_OUT }}
                className="flex flex-col gap-5"
              >
                <p className="text-base leading-relaxed">{result.summary}</p>
                <motion.ol variants={LIST} initial="hidden" animate="show" className="flex flex-col divide-y">
                  {result.items.map((item) => (
                    <BriefingDetailRow
                      key={item.key}
                      item={item}
                      reduced={!!reduced}
                      onOpenIssue={() => panel.setOpen(false)}
                    />
                  ))}
                </motion.ol>
              </motion.div>
            )}
            <div className="mt-auto flex flex-col gap-2 border-t pt-4 text-xs leading-relaxed text-muted-foreground">
              <p>
                Die Analyse nutzt bis zu 50 zuletzt aktualisierte offene Tickets, die dir zugewiesen sind, die du
                erstellt hast oder beobachtest. Beschreibungen und Kommentare werden als Ausschnitte übermittelt.
              </p>
              <p>
                Das Briefing enthält Empfehlungen. Jira wird dadurch nicht verändert. Nach einem Kontowechsel ist ein
                neues Briefing nötig.
              </p>
              <Button variant="link" size="sm" className="self-start px-0" asChild>
                <Link to="/settings/briefing" onClick={() => panel.setOpen(false)}>
                  KI-Einstellungen
                  <ChevronRightIcon />
                </Link>
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function BriefingPreviewRow({ item, reduced }: { item: AttentionItem; reduced: boolean }) {
  const urgency = URGENCY[item.urgency];
  return (
    <motion.li
      variants={{
        hidden: { opacity: 0, y: reduced ? 0 : 5 },
        show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: EASE_OUT } },
      }}
    >
      <Link
        to="/issue/$key"
        params={{ key: item.key }}
        title={`${item.key}: ${item.title}`}
        className="group flex min-w-0 items-start gap-2.5 rounded-md py-2 outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span title={urgency.label} className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", urgency.dot)}>
          <span className="sr-only">{urgency.label}</span>
        </span>
        <span className="line-clamp-2 min-w-0 flex-1 text-sm">{item.action}</span>
        <span className="shrink-0 pt-0.5 font-mono text-[11px] text-muted-foreground">{item.key}</span>
      </Link>
    </motion.li>
  );
}

function BriefingDetailRow({
  item,
  reduced,
  onOpenIssue,
}: {
  item: AttentionItem;
  reduced: boolean;
  onOpenIssue: () => void;
}) {
  const urgency = URGENCY[item.urgency];
  return (
    <motion.li
      variants={{
        hidden: { opacity: 0, y: reduced ? 0 : 6 },
        show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: EASE_OUT } },
      }}
      className="flex flex-col gap-2 py-4 first:pt-0"
    >
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className={cn("flex items-center gap-1.5 font-medium", urgency.text)}>
          <span className={cn("size-1.5 rounded-full", urgency.dot)} />
          {urgency.label}
        </span>
        <span className="font-mono text-muted-foreground">{item.key}</span>
      </div>
      <Link
        to="/issue/$key"
        params={{ key: item.key }}
        onClick={onOpenIssue}
        className="group flex items-start gap-2 rounded-sm text-sm font-medium outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex-1">{item.action}</span>
        <ArrowRightIcon className="mt-0.5 size-3.5 shrink-0" />
      </Link>
      <p className="text-xs text-muted-foreground">{item.title}</p>
      <p className="text-sm leading-relaxed text-muted-foreground">{item.reason}</p>
      {item.waitingOn && (
        <p className="text-xs text-muted-foreground">
          Wartet auf dich: <span className="font-medium text-foreground">{item.waitingOn}</span>
        </p>
      )}
    </motion.li>
  );
}
