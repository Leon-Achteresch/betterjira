import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { NotificationGroupList } from "@/components/notifications/notification-group-list";
import { Button } from "@/components/ui/button";
import type { FeedGroup } from "@/lib/jira/notification-feed";
import type { JiraNotification } from "@/lib/jira/notifications";
import { EASE_OUT } from "@/lib/ease";

const VISIBLE_GROUPS = 7;

type Props = {
  id: string;
  label: string;
  groups: FeedGroup<JiraNotification>[];
  onOpen: (item: JiraNotification) => void;
  onOpenExternal: (issueKey: string) => void;
  onToggleRead: (group: FeedGroup<JiraNotification>) => void;
};

export function NotificationSection({ id, label, groups, ...actions }: Props) {
  const reduce = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const hidden = groups.length - VISIBLE_GROUPS;
  const shown = expanded || hidden <= 0 ? groups : groups.slice(0, VISIBLE_GROUPS);
  const unread = groups.reduce((count, group) => count + group.unread, 0);
  const headingId = `notification-section-${id}`;

  return (
    <section aria-labelledby={headingId} className="overflow-hidden rounded-2xl border bg-card shadow-xs">
      <header className="flex items-baseline justify-between gap-3 border-b px-4 py-2.5">
        <h2 id={headingId} className="text-sm font-semibold text-balance">
          {label}
        </h2>
        <p className="text-xs text-muted-foreground tabular-nums">
          {groups.length} {groups.length === 1 ? "Ticket" : "Tickets"}
          {unread > 0 && ` · ${unread} ungelesen`}
        </p>
      </header>
      <NotificationGroupList groups={shown} {...actions} />
      {hidden > 0 && (
        <div className="border-t p-1.5">
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={expanded}
            className="h-8 w-full rounded-xl text-muted-foreground"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Weniger anzeigen" : `${hidden} weitere ${hidden === 1 ? "Ticket" : "Tickets"} anzeigen`}
            <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={reduce ? { duration: 0 } : { duration: 0.16, ease: EASE_OUT }}>
              <ChevronDown />
            </motion.span>
          </Button>
        </div>
      )}
    </section>
  );
}
