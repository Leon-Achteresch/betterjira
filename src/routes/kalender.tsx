import { createFileRoute } from "@tanstack/react-router";
import { CalendarDaysIcon, CalendarPlusIcon } from "lucide-react";
import { DayAgenda } from "@/components/calendar/day-agenda";
import { DeleteRolloutDialog } from "@/components/calendar/delete-rollout-dialog";
import { MonthGrid } from "@/components/calendar/month-grid";
import { OutlookDialog } from "@/components/calendar/outlook-dialog";
import { OutlookStatusButton } from "@/components/calendar/outlook-status-button";
import { RolloutDialog } from "@/components/calendar/rollout-dialog";
import { RolloutSearch } from "@/components/calendar/rollout-search";
import { UpcomingRollouts } from "@/components/calendar/upcoming-rollouts";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useCalendarPage } from "@/hooks/calendar/use-calendar-page";
import { useRolloutSearch } from "@/hooks/calendar/use-rollout-search";
import { errorMessage } from "@/lib/calendar/presentation";
import { parseKalenderSearch } from "@/lib/calendar/rollout-search";

export const Route = createFileRoute("/kalender")({
  validateSearch: parseKalenderSearch,
  component: Kalender,
});

function Kalender() {
  const page = useCalendarPage();
  const search = useRolloutSearch(Route.useSearch(), {
    rollouts: page.rollouts,
    pending: page.rolloutsPending,
    loaded: page.rolloutsLoaded,
    onOpen: page.showRollout,
  });
  const actions = {
    onEdit: page.edit,
    onDelete: page.confirmDelete,
    onSync: page.syncRollout,
    onOpenOutlook: page.openOutlookEvent,
    onOpenIssue: page.openIssue,
  };
  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-md bg-muted">
          <CalendarDaysIcon className="size-5 text-muted-foreground" />
        </div>
        <div className="mr-auto">
          <h1 className="text-2xl font-semibold">Kalender</h1>
          <p className="text-sm text-muted-foreground">Rollouts planen, mit Tickets verknüpfen und in Outlook eintragen.</p>
        </div>
        <OutlookStatusButton
          account={page.account}
          pending={page.accountPending}
          failed={!!page.accountError}
          onClick={() => page.setOutlookOpen(true)}
        />
        <Button size="sm" onClick={() => page.createOn(page.selected)}>
          <CalendarPlusIcon />
          Rollout planen
        </Button>
      </div>
      {page.rolloutsError && (
        <Alert variant="destructive">
          <AlertTitle>Rollouts konnten nicht geladen werden</AlertTitle>
          <AlertDescription>{errorMessage(page.rolloutsError, "Unbekannter Fehler.")}</AlertDescription>
          <AlertAction>
            <Button size="sm" variant="outline" onClick={page.retryRollouts}>
              Erneut versuchen
            </Button>
          </AlertAction>
        </Alert>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <MonthGrid
          month={page.month}
          direction={page.direction}
          days={page.days}
          selected={page.selected}
          today={page.today}
          rollouts={page.rollouts}
          events={page.outlookEvents}
          onPrevious={page.previousMonth}
          onNext={page.nextMonth}
          onToday={page.goToday}
          onSelect={page.selectDay}
          onCreate={page.createOn}
          onEdit={page.edit}
        />
        <div className="flex flex-col gap-6">
          <RolloutSearch
            value={search.text}
            onChange={search.setText}
            status={search.status}
            results={search.results}
            total={search.total}
            canExpand={search.canExpand}
            expanded={search.expanded}
            onToggleExpanded={search.toggleExpanded}
            onSelect={search.open}
          />
          <DayAgenda
            ref={search.agendaRef}
            day={page.selected}
            rollouts={page.dayRollouts}
            events={page.dayEvents}
            pending={page.rolloutsPending}
            eventsPending={page.eventsPending}
            eventsError={page.eventsError}
            account={page.account}
            syncingId={page.syncingId}
            onCreate={() => page.createOn(page.selected)}
            {...actions}
          />
          <UpcomingRollouts rollouts={page.upcoming} pending={page.rolloutsPending} onSelect={page.showRollout} />
        </div>
      </div>
      <RolloutDialog target={page.editor} onClose={page.closeEditor} />
      <DeleteRolloutDialog
        rollout={page.deleting}
        pending={page.deletePending}
        error={page.deleteError}
        onConfirm={page.deleteRollout}
        onClose={page.closeDelete}
      />
      <OutlookDialog
        open={page.outlookOpen}
        onOpenChange={page.setOutlookOpen}
        account={page.account}
        connecting={page.connecting}
        connectError={page.connectError}
        disconnecting={page.disconnecting}
        disconnectError={page.disconnectError}
        onConnect={page.connectOutlook}
        onDisconnect={page.disconnectOutlook}
      />
    </div>
  );
}
