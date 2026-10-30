import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { AnimatePresence, motion } from "motion/react";
import { Bell, CheckCheck } from "lucide-react";
import { useRef } from "react";
import { MorphPopover, MorphPopoverContent, MorphPopoverTrigger } from "@/components/motion/popover-morph";
import { Tooltip } from "@/components/motion/tooltip";
import { JiraUserAvatar } from "@/components/jira-user-avatar";
import { Button } from "@/components/ui/button";
import { openNotification, selectUnread, useNotifications } from "@/lib/jira/notifications";
import { useJiraSite } from "@/lib/jira/queries";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const site = useJiraSite();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const items = useNotifications((state) => state.items);
  const unread = useNotifications(selectUnread);
  const markAllRead = useNotifications((state) => state.markAllRead);
  if (!site.data) return null;
  const siteUrl = site.data.siteUrl;

  return (
    <MorphPopover>
      <Tooltip content="Benachrichtigungen" side="bottom" anchorRef={triggerRef} />
      <MorphPopoverTrigger>
        <button
          ref={triggerRef}
          type="button"
          aria-label={unread ? `Benachrichtigungen, ${unread} ungelesen` : "Benachrichtigungen"}
          className="relative inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-expanded:bg-primary/12 aria-expanded:text-foreground"
        >
          <Bell className="size-4" strokeWidth={1.75} />
          <AnimatePresence>
            {unread > 0 && (
              <motion.span
                key="badge"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={{ type: "spring", duration: 0.3, bounce: 0.3 }}
                className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold tabular-nums leading-none text-primary-foreground ring-2 ring-sidebar"
              >
                {unread > 99 ? "99+" : unread}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </MorphPopoverTrigger>
      <MorphPopoverContent align="end" className="w-96 max-w-[calc(100vw-1.5rem)] overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Benachrichtigungen</h2>
          <Button variant="ghost" size="sm" disabled={unread === 0} onClick={markAllRead}>
            <CheckCheck />
            Alle gelesen
          </Button>
        </div>
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-sm text-muted-foreground">
            <Bell className="size-6 opacity-50" strokeWidth={1.5} />
            Keine Benachrichtigungen. Änderungen an deinen Tickets erscheinen hier live.
          </div>
        ) : (
          <ul className="max-h-[min(28rem,70vh)] overflow-y-auto overscroll-contain py-1">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => openNotification(siteUrl, item)}
                  className="flex w-full gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <JiraUserAvatar user={item.actor} />
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm", item.read ? "text-muted-foreground" : "text-foreground")}>
                      <span className="font-medium">{item.actor.displayName}</span> {item.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/80">{item.issueKey}</span> · {item.body || item.summary}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                      {formatDistanceToNow(item.created, { addSuffix: true, locale: de })}
                    </p>
                  </div>
                  {!item.read && <span aria-label="ungelesen" className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
                </button>
              </li>
            ))}
          </ul>
        )}
      </MorphPopoverContent>
    </MorphPopover>
  );
}
