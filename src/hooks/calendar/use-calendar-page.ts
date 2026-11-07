import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { addMonths, isSameMonth, parseISO, startOfDay, startOfMonth } from "date-fns";
import type { Rollout } from "@/lib/calendar/model";
import { externalEvents, gridRange, issueBrowseUrl, itemsOn, monthGrid, opensInternally, upcomingRollouts } from "@/lib/calendar/presentation";
import { useJiraSite } from "@/lib/jira/queries";
import { useConnectOutlook, useDisconnectOutlook, useOpenOutlookEvent, useOutlookAccount, useOutlookEvents, useOpenCalendarIssue } from "./use-outlook";
import type { RolloutFormTarget } from "./use-rollout-form";
import { useDeleteRollout, useRollouts, useSyncRollout } from "./use-rollouts";

const NO_ROLLOUTS: readonly Rollout[] = [];

export const useCalendarPage = () => {
  const navigate = useNavigate();
  const site = useJiraSite();
  const rollouts = useRollouts();
  const account = useOutlookAccount();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [direction, setDirection] = useState(0);
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const [editor, setEditor] = useState<RolloutFormTarget | null>(null);
  const [deleting, setDeleting] = useState<Rollout | null>(null);
  const [outlookOpen, setOutlookOpen] = useState(false);
  const range = useMemo(() => gridRange(month), [month]);
  const events = useOutlookEvents(range.start, range.end, !!account.data);
  const remove = useDeleteRollout();
  const sync = useSyncRollout();
  const openEvent = useOpenOutlookEvent();
  const openIssue = useOpenCalendarIssue();
  const connect = useConnectOutlook();
  const disconnect = useDisconnectOutlook();
  const now = new Date();
  const items = rollouts.data ?? NO_ROLLOUTS;
  const outlookEvents = useMemo(() => (account.data ? externalEvents(events.data ?? [], items) : []), [account.data, events.data, items]);

  const showMonth = (next: Date) => {
    const target = startOfMonth(next);
    setDirection(target > month ? 1 : target < month ? -1 : 0);
    setMonth(target);
  };

  const selectDay = (day: Date) => {
    setSelected(startOfDay(day));
    if (!isSameMonth(day, month)) showMonth(day);
  };

  return {
    month,
    direction,
    days: monthGrid(month),
    selected,
    today: now,
    rollouts: items,
    rolloutsPending: rollouts.isPending,
    rolloutsLoaded: rollouts.data !== undefined,
    rolloutsError: rollouts.error,
    retryRollouts: () => void rollouts.refetch(),
    outlookEvents,
    eventsPending: !!account.data && events.isPending,
    eventsError: events.error,
    dayRollouts: itemsOn(items, selected),
    dayEvents: itemsOn(outlookEvents, selected),
    upcoming: upcomingRollouts(items, now),
    account: account.data ?? null,
    accountPending: account.isPending,
    previousMonth: () => showMonth(addMonths(month, -1)),
    nextMonth: () => showMonth(addMonths(month, 1)),
    goToday: () => selectDay(new Date()),
    selectDay,
    showRollout: (rollout: Rollout) => selectDay(parseISO(rollout.start)),
    editor,
    createOn: (day: Date) => setEditor({ day }),
    edit: (rollout: Rollout) => setEditor({ rollout }),
    closeEditor: () => setEditor(null),
    deleting,
    confirmDelete: (rollout: Rollout) => {
      remove.reset();
      setDeleting(rollout);
    },
    closeDelete: () => setDeleting(null),
    deletePending: remove.isPending,
    deleteError: remove.error,
    deleteRollout: () => {
      if (deleting) remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
    },
    syncingId: sync.isPending ? sync.variables : null,
    syncRollout: (rollout: Rollout) => sync.mutate(rollout.id),
    openOutlookEvent: (eventId: string) => openEvent.mutate(eventId),
    outlookOpen,
    setOutlookOpen: (open: boolean) => {
      if (open) {
        connect.reset();
        disconnect.reset();
      }
      setOutlookOpen(open);
    },
    connectOutlook: () => connect.mutate(),
    connecting: connect.isPending,
    connectError: connect.error,
    disconnectOutlook: () => disconnect.mutate(),
    disconnecting: disconnect.isPending,
    disconnectError: disconnect.error,
    accountError: account.error,
    openIssue: (rollout: Rollout, key: string) => {
      if (opensInternally(rollout.siteUrl, site.data?.siteUrl)) void navigate({ to: "/issue/$key", params: { key } });
      else if (rollout.siteUrl) openIssue.mutate(issueBrowseUrl(rollout.siteUrl, key));
    },
  };
};
