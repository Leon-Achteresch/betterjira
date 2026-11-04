import { useRef, useState, type FormEvent } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useJiraAddWorklog } from "@/hooks/jira/use-issue-mutations";
import { normalizeDuration, validateWorklog } from "@/lib/jira/worklog";
import type { JiraIssueDetail } from "@/lib/jira/queries";

const localNow = () => format(new Date(), "yyyy-MM-dd'T'HH:mm");

export function useIssueWorklog(
  issueKey: string,
  worklog: JiraIssueDetail["fields"]["worklog"],
) {
  const add = useJiraAddWorklog(issueKey);
  const [timeSpent, setTimeSpent] = useState("");
  const [started, setStarted] = useState(localNow);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const submitting = useRef(false);
  const validation = validateWorklog(timeSpent, started);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    const duration = normalizeDuration(timeSpent);
    if (
      validateWorklog(timeSpent, started) ||
      !duration ||
      submitting.current ||
      add.isPending
    )
      return;
    submitting.current = true;
    try {
      await add.mutateAsync({
        timeSpent: duration,
        started: format(new Date(started), "yyyy-MM-dd'T'HH:mm:ss.SSSxx"),
        ...(comment.trim() && { comment: comment.trim() }),
      });
      setTimeSpent("");
      setComment("");
      setStarted(localNow());
      setSubmitted(false);
      toast.success(`${duration} erfasst`);
    } catch {
      return;
    } finally {
      submitting.current = false;
    }
  };

  return {
    timeSpent,
    setTimeSpent,
    started,
    setStarted,
    comment,
    setComment,
    submit,
    pending: add.isPending,
    error:
      (submitted || timeSpent.trim() ? validation : undefined) ??
      add.error?.message,
    canSubmit: !!timeSpent.trim() && !!started && !add.isPending,
    startNow: () => setStarted(localNow()),
    entries: [...(worklog?.worklogs ?? [])].sort(
      (a, b) => Date.parse(b.started) - Date.parse(a.started),
    ),
  };
}
