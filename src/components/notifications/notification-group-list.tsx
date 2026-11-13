import { AnimatePresence } from "motion/react";
import { NotificationGroupRow } from "@/components/notifications/notification-group-row";
import type { FeedGroup } from "@/lib/jira/notification-feed";
import type { JiraNotification } from "@/lib/jira/notifications";
import { cn } from "@/lib/utils";
import type { SnoozedIssues } from "@/lib/notifications/snooze";

type Props = {
  groups: FeedGroup<JiraNotification>[];
  onOpen: (item: JiraNotification) => void;
  onOpenExternal: (issueKey: string) => void;
  onToggleRead: (group: FeedGroup<JiraNotification>) => void;
  className?: string;
  snoozed?: SnoozedIssues;
  onSnooze?: (group: FeedGroup<JiraNotification>, until: number) => void;
  onResume?: (group: FeedGroup<JiraNotification>) => void;
};

export function NotificationGroupList({ groups, onOpen, onOpenExternal, onToggleRead, className, snoozed, onSnooze, onResume }: Props) {
  return (
    <ul className={cn("divide-y", className)}>
      <AnimatePresence initial={false}>
        {groups.map((group) => (
          <NotificationGroupRow key={group.issueKey} group={group} onOpen={onOpen} onOpenExternal={onOpenExternal} onToggleRead={onToggleRead} snoozedUntil={snoozed?.[group.issueKey]} onSnooze={onSnooze} onResume={onResume} />
        ))}
      </AnimatePresence>
    </ul>
  );
}
