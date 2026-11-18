import { useRef, useState, type FormEvent } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useJiraAddWorklog } from "@/hooks/jira/use-issue-mutations";
import { useWorklogEstimate } from "@/hooks/jira/use-worklog-estimate";
import { JiraApiError } from "@/lib/jira/client";
import { issueTimeSummary } from "@/lib/jira/issue-time";
import type { JiraIssueDetail } from "@/lib/jira/queries";
import {
  normalizeDuration,
  validateWorklog,
  type WorklogBooking,
} from "@/lib/jira/worklog";

const localNow = () => format(new Date(), "yyyy-MM-dd'T'HH:mm");
const isRejected = (error: unknown) =>
  error instanceof JiraApiError &&
  [400, 401, 403, 404, 413].includes(error.status);

export function useIssueWorklog(
  issueKey: string,
  issueId: string | undefined,
  fields: JiraIssueDetail["fields"],
) {
  const add = useJiraAddWorklog(issueKey);
  const estimate = useWorklogEstimate(issueKey, issueId);
  const [timeSpent, setTimeSpent] = useState("");
  const [started, setStarted] = useState(localNow);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [unconfirmed, setUnconfirmed] =
    useState<WorklogBooking["remainingEstimate"]>();
  const lastEstimate = useRef<WorklogBooking["remainingEstimate"]>(undefined);
  const submitting = useRef(false);
  const uncertain = !!unconfirmed && estimate.matchesTarget(unconfirmed);
  const busy = add.isPending || uncertain;
  const validation = validateWorklog(timeSpent, started);
  const canSubmit = !!timeSpent.trim() && !!started && !validation && !busy;

  const book = async (explicitEstimate: boolean) => {
    setSubmitted(true);
    const duration = normalizeDuration(timeSpent);
    if (
      !canSubmit ||
      !duration ||
      submitting.current ||
      explicitEstimate !== estimate.selected
    )
      return;

    let dispatched = false;
    const remainingEstimate = explicitEstimate
      ? estimate.confirmed(() => {
          dispatched = true;
        })
      : undefined;
    if (explicitEstimate && !remainingEstimate) return;
    lastEstimate.current = remainingEstimate;
    submitting.current = true;
    try {
      await add.mutateAsync({
        timeSpent: duration,
        started: format(new Date(started), "yyyy-MM-dd'T'HH:mm:ss.SSSxx"),
        ...(comment.trim() && { comment: comment.trim() }),
        ...(remainingEstimate && { remainingEstimate }),
      });
      if (remainingEstimate && !remainingEstimate.scope.isCurrent()) return;
      setTimeSpent("");
      setComment("");
      estimate.clear();
      setStarted(localNow());
      setSubmitted(false);
      toast.success(`${duration} erfasst`);
    } catch (error) {
      if (remainingEstimate && dispatched && !isRejected(error))
        setUnconfirmed(remainingEstimate);
    } finally {
      submitting.current = false;
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!estimate.selected) void book(false);
  };
  const mutationError =
    !lastEstimate.current || lastEstimate.current.scope.isCurrent()
      ? add.error?.message
      : undefined;

  return {
    summary: issueTimeSummary(fields),
    timeSpent,
    setTimeSpent,
    started,
    setStarted,
    comment,
    setComment,
    estimate,
    submit,
    confirmEstimate: () => void book(true),
    pending: add.isPending,
    busy,
    error: uncertain
      ? "Jira hat die Buchung nicht bestätigt. Prüfe die Zeitbuchungen vor einem neuen Versuch."
      : ((submitted || timeSpent.trim() ? validation : undefined) ??
        mutationError),
    canSubmit,
    startNow: () => setStarted(localNow()),
    entries: [...(fields.worklog?.worklogs ?? [])].sort(
      (a, b) => Date.parse(b.started) - Date.parse(a.started),
    ),
  };
}
