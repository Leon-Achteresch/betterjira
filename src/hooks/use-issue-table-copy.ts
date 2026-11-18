import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLatestRef } from "./use-latest-ref";
import { copyToClipboard } from "@/lib/clipboard";
import { jiraQueryScopeMatches, type JiraQueryScope } from "@/lib/jira/query-scope";
import type { SearchIssue } from "@/lib/jira/search";
import { fieldText } from "@/lib/jira/field-text";
import { KEY_COLUMN } from "@/lib/jira/issue-view";
import { toMarkdown, toTsv } from "@/lib/table-export";

export type ExportFormat = "tsv" | "markdown" | "keys" | "jql";
export function useIssueTableCopy(input: {
  context: string; scope: JiraQueryScope | undefined; ready: boolean; jql: string;
  issues: readonly SearchIssue[]; selected: readonly SearchIssue[]; columns: readonly { id: string; label: string }[];
}) {
  const client = useQueryClient();
  const [identity, setIdentity] = useState({ context: input.context, token: Symbol() });
  const current = identity.context === input.context ? identity : { context: input.context, token: Symbol() };
  if (current !== identity) setIdentity(current);
  const latest = useLatestRef(current);
  return async (format: ExportFormat, selectedOnly = false) => {
    if (latest.current.token !== current.token) return;
    if (format === "jql") return copyToClipboard(input.jql, "JQL kopiert");
    if (!input.ready || !jiraQueryScopeMatches(client, input.scope)) return;
    const issues = selectedOnly ? input.selected : input.issues;
    if (format === "keys") return copyToClipboard(issues.map((issue) => issue.key).join(", "), `${issues.length} Schlüssel kopiert`);
    const header = input.columns.map((column) => column.label);
    const rows = issues.map((issue) => input.columns.map((column) => column.id === KEY_COLUMN ? issue.key : fieldText(issue.fields[column.id])));
    return copyToClipboard(format === "tsv" ? toTsv(header, rows) : toMarkdown(header, rows), `${issues.length} Zeilen kopiert`);
  };
}
