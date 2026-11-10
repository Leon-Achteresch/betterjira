import { AnimatePresence } from "motion/react";
import { NotificationGroupRow } from "@/components/notifications/notification-group-row";
import type { FeedGroup } from "@/lib/jira/notification-feed";
import type { JiraNotification } from "@/lib/jira/notifications";
import { cn } from "@/lib/utils";

type Props = {
  groups: FeedGroup<JiraNotification>[];
  onOpen: (item: JiraNotification) => void;
  onOpenExternal: (issueKey: string) => void;
  onToggleRead: (group: FeedGroup<JiraNotification>) => void;
  className?: string;
};

export function NotificationGroupList({ groups, onOpen, onOpenExternal, onToggleRead, className }: Props) {
  return (
    <ul className={cn("divide-y", className)}>
      <AnimatePresence initial={false}>
        {groups.map((group) => (
          <NotificationGroupRow key={group.issueKey} group={group} onOpen={onOpen} onOpenExternal={onOpenExternal} onToggleRead={onToggleRead} />
        ))}
      </AnimatePresence>
    </ul>
  );
}
