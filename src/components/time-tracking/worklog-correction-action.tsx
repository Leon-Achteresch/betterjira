import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { ArrowRightLeftIcon } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { Fade } from "@/components/motion/fade";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorklogCorrection, type WorklogCorrectionContext } from "@/hooks/time-tracking/use-worklog-correction";
import {
  WORKLOG_TARGET_KEY_LIMIT, type WorklogCorrectionSource, type WorklogTarget,
} from "@/lib/time-tracking/worklog-correction";

function CorrectionTarget({ target }: { target: WorklogTarget }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-xs text-muted-foreground">{target.key} · {target.projectKey}</p>
      <p className="wrap-anywhere font-medium">{target.summary}</p>
    </div>
  );
}

function WorklogCorrectionContent({ context, source, label, inputRef }: {
  context: WorklogCorrectionContext;
  source: WorklogCorrectionSource;
  label: string;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const id = useId();
  const state = useWorklogCorrection(context, source);
  const previewFocus = useRef<HTMLElement>(null);
  const previewReady = !!state.preview;
  useEffect(() => {
    if (previewReady) previewFocus.current?.focus();
  }, [previewReady]);
  return (
    <>
      <PopoverTitle className="text-base text-balance">Korrekturvorschau</PopoverTitle>
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="text-xs text-muted-foreground">Quellbuchung</span>
        <span className="font-medium tabular-nums">{label}</span>
      </div>
      <form onSubmit={(event) => { event.preventDefault(); if (state.canFind) state.findTarget(); }} className="flex flex-col gap-1.5">
        <Label htmlFor={id}>Schlüssel des Zielvorgangs</Label>
        <div className="flex min-w-0 gap-2">
          <Input id={id} ref={inputRef} value={state.input} onChange={(event) => state.setInput(event.target.value)}
            className="min-w-0 rounded-xl" autoComplete="off" spellCheck={false} maxLength={WORKLOG_TARGET_KEY_LIMIT} />
          <Button type="submit" size="sm" variant="outline" className="min-h-8 shrink-0"
            disabled={!state.canFind}>Ziel prüfen</Button>
        </div>
      </form>
      <AnimatePresence initial={false}>
        {(state.finding || state.checking) && (
          <Fade key="pending"><Skeleton role="status" aria-label="Jira-Daten werden geprüft" className="h-16 rounded-xl" /></Fade>
        )}
        {state.error && <Fade key="error"><p role="alert" className="text-sm text-destructive">{state.error}</p></Fade>}
        {state.target && !state.preview && (
          <Fade key="target">
            <div className="flex flex-col items-start gap-2 rounded-xl border p-2.5">
              <CorrectionTarget target={state.target} />
              {state.canConfirm && <Button type="button" size="sm" onClick={state.confirmTarget}>Ziel bestätigen</Button>}
            </div>
          </Fade>
        )}
        {state.preview && (
          <Fade key="preview">
            <section ref={previewFocus} tabIndex={-1} aria-label="Geprüfte Korrekturwerte" className="flex flex-col gap-2 rounded-xl border p-2.5">
              <CorrectionTarget target={state.preview.target} />
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 border-t pt-2 text-xs">
                <dt className="text-muted-foreground">Dauer</dt>
                <dd className="tabular-nums">{state.preview.duration} ({state.preview.seconds} s)</dd>
                <dt className="text-muted-foreground">Beginn</dt>
                <dd className="tabular-nums wrap-anywhere"><time dateTime={state.preview.started.replace(/([+-]\d{2})(\d{2})$/, "$1:$2")}>{state.preview.started}</time></dd>
                <dt className="text-muted-foreground">Kommentar</dt>
                <dd className="max-h-28 overflow-y-auto whitespace-pre-wrap wrap-anywhere">
                  {state.preview.comment.kind === "text" ? state.preview.comment.text
                    : state.preview.comment.kind === "empty" ? "Kein Kommentar"
                    : "Formatierte oder unbekannte Inhalte erfordern eine separate Prüfung."}
                </dd>
              </dl>
            </section>
          </Fade>
        )}
      </AnimatePresence>
      <p className="text-xs text-muted-foreground">Diese Vorschau ändert keine Zeitbuchungen in Jira.</p>
    </>
  );
}

export function WorklogCorrectionAction({ context, source, time, duration }: {
  context: WorklogCorrectionContext;
  source: WorklogCorrectionSource;
  time: string;
  duration: string;
}) {
  const [openedWorklog, setOpenedWorklog] = useState<WorklogCorrectionSource["worklog"]>();
  const open = openedWorklog === source.worklog;
  const input = useRef<HTMLInputElement>(null);
  return (
    <Popover open={open} onOpenChange={(value) => setOpenedWorklog(value ? source.worklog : undefined)}>
      <Tooltip content="Korrekturvorschau">
        <PopoverTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" className="size-8"
            aria-label={`Korrekturvorschau für ${source.issueKey} um ${time}`}>
            <ArrowRightLeftIcon />
          </Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent align="end" collisionPadding={12} aria-label="Korrekturvorschau"
        className="w-[min(25rem,calc(100vw-1.5rem))] p-3"
        onOpenAutoFocus={(event) => { if (input.current) { event.preventDefault(); input.current.focus(); } }}>
        {open && <WorklogCorrectionContent context={context} source={source} label={`${source.issueKey} · ${time} · ${duration}`} inputRef={input} />}
      </PopoverContent>
    </Popover>
  );
}
