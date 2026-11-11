import { formatDistanceToNowStrict } from "date-fns";
import { de } from "date-fns/locale";
import { useVisibleItems } from "@/hooks/use-visible-items";
import type { JiraWorkIssue } from "@/lib/jira/queries";

export function useDashboardIssues(issues: JiraWorkIssue[], compact = false) {
  const disclosure = useVisibleItems(issues, compact ? 3 : 6);
  return {
    ...disclosure,
    rows: disclosure.visible.map((issue) => ({
      issue,
      updatedLabel: formatDistanceToNowStrict(new Date(issue.fields.updated), { locale: de, addSuffix: true }),
    })),
  };
}
