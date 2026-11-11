import { useNavigate } from "@tanstack/react-router";
import { useRollouts } from "@/hooks/calendar/use-rollouts";
import { useOwnedNotifications } from "@/hooks/notifications/use-notification-store";
import { useMyWorklogs } from "@/hooks/time-tracking/use-my-worklogs";
import { resolveTimeRange } from "@/lib/time-tracking/range";
import { todayAgenda, type AgendaInput, type AgendaItem } from "@/lib/today-agenda";

export const useTodayAgenda = ({ active, open }: Pick<AgendaInput, "active" | "open">) => {
  const navigate = useNavigate();
  const now = new Date();
  const directUnread = useOwnedNotifications().filter((item) => !item.read && item.kind === "direct").length;
  const rollouts = useRollouts();
  const worklogs = useMyWorklogs(resolveTimeRange({ zeitraum: "tag" }, now));
  const loggedSeconds = worklogs.pending || worklogs.error || !worklogs.coverage.complete ? null : (worklogs.summary?.seconds ?? null);

  const select = (item: AgendaItem) => {
    if (item.target === "inbox") return void navigate({ to: "/benachrichtigungen" });
    if (item.target === "calendar") return void navigate({ to: "/kalender" });
    if (item.target === "tickets") return void navigate({ to: "/tickets" });
    if (item.target === "time") return void navigate({ to: "/zeiterfassung", search: { zeitraum: "tag" } });
    if (item.issueKey) void navigate({ to: "/issue/$key", params: { key: item.issueKey } });
  };

  const items = todayAgenda({ now, directUnread, rollouts: rollouts.data ?? [], loggedSeconds, active, open });
  return {
    items,
    urgent: items.filter((item) => item.tone === "urgent").length,
    onSelect: select,
  };
};
