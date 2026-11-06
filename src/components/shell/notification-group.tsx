import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Tooltip } from "@/components/motion/tooltip";
import { JiraUserAvatar } from "@/components/jira-user-avatar";
import type { NotificationGroup as Group } from "@/hooks/use-notification-feed";
import type { JiraNotification } from "@/lib/jira/notifications";
import { EASE_OUT, SPRING_LAYOUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

type Props = {
  group: Group;
  onOpen: (item: JiraNotification) => void;
  onOpenExternal: (issueKey: string) => void;
  onToggleRead: (group: Group) => void;
};

const timeAgo = (created: number) => formatDistanceToNow(created, { addSuffix: true, locale: de });

function NotificationEvent({ item, muted }: { item: JiraNotification; muted: boolean }) {
  return (
    <div className="min-w-0">
      <p className={cn("text-sm leading-snug", muted ? "text-muted-foreground" : "text-foreground")}>
        <span className="font-medium">{item.actor.displayName}</span> {item.title}
      </p>
      {item.body && (
        <p className="mt-1 line-clamp-2 border-l-2 pl-2 text-xs text-muted-foreground">{item.body}</p>
      )}
      <p className="mt-1 text-[11px] text-muted-foreground/70">{timeAgo(item.created)}</p>
    </div>
  );
}

export function NotificationGroupRow({ group, onOpen, onOpenExternal, onToggleRead }: Props) {
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);
  const older = group.items.slice(1);
  const unread = group.unread > 0;

  return (
    <motion.li
      layout={reduceMotion ? false : "position"}
      initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE_OUT } }}
      exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
      transition={SPRING_LAYOUT}
      className={cn("group relative flex gap-3 px-4 py-3 transition-colors hover:bg-muted", unread && "bg-primary/4")}
    >
      <button
        type="button"
        onClick={() => onOpen(group.latest)}
        aria-label={`${group.issueKey} öffnen`}
        className="absolute inset-0 outline-none focus-visible:bg-muted"
      />
      <JiraUserAvatar user={group.latest.actor} />
      <div className="pointer-events-none relative min-w-0 flex-1">
        <p className="mb-1 truncate text-xs text-muted-foreground">
          <span className="font-mono font-medium text-foreground/80">{group.issueKey}</span> · {group.summary}
        </p>
        <NotificationEvent item={group.latest} muted={!unread} />
        {older.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="pointer-events-auto mt-1.5 inline-flex items-center gap-1 rounded text-xs font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {expanded ? "Weniger anzeigen" : `${older.length} weitere ${older.length === 1 ? "Aktualisierung" : "Aktualisierungen"}`}
            <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.16, ease: EASE_OUT }}>
              <ChevronDown className="size-3" />
            </motion.span>
          </button>
        )}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.ul
              initial={{ opacity: 0, y: reduceMotion ? 0 : -4 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.18, ease: EASE_OUT } }}
              exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
              className="mt-2 flex flex-col gap-2.5 border-t pt-2.5"
            >
              {older.map((item) => (
                <li key={item.id}>
                  <NotificationEvent item={item} muted={item.read} />
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
      <div className="relative flex shrink-0 flex-col items-center gap-1">
        <Tooltip content={unread ? "Als gelesen markieren" : "Als ungelesen markieren"} side="left">
          <button
            type="button"
            onClick={() => onToggleRead(group)}
            aria-label={unread ? "Als gelesen markieren" : "Als ungelesen markieren"}
            className="grid size-6 place-items-center rounded-md outline-none hover:bg-background focus-visible:ring-2 focus-visible:ring-ring"
          >
            <motion.span
              animate={{ scale: unread ? 1 : 0.8, opacity: unread ? 1 : 0.35 }}
              transition={{ duration: 0.16, ease: EASE_OUT }}
              className={cn("size-2 rounded-full", unread ? "bg-primary" : "border border-muted-foreground")}
            />
          </button>
        </Tooltip>
        <Tooltip content="In Jira öffnen" side="left">
          <button
            type="button"
            onClick={() => onOpenExternal(group.issueKey)}
            aria-label="In Jira öffnen"
            className="grid size-6 place-items-center rounded-md text-muted-foreground opacity-0 outline-none transition-opacity hover:bg-background hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
          >
            <ExternalLink className="size-3.5" />
          </button>
        </Tooltip>
      </div>
    </motion.li>
  );
}
