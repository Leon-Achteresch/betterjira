import { useEffect, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useFieldDraftStore } from "@/hooks/use-field-drafts";
import { useWorkspace } from "@/hooks/use-workspace";
import { copyToClipboard } from "@/lib/clipboard";
import { rememberIssue, scopedFieldDraftKeys, togglePinnedIssue } from "@/lib/workspace";
import type { JiraIssueDetail } from "@/lib/jira/queries";
import type { IssueDrawerTab } from "@/components/issue-drawer";

export function useIssueActions(issue: JiraIssueDetail | undefined, siteUrl?: string, initialTab?: IssueDrawerTab) {
  const { id, workspace, update, ready } = useWorkspace();
  const [drawer, setDrawer] = useState(!!initialTab);
  const [tab, setTab] = useState<IssueDrawerTab>(initialTab ?? "details");
  const detailsRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const key = issue?.key;
  const summary = issue?.fields.summary;
  const statusName = issue?.fields.status.name;
  const statusColor = issue?.fields.status.statusCategory.colorName;

  useEffect(() => {
    if (key && summary !== undefined)
      update((current) =>
        rememberIssue(
          current,
          { key, summary },
          { visitedAt: Date.now(), statusName, statusColor },
          scopedFieldDraftKeys(Object.keys(useFieldDraftStore.getState().drafts), id),
        ),
      );
  }, [id, key, summary, statusName, statusColor, update]);

  const url = issue && siteUrl ? `${siteUrl}/browse/${issue.key}` : undefined;

  return {
    drawer,
    setDrawer,
    tab,
    setTab,
    detailsRef,
    menuRef,
    restoreFocus: (event: Event) => {
      event.preventDefault();
      (returnFocus.current ?? detailsRef.current)?.focus({ preventScroll: true });
    },
    ready,
    pinned: workspace.pinned.some((pinned) => pinned.key === key),
    togglePin: () => {
      if (issue)
        update((current) =>
          togglePinnedIssue(current, {
            key: issue.key,
            summary: issue.fields.summary,
          }),
        );
    },
    show: (next: IssueDrawerTab) => {
      returnFocus.current = next === "details" ? detailsRef.current : menuRef.current;
      setTab(next);
      setDrawer(true);
    },
    copyKey: () => {
      if (issue) void copyToClipboard(issue.key, `${issue.key} kopiert`);
    },
    copyLink: () => {
      if (url) void copyToClipboard(url, "Link kopiert");
    },
    openInJira: url ? () => void openUrl(url) : undefined,
  };
}
