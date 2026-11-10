import { useRef, useState, type FormEvent } from "react";
import type { LinkedIssue } from "@/lib/calendar/model";
import {
  emptyRolloutForm,
  rolloutDraft,
  rolloutForm,
  shiftEnd,
  toggleIssue,
  validateRolloutForm,
  opensInternally,
  type RolloutForm,
} from "@/lib/calendar/presentation";
import { rolloutTemplateForm } from "@/lib/calendar/rollout-template";
import { useJiraSite } from "@/lib/jira/queries";
import type { RolloutFormTarget } from "@/types/calendar";
import { useRolloutIssueSearch } from "./use-rollout-issue-search";
import { useSaveRollout } from "./use-rollouts";

export const useRolloutForm = (target: RolloutFormTarget, onSaved: () => void) => {
  const site = useJiraSite();
  const save = useSaveRollout();
  const rollout = "rollout" in target ? target.rollout : null;
  const template = "template" in target ? target.template : null;
  const day = "day" in target ? target.day : new Date();
  const [form, setForm] = useState<RolloutForm>(() =>
    rollout ? rolloutForm(rollout) : template ? rolloutTemplateForm(template) : emptyRolloutForm(day, new Date()),
  );
  const [submitted, setSubmitted] = useState(false);
  const [issueQuery, setIssueQuery] = useState("");
  const submitting = useRef(false);
  const siteUrl = (rollout ?? template)?.siteUrl || site.data?.siteUrl || "";
  const canLinkIssues = !!site.data && opensInternally(siteUrl, site.data.siteUrl);
  const issueSearch = useRolloutIssueSearch(site.data?.siteUrl, issueQuery, canLinkIssues);
  const errors = validateRolloutForm(form);

  const update = (patch: Partial<RolloutForm>) => setForm((current) => ({ ...current, ...patch }));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    const draft = rolloutDraft(form, siteUrl);
    if (!draft || submitting.current) return;
    submitting.current = true;
    save.mutate(
      { draft, id: rollout?.id },
      {
        onSuccess: onSaved,
        onError: () => {
          submitting.current = false;
        },
      },
    );
  };

  return {
    editing: !!rollout,
    duplicating: !!template,
    linkedToOutlook: !!rollout?.outlookEventId,
    form,
    errors: submitted ? errors : {},
    pending: save.isPending,
    saveError: save.error,
    update,
    setStart: (startDate: string, startTime: string) => setForm((current) => shiftEnd(current, startDate, startTime)),
    toggleIssue: (issue: LinkedIssue) => setForm((current) => ({ ...current, issues: toggleIssue(current.issues, issue) })),
    submit,
    issuePicker: {
      available: canLinkIssues,
      unavailableReason: site.data && !canLinkIssues
        ? "Dieser Rollout gehört zu einer anderen Jira-Site. Verbinde die ursprüngliche Site, um weitere Tickets zu verknüpfen."
        : "Melde dich bei Jira an, um Tickets zu suchen und zu verknüpfen.",
      checking: site.isPending,
      query: issueQuery,
      setQuery: setIssueQuery,
      results: issueSearch.data ?? [],
      searching: issueSearch.isFetching,
      error: issueSearch.error,
    },
  };
};

export type RolloutFormState = ReturnType<typeof useRolloutForm>;
