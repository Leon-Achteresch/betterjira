import { useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import {
  CopyIcon,
  LinkIcon,
  PinIcon,
  RefreshCwIcon,
  UserRoundCheckIcon,
  CalendarCheckIcon,
  CalendarClockIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { CommandItem } from "@/components/motion/command-palette";
import { useJiraQueryScope } from "@/hooks/jira/use-jira-query-scope";
import { usePersonalPlan } from "@/hooks/use-personal-plan";
import type { JiraQueryScope } from "@/lib/jira/query-scope";
import { useWorkspace } from "@/hooks/use-workspace";
import { useJiraSite, issueQuery } from "@/hooks/jira/use-jira";
import { copyToClipboard } from "@/lib/clipboard";
import { bulkEditIssue } from "@/lib/jira/bulk-edit";
import { jiraErrorText } from "@/lib/jira/field-values";
import { invalidateIssueChange } from "@/lib/jira/mutation-cache";
import {
  jiraQueryScopeMatches,
  jiraRequestScope,
  withJiraQueryScope,
} from "@/lib/jira/query-scope";
import { togglePinnedIssue } from "@/lib/workspace";

export function useIssueCommands(open: boolean): CommandItem[] {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const key =
    /^\/issue\/([A-Za-z][A-Za-z0-9_]*-\d+)$/.exec(pathname)?.[1] ?? "";
  const account = useJiraQueryScope();
  const site = useJiraSite();
  const client = useQueryClient();
  const { workspace, ready, update } = useWorkspace();
  const plan = usePersonalPlan();
  const query = useQuery({
    ...issueQuery(key, account.scope, client),
    enabled: open && !!key && !!account.scope,
    staleTime: 30_000,
  });
  const lock = useRef(false);
  const assign = useMutation({
    mutationFn: (job: { key: string; scope: JiraQueryScope }) =>
      Effect.runPromise(
        withJiraQueryScope(
          client,
          job.scope,
          bulkEditIssue(
            job.key,
            { kind: "assignee", accountId: job.scope.accountId },
            jiraRequestScope(client, job.scope),
          ),
        ),
      ),
    onSuccess: (_result, job) => {
      if (!jiraQueryScopeMatches(client, job.scope)) return;
      invalidateIssueChange(client, job.key, true);
      toast.success(`${job.key} dir zugewiesen`);
    },
    onError: (error, job) => {
      if (jiraQueryScopeMatches(client, job.scope))
        toast.error(jiraErrorText(error));
    },
    onSettled: () => {
      lock.current = false;
    },
  });
  if (!key || !ready || !account.scope) return [];
  const group = `Aktuelles Ticket · ${key}`;
  const pinned = workspace.pinned.some((issue) => issue.key === key);
  const issue = query.data;
  const items: CommandItem[] = [
    {
      id: "current:copy-key",
      label: "Ticketschlüssel kopieren",
      group,
      icon: CopyIcon,
      keywords: [key, "copy"],
      onSelect: () => void copyToClipboard(key, `${key} kopiert`),
    },
    {
      id: "current:refresh",
      label: "Aktuelles Ticket aktualisieren",
      group,
      icon: RefreshCwIcon,
      keywords: [key, "refresh"],
      onSelect: () => invalidateIssueChange(client, key, true),
    },
  ];
  const siteUrl = site.data?.siteUrl;
  if (siteUrl)
    items.push({
      id: "current:copy-link",
      label: "Ticketlink kopieren",
      group,
      icon: LinkIcon,
      keywords: [key, "url"],
      onSelect: () =>
        void copyToClipboard(`${siteUrl}/browse/${key}`, "Link kopiert"),
    });
  if (issue)
    items.push({
      id: "current:pin",
      label: pinned ? "Aktuelles Ticket lösen" : "Aktuelles Ticket anheften",
      group,
      icon: PinIcon,
      keywords: [key, "favorit", "pin"],
      onSelect: () =>
        update((current) =>
          togglePinnedIssue(current, { key, summary: issue.fields.summary }),
        ),
    });
  if (
    issue?.editmeta.fields.assignee?.operations?.includes("set") &&
    !assign.isPending
  )
    items.push({
      id: "current:assign",
      label: "Aktuelles Ticket mir zuweisen",
      group,
      icon: UserRoundCheckIcon,
      keywords: [key, "bearbeiter", "assign"],
      onSelect: () => {
        if (!lock.current && account.scope) {
          lock.current = true;
          assign.mutate({ key, scope: account.scope });
        }
      },
    });
  if (issue && plan.ready) {
    const reference = { key, summary: issue.fields.summary };
    items.push(
      {
        id: "current:today",
        label: "Aktuelles Ticket für heute planen",
        group,
        icon: CalendarCheckIcon,
        keywords: [key, "tagesplan"],
        onSelect: () => plan.assign(reference, "today"),
      },
      {
        id: "current:later",
        label: "Aktuelles Ticket für später planen",
        group,
        icon: CalendarClockIcon,
        keywords: [key, "tagesplan"],
        onSelect: () => plan.assign(reference, "later"),
      },
    );
  }
  return items;
}
