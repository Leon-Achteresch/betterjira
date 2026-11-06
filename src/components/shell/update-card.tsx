import { useEffect } from "react";
import { Check, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { SPRING_CARD, SPRING_LAYOUT } from "@/lib/ease";

type UpdateInfo = {
  version: string;
  currentVersion: string | null;
  published: string | null;
  highlights: string[];
};

type UpdateCardProps = {
  update: UpdateInfo | null;
  percent: number | null;
  failed: boolean;
  onInstall: () => void;
  onDismiss: () => void;
  onSkip: () => void;
  onReleaseNotes: () => void;
};

export function UpdateCard({ update, percent, failed, onInstall, onDismiss, onSkip, onReleaseNotes }: UpdateCardProps) {
  const reduce = useReducedMotion();
  const busy = percent !== null;

  useEffect(() => {
    if (!update || busy) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [update, busy, onDismiss]);

  return (
    <AnimatePresence>
      {update ? (
        <motion.div
          layout
          role="region"
          aria-label={`Version ${update.version} ist verfügbar`}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8, transition: { duration: 0.16 } }}
          transition={{ ...SPRING_CARD, layout: SPRING_LAYOUT }}
          className="fixed right-4 bottom-4 z-[200] w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[26px] border border-border/80 bg-card text-card-foreground shadow-2xl backdrop-blur-xl"
        >
          <div className="relative flex h-36 w-full select-none items-center justify-center overflow-hidden bg-gradient-to-br from-primary/90 via-primary to-chart-2">
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/15" />
            <img src="/logo.svg" alt="" className="relative z-10 size-12 drop-shadow-lg" />
            <button
              type="button"
              onClick={onDismiss}
              disabled={busy}
              aria-label="Schließen"
              className="absolute right-3 top-3 z-20 flex size-7 items-center justify-center rounded-full bg-black/40 text-white/90 backdrop-blur-md transition-colors hover:bg-black/60 hover:text-white disabled:pointer-events-none disabled:opacity-0"
            >
              <X className="size-4 stroke-[2.5]" />
            </button>
          </div>

          <div className="space-y-3.5 p-5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight">betterjira v{update.version}</h2>
                <span className="rounded-full border border-primary/25 bg-primary/15 px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider text-primary">
                  Neu
                </span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">Eine neue Version steht bereit.</p>
            </div>

            {update.highlights.length > 0 ? (
              <div className="space-y-2">
                {update.highlights.map((item, index) => (
                  <motion.div
                    key={item}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...SPRING_CARD, delay: 0.08 + index * 0.03 }}
                    className="flex items-start gap-2.5 text-xs leading-snug text-foreground/90"
                  >
                    <Check className="mt-0.5 size-3.5 shrink-0 stroke-[2.5] text-primary" />
                    <span>{item}</span>
                  </motion.div>
                ))}
              </div>
            ) : null}

            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold tracking-tight">v{update.version}</span>
              {update.currentVersion ? (
                <span className="text-xs text-muted-foreground line-through">v{update.currentVersion}</span>
              ) : null}
              <span className="text-[0.6875rem] text-muted-foreground">
                {update.published ? `• ${update.published}` : "• Bereit zur Installation"}
              </span>
            </div>

            <AnimatePresence initial={false}>
              {busy ? (
                <motion.div
                  key="progress"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2 rounded-2xl border border-border/70 bg-muted/40 p-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">Update wird installiert</span>
                    <span className="font-mono text-muted-foreground">{percent}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className="h-full origin-left rounded-full bg-primary"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: percent / 100 }}
                      transition={SPRING_LAYOUT}
                    />
                  </div>
                </motion.div>
              ) : null}
              {failed && !busy ? (
                <motion.p
                  key="failed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
                >
                  Update konnte nicht installiert werden. Bitte erneut versuchen.
                </motion.p>
              ) : null}
            </AnimatePresence>

            <Button type="button" size="lg" className="h-11 w-full rounded-2xl" disabled={busy} onClick={onInstall}>
              {busy ? `Installiert … ${percent}%` : "Jetzt installieren"}
            </Button>

            <button
              type="button"
              onClick={onReleaseNotes}
              className="block w-full text-center text-xs font-medium text-muted-foreground underline-offset-3 hover:text-foreground hover:underline"
            >
              Alle Release Notes
            </button>

            {busy ? null : (
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={onDismiss}
                  className="py-0.5 text-center text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Später
                </button>
                <button
                  type="button"
                  onClick={onSkip}
                  className="py-0.5 text-center text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Diese Version überspringen
                </button>
              </div>
            )}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
