import { format, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlarmClockIcon, BellIcon, CheckCheck, RefreshCwIcon, SearchXIcon } from "lucide-react";
import type { ReactNode } from "react";
import { SearchField } from "@/components/motion/search-field";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Tooltip } from "@/components/motion/tooltip";
import { NotificationSection } from "@/components/notifications/notification-section";
import { UnreadCount } from "@/components/notifications/unread-count";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { KIND_LABELS, type FeedGroup, type FeedSection, type NotificationKind } from "@/lib/jira/notification-feed";
import type { JiraNotification } from "@/lib/jira/notifications";
import type { NotificationSyncPhase } from "@/lib/jira/notification-sync";
import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";
import type { SnoozedIssues } from "@/lib/notifications/snooze";

type Props = {
  kind: NotificationKind;
  unreadOnly: boolean;
  query: string;
  hasItems: boolean;
  checkedAt: number | null;
  sync: { phase: NotificationSyncPhase; failed: boolean; errorMessage: string; checking: boolean; retry: () => void };
  unreadByKind: Record<NotificationKind, number>;
  sections: FeedSection<JiraNotification>[];
  scopeUnread: number;
  markScopeReadLabel: string;
  setKind: (kind: NotificationKind) => void;
  setUnreadOnly: (unreadOnly: boolean) => void;
  setQuery: (query: string) => void;
  markScopeRead: () => void;
  toggleGroupRead: (group: FeedGroup<JiraNotification>) => void;
  openItem: (item: JiraNotification) => void;
  openExternal: (issueKey: string) => void;
  showSnoozed: boolean;
  snoozedCount: number;
  snoozed: SnoozedIssues;
  setShowSnoozed: (show: boolean) => void;
  snoozeGroup: (group: FeedGroup<JiraNotification>, until: number) => void;
  resumeGroup: (group: FeedGroup<JiraNotification>) => void;
};

const SYNC_STATUS: Record<NotificationSyncPhase, string> = {
  ready: "",
  checking: "Prüft auf neue Aktivität …",
  offline: "Offline, Prüfung wartet auf Verbindung",
  unavailable: "Keine aktive Jira-Sitzung",
};

const EMPTY_KIND: Record<NotificationKind, string> = {
  direct: "Erwähnungen, Zuweisungen und Änderungen an deinen Tickets erscheinen hier, sobald BetterJira sie erfasst.",
  watching: "Änderungen an Tickets, die du beobachtest, erscheinen hier, sobald BetterJira sie erfasst.",
};

function InboxEmpty({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <Empty className="rounded-2xl border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}

function InboxContent(props: Props) {
  if (!props.hasItems)
    return (
      <InboxEmpty
        icon={<BellIcon />}
        title="Noch keine Aktivität erfasst"
        description="BetterJira prüft deine Tickets, solange die App geöffnet ist. Neue Aktivität ab jetzt erscheint hier, frühere findest du in Jira."
      />
    );
  if (props.sections.length > 0)
    return (
      <Stagger className="flex flex-col gap-4">
        {props.sections.map((section) => (
          <StaggerItem key={section.id}>
            <NotificationSection
              id={section.id}
              label={section.label}
              groups={section.groups}
              onOpen={props.openItem}
              onOpenExternal={props.openExternal}
              onToggleRead={props.toggleGroupRead}
              snoozed={props.snoozed}
              onSnooze={props.snoozeGroup}
              onResume={props.resumeGroup}
            />
          </StaggerItem>
        ))}
      </Stagger>
    );
  if (props.query)
    return (
      <InboxEmpty
        icon={<SearchXIcon />}
        title="Keine Treffer"
        description={`Keine lokal erfasste Aktivität in „${KIND_LABELS[props.kind]}“ passt zu „${props.query}“.`}
        action={
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => props.setQuery("")}>
            Suche zurücksetzen
          </Button>
        }
      />
    );
  if (props.unreadOnly)
    return (
      <InboxEmpty
        icon={<CheckCheck />}
        title="Alles gelesen"
        description={`In „${KIND_LABELS[props.kind]}“ ist nichts mehr ungelesen.`}
        action={
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => props.setUnreadOnly(false)}>
            Alle anzeigen
          </Button>
        }
      />
    );
  if (props.showSnoozed)
    return <InboxEmpty icon={<AlarmClockIcon />} title="Nichts zurückgestellt" description={`In „${KIND_LABELS[props.kind]}“ sind keine Benachrichtigungen zurückgestellt. Wähle am Ticket einen Zeitpunkt für die Wiedervorlage.`} />;
  return <InboxEmpty icon={<BellIcon />} title={`Nichts in „${KIND_LABELS[props.kind]}“`} description={EMPTY_KIND[props.kind]} />;
}

