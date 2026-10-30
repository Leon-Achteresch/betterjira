import { useState, type FormEvent } from "react";
import { format } from "date-fns";
import { AdfContent } from "@/components/adf-content";
import { JiraUserLabel } from "@/components/jira-user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useJiraAddWorklog } from "@/lib/jira/issue";
import type { JiraIssueDetail } from "@/lib/jira/queries";

type Fields = JiraIssueDetail["fields"];

const now = () => format(new Date(), "yyyy-MM-dd'T'HH:mm");

export function IssueWorklog({
  issueKey,
  timetracking,
  worklog,
}: {
  issueKey: string;
  timetracking: Fields["timetracking"];
  worklog: Fields["worklog"];
}) {
  const add = useJiraAddWorklog(issueKey);
  const [timeSpent, setTimeSpent] = useState("");
  const [started, setStarted] = useState(now);
  const [comment, setComment] = useState("");
  const entries = [...(worklog?.worklogs ?? [])].reverse();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!timeSpent.trim() || !started) return;
    add.mutate(
      {
        timeSpent: timeSpent.trim(),
        started: format(new Date(started), "yyyy-MM-dd'T'HH:mm:ss.SSSxx"),
        ...(comment.trim() && { comment: comment.trim() }),
      },
      {
        onSuccess: () => {
          setTimeSpent("");
          setComment("");
          setStarted(now());
        },
      },
    );
  };

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

      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <Input
          aria-label="Dauer"
          placeholder="Dauer, z. B. 1h 30m"
          value={timeSpent}
          onChange={(event) => setTimeSpent(event.target.value)}
          className="w-40"
        />
        <Input
          aria-label="Beginn"
          type="datetime-local"
          value={started}
          onChange={(event) => setStarted(event.target.value)}
          className="w-52"
        />
        <Input
          aria-label="Beschreibung"
          placeholder="Was hast du gemacht? (optional)"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          className="min-w-48 flex-1"
        />
        <Button type="submit" size="sm" disabled={!timeSpent.trim() || !started || add.isPending}>
          {add.isPending && <Spinner />}
          Zeit erfassen
        </Button>
      </form>
      {add.error && (
        <p role="alert" className="text-sm text-destructive">
          {add.error.message}
        </p>
      )}

      {entries.length > 0 && (
        <ol className="flex flex-col divide-y">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-col gap-1 py-2 text-sm">
              <div className="flex items-center gap-3">
                <JiraUserLabel user={entry.author} />
                <span className="font-medium tabular-nums">{entry.timeSpent}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(entry.started).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}
                </span>
              </div>
              {entry.comment != null && <AdfContent doc={entry.comment} className="pl-8 text-muted-foreground" />}
            </li>
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
