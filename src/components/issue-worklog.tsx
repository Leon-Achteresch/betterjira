import { AdfContent } from "@/components/adf-content";
import { JiraUserLabel } from "@/components/jira-user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useIssueWorklog } from "@/hooks/use-issue-worklog";
import { EASE_OUT } from "@/lib/ease";
import { WORKLOG_PRESETS } from "@/lib/jira/worklog";
import type { JiraIssueDetail } from "@/lib/jira/queries";

type Fields = JiraIssueDetail["fields"];

export function IssueWorklog({
  issueKey,
  timetracking,
  worklog,
}: {
  issueKey: string;
  timetracking: Fields["timetracking"];
  worklog: Fields["worklog"];
}) {
  const editor = useIssueWorklog(issueKey, worklog);
  const reduce = useReducedMotion();

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-3 gap-3 text-sm">
        {(
          [
            ["Geschätzt", timetracking?.originalEstimate],
            ["Erfasst", timetracking?.timeSpent],
            ["Verbleibend", timetracking?.remainingEstimate],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-lg bg-muted/50 px-3 py-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-medium tabular-nums">{value ?? "–"}</dd>
          </div>
        ))}
      </dl>

      <form onSubmit={editor.submit} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted-foreground">
            Dauer wählen
          </span>
          {WORKLOG_PRESETS.map((duration) => (
            <Button
              key={duration}
              type="button"
              variant={editor.timeSpent === duration ? "secondary" : "outline"}
              size="xs"
              disabled={editor.pending}
              aria-pressed={editor.timeSpent === duration}
              onClick={() => editor.setTimeSpent(duration)}
            >
              {duration}
            </Button>
          ))}
        </div>
        <fieldset
          disabled={editor.pending}
          className="flex flex-wrap items-end gap-2"
        >
          <Input
            aria-label="Dauer"
            placeholder="Dauer, z. B. 1h 30m"
            value={editor.timeSpent}
            onChange={(event) => editor.setTimeSpent(event.target.value)}
            className="w-full sm:w-40"
          />
          <Input
            aria-label="Beginn"
            type="datetime-local"
            value={editor.started}
            onChange={(event) => editor.setStarted(event.target.value)}
            className="w-full sm:w-52"
          />
          <Input
            aria-label="Beschreibung"
            placeholder="Was hast du gemacht? (optional)"
            value={editor.comment}
            onChange={(event) => editor.setComment(event.target.value)}
            className="min-w-48 flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={editor.startNow}
          >
            Beginn jetzt
          </Button>
          <Button type="submit" size="sm" disabled={!editor.canSubmit}>
            {editor.pending && <Spinner />}
            Zeit erfassen
          </Button>
        </fieldset>
      </form>
      <AnimatePresence initial={false}>
        {editor.error && (
          <motion.p
            key="error"
            role="alert"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15, ease: EASE_OUT }}
            className="text-sm text-destructive"
          >
            {editor.error}
          </motion.p>
        )}
      </AnimatePresence>

      {editor.entries.length > 0 && (
        <ol className="flex flex-col divide-y">
          {editor.entries.map((entry) => (
            <motion.li
              initial={{ opacity: 0, y: reduce ? 0 : 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: EASE_OUT }}
              key={entry.id}
              className="flex flex-col gap-1 py-2 text-sm"
            >
              <div className="flex items-center gap-3">
                <JiraUserLabel user={entry.author} />
                <span className="font-medium tabular-nums">
                  {entry.timeSpent}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(entry.started).toLocaleString("de-DE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </div>
              {entry.comment != null && (
                <AdfContent
                  doc={entry.comment}
                  className="pl-8 text-muted-foreground"
                />
              )}
            </motion.li>
          ))}
        </ol>
      )}
      {worklog && worklog.total > worklog.worklogs.length && (
        <p className="text-xs text-muted-foreground">
          {worklog.worklogs.length} von {worklog.total} Einträgen angezeigt.
        </p>
      )}
    </div>
  );
}
