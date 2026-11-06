import { Link, createFileRoute } from "@tanstack/react-router";
import { TicketIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { IssueTable } from "@/components/issue-table";
import { NAV_TAB_CLASS, NavTabIndicator, NavTabs } from "@/components/motion/nav-tabs";
import { LoginPrompt } from "@/components/shell/login-prompt";
import { SessionGate } from "@/components/shell/session-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { useJiraSession } from "@/hooks/jira/use-jira-session";
import { EASE_OUT } from "@/lib/ease";
import { TICKET_PRESETS, TICKET_PRESET_IDS, ticketPresetOf, ticketPresetSearch } from "@/lib/jira/ticket-presets";

export const Route = createFileRoute("/tickets")({
  validateSearch: (search: Record<string, unknown>) => ticketPresetSearch(ticketPresetOf(search.ansicht)),
  component: Tickets,
});

function Tickets() {
  const preset = ticketPresetOf(Route.useSearch().ansicht);
  const session = useJiraSession();
  const connected = session.status === "connected";
  const reduce = useReducedMotion();

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-8">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
          <TicketIcon className="size-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Jira-Tickets</h1>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={connected ? preset : "signed-out"}
              initial={{ opacity: 0, y: reduce ? 0 : 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1, ease: EASE_OUT } }}
              transition={{ duration: 0.18, ease: EASE_OUT }}
              className="text-sm text-muted-foreground"
            >
              {connected ? TICKET_PRESETS[preset].description : "Deine persönlichen Tickets aus Jira."}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
      <SessionGate
        session={session}
        className="flex flex-col gap-6"
        pending={<Skeleton className="h-64 w-full" />}
        unconnected={<LoginPrompt description="Melde dich an, um deine Tickets zu sehen." />}
      >
        <NavTabs id="ticket-presets" label="Ticket-Ansicht" className="self-start">
          {TICKET_PRESET_IDS.map((id) => (
            <Link
              key={id}
              to="/tickets"
              search={ticketPresetSearch(id)}
              activeOptions={{ exact: true }}
              aria-current={id === preset ? "page" : undefined}
              className={NAV_TAB_CLASS}
            >
              {TICKET_PRESETS[id].label}
              {id === preset && <NavTabIndicator />}
            </Link>
          ))}
        </NavTabs>
        <IssueTable key={preset} scope={`tickets:${preset}`} jql={TICKET_PRESETS[preset].jql} />
      </SessionGate>
    </div>
  );
}
