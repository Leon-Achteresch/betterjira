import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Bell, CheckCheck } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { openUrl } from "@tauri-apps/plugin-opener";
import { MorphPopover, MorphPopoverContent, MorphPopoverTrigger } from "@/components/motion/popover-morph";
import { Tooltip } from "@/components/motion/tooltip";
import { NotificationGroupList } from "@/components/notifications/notification-group-list";
import { UnreadCount } from "@/components/notifications/unread-count";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNotificationFeed } from "@/hooks/notifications/use-notification-feed";
import { openNotification, useOwnedUnreadCount } from "@/hooks/notifications/use-notification-store";
import type { NotificationKind } from "@/lib/jira/notification-feed";
import { issueSearch } from "@/lib/jira/issue-link";
import { useJiraSite } from "@/lib/jira/queries";
import { EASE_OUT } from "@/lib/ease";

const EMPTY_TEXT: Record<NotificationKind, string> = {
  direct: "Keine direkten Benachrichtigungen. Erwähnungen, Zuweisungen und Änderungen an deinen Tickets erscheinen hier.",
  watching: "Keine Benachrichtigungen zu beobachteten Tickets.",
};

export function NotificationBell() {
  const site = useJiraSite();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const unread = useOwnedUnreadCount();
  const feed = useNotificationFeed();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  if (!site.data) return null;
  const { siteUrl } = site.data;
  const openIssue = (key: string, commentId?: string) => {
    setOpen(false);
    void navigate({ to: "/issue/$key", params: { key }, search: issueSearch(commentId) });
  };
  const openExternal = (key: string) => void openUrl(`${siteUrl}/browse/${key}`);
  const openInbox = () => {
    setOpen(false);
    void navigate({ to: "/benachrichtigungen", search: feed.kind === "watching" ? { ansicht: "beobachtet" } : {} });
  };

  return (
    <MorphPopover open={open} onOpenChange={setOpen}>
      <Tooltip content="Benachrichtigungen" side="bottom" anchorRef={triggerRef} />
      <MorphPopoverTrigger>
        <button
          ref={triggerRef}
          type="button"
          aria-label={unread ? `Benachrichtigungen, ${unread} ungelesen` : "Benachrichtigungen"}
          className="relative inline-flex size-8 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-expanded:bg-primary/12 aria-expanded:text-foreground"
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
      <MorphPopoverContent align="end" className="w-[26rem] max-w-[calc(100vw-1.5rem)] overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 pt-3">
          <h2 className="text-sm font-semibold">Benachrichtigungen</h2>
          <div className="flex items-center gap-1">
            <label className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
              Nur ungelesene
              <Switch size="sm" checked={feed.unreadOnly} onCheckedChange={feed.setUnreadOnly} />
            </label>
            <Tooltip content="Alle in Direkt und Beobachtet als gelesen markieren" side="bottom">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Alle in Direkt und Beobachtet als gelesen markieren"
                disabled={!feed.hasUnread}
                onClick={feed.markAllRead}
              >
                <CheckCheck />
              </Button>
            </Tooltip>
          </div>
        </div>
        <Tabs value={feed.kind} onValueChange={(value) => feed.setKind(value as NotificationKind)} className="border-b px-3 pt-2">
          <TabsList variant="line">
            <TabsTrigger value="direct">
              Direkt
              <UnreadCount value={feed.unreadByKind.direct} />
            </TabsTrigger>
            <TabsTrigger value="watching">
              Beobachtet
              <UnreadCount value={feed.unreadByKind.watching} />
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${feed.kind}-${feed.unreadOnly}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.16, ease: EASE_OUT } }}
            exit={{ opacity: 0, transition: { duration: 0.1, ease: EASE_OUT } }}
          >
            {feed.groups.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-sm text-muted-foreground">
                <Bell className="size-6 opacity-50" strokeWidth={1.5} />
                {feed.unreadOnly ? "Du hast alles gelesen." : EMPTY_TEXT[feed.kind]}
              </div>
            ) : (
              <NotificationGroupList
                groups={feed.groups}
                onOpen={(item) => openNotification(item, openIssue)}
                onOpenExternal={openExternal}
                onToggleRead={feed.toggleGroupRead}
                className="max-h-[min(30rem,70vh)] overflow-y-auto overscroll-contain"
              />
            )}
          </motion.div>
        </AnimatePresence>
        <div className="border-t p-1.5">
          <Button variant="ghost" size="sm" className="h-8 w-full justify-between rounded-xl text-muted-foreground" onClick={openInbox}>
            Alle Benachrichtigungen anzeigen
            <ArrowRight />
          </Button>
        </div>
      </MorphPopoverContent>
    </MorphPopover>
  );
}