export function NotificationInbox(props: Props) {
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-col gap-4">
      <Tabs value={props.showSnoozed ? "snoozed" : "inbox"} onValueChange={(value) => props.setShowSnoozed(value === "snoozed")}>
        <TabsList variant="line" aria-label="Ablage der Benachrichtigungen">
          <TabsTrigger value="inbox" id="notification-inbox-location" className="h-8 rounded-xl">Eingang</TabsTrigger>
          <TabsTrigger value="snoozed" className="h-8 rounded-xl">
            Zurückgestellt
            <UnreadCount value={props.snoozedCount} />
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Tabs value={props.kind} onValueChange={(value) => props.setKind(value as NotificationKind)}>
          <TabsList variant="line" aria-label="Art der Benachrichtigung">
            {(["direct", "watching"] as const).map((kind) => (
              <TabsTrigger key={kind} value={kind} className="h-8 px-2">
                {KIND_LABELS[kind]}
                <UnreadCount value={props.unreadByKind[kind]} />
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="Lesestatus"
          value={props.unreadOnly ? "unread" : "all"}
          onValueChange={(value) => value && props.setUnreadOnly(value === "unread")}
        >
          <ToggleGroupItem value="all" className="h-8 px-3">
            Alle
          </ToggleGroupItem>
          <ToggleGroupItem value="unread" className="h-8 px-3">
            Ungelesen
          </ToggleGroupItem>
        </ToggleGroup>
        <SearchField
          value={props.query}
          onChange={props.setQuery}
          label="Benachrichtigungen durchsuchen"
          placeholder="Ticket, Person oder Text"
          className="min-w-48 flex-1 sm:max-w-72"
        />
        <Tooltip content={props.markScopeReadLabel} side="bottom">
          <Button
            variant="outline"
            size="sm"
            className="ml-auto h-8 rounded-xl"
            aria-label={props.markScopeReadLabel}
            disabled={props.scopeUnread === 0}
            onClick={props.markScopeRead}
          >
            <CheckCheck />
            <span className="max-sm:sr-only">Als gelesen markieren</span>
          </Button>
        </Tooltip>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="min-w-0 flex-1 basis-64 text-xs text-muted-foreground">
          Lokal erfasste Aktivität auf diesem Gerät, keine vollständige Jira-Inbox
          {props.checkedAt !== null && (
            <>
              {" · zuletzt erfolgreich geprüft "}
              <time
                dateTime={new Date(props.checkedAt).toISOString()}
                title={format(props.checkedAt, "dd.MM.yyyy, HH:mm:ss")}
                className="tabular-nums"
              >
                {formatDistanceToNow(props.checkedAt, { addSuffix: true, locale: de })}
              </time>
            </>
          )}
        </p>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          <span role="status" className="min-w-0 text-right text-xs text-muted-foreground">
            <AnimatePresence mode="wait" initial={false}>
              {SYNC_STATUS[props.sync.phase] && (
                <motion.span
                  key={props.sync.phase}
                  className="block"
                  initial={{ opacity: 0, y: reduce ? 0 : 4 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.16, ease: EASE_OUT } }}
                  exit={{ opacity: 0, transition: { duration: 0.1, ease: EASE_OUT } }}
                >
                  {SYNC_STATUS[props.sync.phase]}
                </motion.span>
              )}
            </AnimatePresence>
          </span>
          <Tooltip content={SYNC_STATUS[props.sync.phase] || "Jira jetzt auf neue Aktivität prüfen"} side="bottom">
            <Button
              variant="outline"
              size="sm"
              className={cn("h-8 rounded-xl", (props.sync.phase === "offline" || props.sync.phase === "unavailable") && "opacity-50")}
              aria-disabled={props.sync.phase !== "ready"}
              aria-busy={props.sync.checking}
              onClick={props.sync.retry}
            >
              {props.sync.checking ? (
                <Spinner role={undefined} aria-label={undefined} aria-hidden className="motion-reduce:animate-none" />
              ) : (
                <RefreshCwIcon />
              )}
              Jetzt prüfen
            </Button>
          </Tooltip>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {props.sync.failed && (
          <motion.div
            initial={{ opacity: 0, y: reduce ? 0 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
          >
            <Alert variant="destructive" className="rounded-2xl">
              <AlertTitle>Jira konnte zuletzt nicht geprüft werden</AlertTitle>
              <AlertDescription>
                Angezeigt wird der zuletzt lokal erfasste Stand. {props.sync.errorMessage}
              </AlertDescription>
              <AlertAction>
                <Button size="sm" variant="outline" className="rounded-xl" disabled={props.sync.checking} onClick={props.sync.retry}>
                  Erneut prüfen
                </Button>
              </AlertAction>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={`${props.kind}-${props.unreadOnly}-${props.showSnoozed}`}
          initial={{ opacity: 0, y: reduce ? 0 : 4 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.18, ease: EASE_OUT } }}
          exit={{ opacity: 0, transition: { duration: 0.1, ease: EASE_OUT } }}
        >
          <InboxContent {...props} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
