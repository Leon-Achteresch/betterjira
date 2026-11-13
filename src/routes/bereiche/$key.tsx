import { type ReactNode, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMutationState, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useTransitionFlow } from "@/components/issue-status-menu";
import { ArrowRightLeftIcon, ChartColumnStackedIcon, BookmarkIcon, CalendarIcon, ChevronRightIcon, ClockIcon, Columns3Icon, FilterIcon, FlagIcon, ListChecksIcon, ListIcon, SearchXIcon, TagIcon, Trash2Icon, TriangleAlertIcon, UserRoundIcon } from "lucide-react";
import { JiraUserAvatar } from "@/components/jira-user-avatar";
import { ProjectAvatar } from "@/components/shell/project-avatar";
import { IssueTable } from "@/components/issue-table";
import { IssuePreviewTooltip } from "@/components/issues/issue-preview";
import { BoardSkeleton } from "@/components/issues/board-skeleton";
import { BoardPlanning } from "@/components/issues/board-planning";
import { useBoardPlanning } from "@/hooks/jira/use-board-planning";
import { LoadFailed, RefreshFailed } from "@/components/issues/load-recovery";
import { Skeleton } from "@/components/ui/skeleton";
import { BoardPagination } from "@/components/issues/board-pagination";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  EMPTY_COLUMNS,
  EMPTY_FILTER,
  EMPTY_VIEWS,
  FILTER_FIELDS,
  type FilterField,
  filterCount,
  columnMatches,
} from "@/lib/board-filters";
import { type BoardCard, type BoardColumn, cardValues } from "@/lib/board-card";
import { CARD_PROPERTIES, DEFAULT_HIDDEN_PROPERTIES } from "@/lib/board-display";
import { EMPTY_VALUES, INSIGHT_DIMENSIONS, INSIGHT_MEASURES, insightColor, labelColor } from "@/lib/board-insights";
import { useBoardDisplay } from "@/hooks/use-board-display";
import { useBoardInsights } from "@/hooks/use-board-insights";
import { InsightsPanel } from "@/components/issues/insights-panel";
import { DisplayMenu } from "@/components/issues/display-menu";
import { StatusIcon } from "@/components/issues/status-icon";
import { PriorityIcon } from "@/components/issues/priority-icon";
import { useBoardFilters } from "@/hooks/use-board-filters";
import { useAreaPage } from "@/hooks/jira/use-area-page";
import { EASE_OUT } from "@/lib/ease";
import { boardLanes } from "@/lib/board-lanes";
import { type JiraBoard, type JiraSprint } from "@/lib/jira/board";
import { useJiraBacklogJql, useJiraBoard, useJiraBoardSprints } from "@/hooks/jira/use-jira-board";
import { BACKLOG, type BoardSprint, parseAreaSearch } from "@/lib/jira/area-page";
import { jiraErrors } from "@/lib/jira/field-values";
import {
  type JiraTransitionRequest,
  transitionsQuery,
  useJiraTransitions,
} from "@/lib/jira/queries";
import { cn } from "@/lib/utils";
import { LoginPrompt } from "@/components/shell/login-prompt";
import { SessionGate } from "@/components/shell/session-gate";

export const Route = createFileRoute("/bereiche/$key")({
  validateSearch: parseAreaSearch,
  component: Bereich,
});

function Bereich() {
  const page = useAreaPage();
  const reduce = useReducedMotion();
  const { content } = page;
  const showsBoard = page.session.status === "connected" && content.kind === "board";
  const title = (
    <div className="flex min-w-0 items-center gap-2">
      {page.project && <ProjectAvatar project={page.project} />}
      <h1 className="truncate text-lg font-semibold">{page.project?.name ?? page.key}</h1>
      <span className="truncate text-sm text-muted-foreground">{page.subtitle}</span>
    </div>
  );
  const showAll = (
    <Button variant="ghost" onClick={page.showAll}>
      <ListIcon />
      Alle Vorgänge anzeigen
    </Button>
  );

  return (
    <div className="flex flex-col gap-4 p-6">
      {!showsBoard && title}
      <SessionGate
        session={page.session}
        className="flex min-w-0 flex-col gap-4"
        pending={page.boardId === undefined ? <Skeleton className="h-64 w-full" /> : <BoardSkeleton />}
        unconnected={<LoginPrompt description="Melde dich an, um Bereiche zu sehen." />}
      >
        <AnimatePresence initial={false}>
          {page.boards.refreshFailed && content.kind === "board" && (
            <RefreshFailed
              key="boards-refresh"
              title="Boards konnten nicht aktualisiert werden. Angezeigt wird der zuletzt geladene Stand."
              detail={page.boards.errorMessage}
              retrying={page.boards.retrying}
              onRetry={page.boards.retry}
            />
          )}
        </AnimatePresence>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={content.kind}
            initial={{ opacity: 0, y: reduce ? 0 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="min-w-0"
          >
            {content.kind === "all" ? (
              <IssueTable key={page.key} jql={page.allJql} />
            ) : content.kind === "board" ? (
              <Board
                key={content.board.id}
                board={content.board}
                title={title}
                sprintId={page.sprint}
                onSprintChange={page.changeSprint}
              />
            ) : content.kind === "error" ? (
              <LoadFailed
                icon={<TriangleAlertIcon />}
                title="Boards konnten nicht geladen werden"
                description={`Die Boardliste von ${page.key} ist gerade nicht lesbar. Deine Anmeldung ist davon nicht betroffen.`}
                detail={page.boards.errorMessage}
                retrying={page.boards.retrying}
                onRetry={page.boards.retry}
                action={showAll}
              />
            ) : content.kind === "missing" ? (
              <LoadFailed
                icon={<SearchXIcon />}
                title="Board nicht verfügbar"
                description={`Board ${page.boardId} ist nicht unter den geladenen Boards von ${page.key}. Es kann verschoben, gelöscht oder für dich nicht sichtbar sein.`}
                detail={page.boards.refreshFailed ? page.boards.errorMessage : undefined}
                retrying={page.boards.retrying}
                onRetry={page.boards.retry}
                action={showAll}
              />
            ) : (
              <BoardSkeleton />
            )}
          </motion.div>
        </AnimatePresence>
      </SessionGate>
    </div>
  );
}

const sprintDate = (date?: string) =>
  date ? new Date(date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "?";

const DAY_MS = 86_400_000;

const daysSince = (date: string) => Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / DAY_MS));

type BoardDnd = {
  dragging?: BoardCard;
  setDragging: (issue?: BoardCard) => void;
  targets?: Set<string>;
  moving: string[];
  moveTo: (issue: BoardCard, column: BoardColumn) => void;
};

function FilterOptionIcon({ field, sample }: { field: FilterField; sample?: BoardCard }) {
  if (field === "label") return <TagIcon className="text-muted-foreground" />;
  if (field === "assignee") {
    return sample?.fields.assignee ? (
      <JiraUserAvatar user={sample.fields.assignee} />
    ) : (
      <UserRoundIcon className="text-muted-foreground" />
    );
  }
  const iconUrl = field === "issuetype" ? sample?.fields.issuetype.iconUrl : sample?.fields.priority?.iconUrl;
  return iconUrl ? <img src={iconUrl} alt="" className="size-4 shrink-0" /> : <span className="size-4 shrink-0" />;
}

function FilterMenu({ scope, issues, label, column }: { scope: string; issues: BoardCard[]; label: string; column?: boolean }) {
  const filter = useBoardFilters((state) => state.filters[scope] ?? EMPTY_FILTER);
  const ignoreBoard = useBoardFilters((state) => !!state.ignoreBoard[scope]);
  const toggle = useBoardFilters((state) => state.toggle);
  const toggleIgnoreBoard = useBoardFilters((state) => state.toggleIgnoreBoard);
  const clear = useBoardFilters((state) => state.clear);
  const count = filterCount(filter);
  const active = count > 0 || ignoreBoard;
  const options = (field: FilterField) => {
    const samples = new Map<string, BoardCard | undefined>();
    for (const issue of issues) for (const value of cardValues(issue)[field]) if (!samples.has(value)) samples.set(value, issue);
    for (const value of filter[field] ?? []) if (!samples.has(value)) samples.set(value, undefined);
    return [...samples].sort(([a], [b]) => a.localeCompare(b, "de"));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={active ? "secondary" : "ghost"} size="sm" aria-label={label}>
          <FilterIcon />
          {count > 0 && count}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 min-w-56">
        {column && (
          <>
            <DropdownMenuCheckboxItem
              checked={ignoreBoard}
              onCheckedChange={() => toggleIgnoreBoard(scope)}
              onSelect={(event) => event.preventDefault()}
            >
              Board-Filter ignorieren
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
          </>
        )}
        {(Object.keys(FILTER_FIELDS) as FilterField[]).map((field) => {
          const values = options(field);
          if (values.length === 0) return null;
          return (
            <div key={field}>
              <DropdownMenuLabel>{FILTER_FIELDS[field]}</DropdownMenuLabel>
              {values.map(([value, sample]) => (
                <DropdownMenuCheckboxItem
                  key={value}
                  checked={filter[field]?.includes(value) ?? false}
                  onCheckedChange={() => toggle(scope, field, value)}
                  onSelect={(event) => event.preventDefault()}
                >
                  <FilterOptionIcon field={field} sample={sample} />
                  <span className="truncate">{value}</span>
                </DropdownMenuCheckboxItem>
              ))}
            </div>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!active} onSelect={() => clear(scope)}>
          Filter zurücksetzen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ColumnsMenu({ board, columns }: { board: string; columns: string[] }) {
  const hidden = useBoardFilters((state) => state.hiddenColumns[board] ?? EMPTY_COLUMNS);
  const toggleColumn = useBoardFilters((state) => state.toggleColumn);
  const count = columns.filter((column) => hidden.includes(column)).length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={count > 0 ? "secondary" : "ghost"} size="sm" aria-label="Spalten ein- und ausblenden">
          <Columns3Icon />
          {count > 0 && count}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel>Spalten anzeigen</DropdownMenuLabel>
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column}
            checked={!hidden.includes(column)}
            onCheckedChange={() => toggleColumn(board, column)}
            onSelect={(event) => event.preventDefault()}
          >
            <span className="truncate">{column}</span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ViewMenu({ board }: { board: string }) {
  const views = useBoardFilters((state) => state.views[board] ?? EMPTY_VIEWS);
  const saveView = useBoardFilters((state) => state.saveView);
  const applyView = useBoardFilters((state) => state.applyView);
  const deleteView = useBoardFilters((state) => state.deleteView);
  const reduce = useReducedMotion();
  const [name, setName] = useState("");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Gespeicherte Ansichten">
          <BookmarkIcon />
          Ansichten
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            saveView(board, name.trim());
            setName("");
          }}
        >
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Aktuelle Filter speichern als…" aria-label="Name der Ansicht" />
          <Button type="submit" size="sm" disabled={!name.trim()}>
            Speichern
          </Button>
        </form>
        {views.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">Noch keine Ansichten gespeichert.</p>
        ) : (
          <ul className="flex flex-col">
            <AnimatePresence initial={false}>
              {views.map((view) => (
                <motion.li
                  key={view.name}
                  layout={!reduce}
                  initial={{ opacity: 0, y: reduce ? 0 : -4 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.18, ease: EASE_OUT } }}
                  exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
                  className="flex items-center gap-1"
                >
                  <Button variant="ghost" size="sm" className="min-w-0 flex-1 justify-start" onClick={() => applyView(board, view)}>
                    <span className="truncate">{view.name}</span>
                  </Button>
                  <Button variant="ghost" size="icon-xs" aria-label={`Ansicht ${view.name} löschen`} onClick={() => deleteView(board, view.name)}>
                    <Trash2Icon />
                  </Button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

const OPEN_SPRINTS = "open";

const SPRINT_GROUPS = [
  { state: "active", label: "Aktiv" },
  { state: "future", label: "Geplant" },
  { state: "closed", label: "Abgeschlossen" },
] as const;

const parseSprint = (value: string): BoardSprint | undefined =>
  value === OPEN_SPRINTS ? undefined : value === BACKLOG ? BACKLOG : Number(value);

function SprintPicker({
  board,
  sprintId,
  onChange,
}: {
  board: JiraBoard;
  sprintId?: BoardSprint;
  onChange: (sprint?: BoardSprint) => void;
}) {
  const sprints = useJiraBoardSprints(board);
  if (board.type !== "scrum") return null;
  return (
    <Select value={sprintId === undefined ? OPEN_SPRINTS : String(sprintId)} onValueChange={(value) => onChange(parseSprint(value))}>
      <SelectTrigger size="sm" className="shrink-0 font-semibold" aria-label="Sprint wählen">
        <SelectValue placeholder="Sprint wählen" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={OPEN_SPRINTS}>Aktive Sprints</SelectItem>
        <SelectItem value={BACKLOG}>Backlog</SelectItem>
        {sprints.isPending && (
          <SelectItem value="loading" disabled>
            Sprints werden geladen…
          </SelectItem>
        )}
        {sprints.error && (
          <SelectItem value="error" disabled>
            Sprints nicht ladbar – ggf. neu anmelden
          </SelectItem>
        )}
        {typeof sprintId === "number" && !sprints.data?.some((sprint) => sprint.id === sprintId) && (
          <SelectItem value={String(sprintId)}>Sprint {sprintId}</SelectItem>
        )}
        {SPRINT_GROUPS.map(({ state, label }) => {
          const group = (sprints.data ?? []).filter((sprint) => sprint.state === state);
          if (group.length === 0) return null;
          return (
            <SelectGroup key={state}>
              <SelectLabel>{label}</SelectLabel>
              {(state === "closed" ? [...group].reverse() : group).map((sprint) => (
                <SelectItem key={sprint.id} value={String(sprint.id)}>
                  {sprint.name}
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}

function SprintInfo({ sprint, named }: { sprint: JiraSprint; named?: boolean }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2 text-sm">
      {named && <h2 className="shrink-0 font-semibold">{sprint.name}</h2>}
      <span className="shrink-0 text-muted-foreground">
        {sprintDate(sprint.startDate)} – {sprintDate(sprint.endDate)}
      </span>
      {sprint.goal && (
        <span className="truncate text-muted-foreground" title={sprint.goal}>
          {sprint.goal}
        </span>
      )}
    </div>
  );
}

function IssueCard({ issue, columns, dnd }: { issue: BoardCard; columns: BoardColumn[]; dnd: BoardDnd }) {
  const { fields } = issue;
  const hidden = useBoardDisplay((state) => state.hiddenProperties);
  const show = (property: keyof typeof CARD_PROPERTIES) => !hidden.includes(property);
  const moving = dnd.moving.includes(issue.key);
  const days = daysSince(issue.inColumnSince);
  const subtasks = fields.subtasks ?? [];
  const doneSubtasks = subtasks.filter((subtask) => subtask.fields.status.statusCategory.key === "done").length;
  const overdue = !!fields.duedate && fields.duedate < new Date().toISOString().slice(0, 10);
  const labels = show("labels") ? (fields.labels ?? []) : [];

  return (
    <IssuePreviewTooltip issueKey={issue.key}>
    <Card
      size="sm"
      draggable={!moving}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", issue.key);
        dnd.setDragging(issue);
      }}
      onDragEnd={() => dnd.setDragging(undefined)}
      aria-busy={moving}
      className={cn(
        "relative cursor-grab transition-[background-color,opacity,box-shadow] hover:bg-muted/50 hover:shadow-sm active:cursor-grabbing",
        (moving || dnd.dragging?.key === issue.key) && "opacity-50",
      )}
    >
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {show("priority") && (
            <span title={fields.priority?.name ?? EMPTY_VALUES.priority}>
              <PriorityIcon name={fields.priority?.name} />
            </span>
          )}
          <span className="font-mono">{issue.key}</span>
          {show("issuetype") && <span className="truncate">{fields.issuetype.name}</span>}
          {issue.flagged && <FlagIcon aria-label="Markiert" className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />}
          {show("rank") && (
            <span className="ml-auto tabular-nums" title="Rang im Board">
              #{issue.rank}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" className={cn("relative z-10 -my-1", !show("rank") && "ml-auto")} aria-label={`${issue.key} in andere Spalte verschieben`} disabled={moving}>
                {moving ? <Spinner /> : <StatusIcon color={fields.status.statusCategory.colorName} label={fields.status.name} />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-40">
              <DropdownMenuLabel>Verschieben nach</DropdownMenuLabel>
              {columns
                .filter((column) => !column.statusIds.includes(fields.status.id))
                .map((column) => (
                  <DropdownMenuItem key={column.name} onSelect={() => dnd.moveTo(issue, column)}>
                    <ArrowRightLeftIcon />
                    {column.name}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Link to="/issue/$key" params={{ key: issue.key }} draggable={false} data-row-link className="line-clamp-3 font-medium outline-none after:absolute after:inset-0 after:rounded-[inherit] focus-visible:after:ring-2 focus-visible:after:ring-ring">
          {fields.summary}
        </Link>
        {show("parent") && fields.parent && (
          <p className="truncate text-xs text-muted-foreground" title={fields.parent.key}>
            {fields.parent.fields.summary}
          </p>
        )}
        {labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {labels.map((label) => (
              <span key={label} className="inline-flex h-5 items-center gap-1.5 rounded-full px-2 text-xs ring-1 ring-foreground/10">
                <span aria-hidden className="size-1.5 rounded-full" style={{ background: labelColor(label) }} />
                {label}
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {show("points") && issue.points !== undefined && (
            <Badge variant="secondary" title="Story Points">
              {issue.points} SP
            </Badge>
          )}
          {show("subtasks") && subtasks.length > 0 && (
            <span className="flex items-center gap-1" title="Erledigte Unteraufgaben">
              <ListChecksIcon className="size-3.5" />
              {doneSubtasks}/{subtasks.length}
            </span>
          )}
          {show("duedate") && fields.duedate && (
            <span className={cn("flex items-center gap-1", overdue && "text-destructive")} title="Fälligkeit">
              <CalendarIcon className="size-3.5" />
              {sprintDate(fields.duedate)}
            </span>
          )}
          {show("age") && (
            <span
              className={cn("flex items-center gap-1", days >= 7 && "text-warning")}
              title={`In dieser Spalte seit ${sprintDate(issue.inColumnSince)}`}
            >
              <ClockIcon className="size-3.5" />
              {days === 1 ? "1 Tag" : `${days} Tage`}
            </span>
          )}
          {show("assignee") && fields.assignee && (
            <span className="ml-auto" title={fields.assignee.displayName}>
              <JiraUserAvatar user={fields.assignee} />
            </span>
          )}
        </div>
      </CardContent>
    </Card>
    </IssuePreviewTooltip>
  );
}

function Board({
  board,
  title,
  sprintId,
  onSprintChange,
}: {
  board: JiraBoard;
  title: ReactNode;
  sprintId?: BoardSprint;
  onSprintChange: (sprint?: BoardSprint) => void;
}) {
  const backlog = sprintId === BACKLOG;
  const planning = useBoardPlanning(board);
  const sprints = useJiraBoard(board, backlog ? undefined : sprintId, !backlog);
  const backlogJql = useJiraBacklogJql(board);
  const queryClient = useQueryClient();
  const flow = useTransitionFlow();
  const [dragging, setDragging] = useState<BoardCard>();
  const reachable = useJiraTransitions(dragging?.key ?? "", !!dragging);
  const moving = useMutationState({
    filters: { mutationKey: ["jira", "transition"], status: "pending" },
    select: (mutation) => (mutation.state.variables as JiraTransitionRequest).issueKey,
  });

  const moveTo = async (issue: BoardCard, column: BoardColumn) => {
    if (column.statusIds.includes(issue.fields.status.id)) return;
    try {
      const { transitions, current } = await queryClient.fetchQuery({ ...transitionsQuery(issue.key), staleTime: 30_000 });
      const candidates = transitions.filter((transition) => column.statusIds.includes(transition.to.id));
      if (candidates.length === 0) {
        toast.error(`${issue.key} kann nicht nach „${column.name}“ verschoben werden`, {
          description: "Der Workflow erlaubt von hier keinen direkten Übergang in diese Spalte.",
        });
        return;
      }
      flow.start(issue.key, candidates, current);
    } catch (error) {
      toast.error(`${issue.key} konnte nicht verschoben werden`, { description: error instanceof Error ? error.message : String(error) });
    }
  };

  const dnd: BoardDnd = {
    dragging,
    setDragging,
    targets: reachable.data && new Set(reachable.data.transitions.map((transition) => transition.to.id)),
    moving,
    moveTo: (issue, column) => void moveTo(issue, column),
  };

  const data = sprints.data ?? [];
  const allColumns = data.flatMap(({ columns }) => columns);
  const allIssues = allColumns.flatMap((column) => column.issues);
  const single = data.length === 1;
  const insights = useBoardInsights(board.id, allColumns);
  const showInsights = !backlog && insights.insightsOpen && data.length > 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
        {title}
        <SprintPicker board={board} sprintId={sprintId} onChange={onSprintChange} />
        {single && data[0].sprint && <SprintInfo sprint={data[0].sprint} named={board.type !== "scrum"} />}
        {!backlog && (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-1">
            {sprints.data && (
              <span className="mr-2 text-sm text-muted-foreground tabular-nums" aria-live="polite">
                {insights.count === allIssues.length ? allIssues.length : `${insights.count} von ${allIssues.length}`} Vorgänge{sprints.hasNextPage ? " geladen" : ""}
              </span>
            )}
            <FilterMenu scope={String(board.id)} issues={allIssues} label="Board filtern" />
            <Button
              variant={insights.insightsOpen ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={insights.insightsOpen}
              aria-label="Insights"
              title="Insights"
              onClick={insights.toggleInsights}
            >
              <ChartColumnStackedIcon />
            </Button>
            {data[0] && <ColumnsMenu board={String(board.id)} columns={data[0].columns.map((column) => column.name)} />}
            <ViewMenu board={String(board.id)} />
            <BoardDisplayMenu />
          </div>
        )}
      </div>
      <AnimatePresence initial={false}>
        {!backlog && sprints.data && sprints.isError && !sprints.isFetchNextPageError && (
          <RefreshFailed
            key="board-refresh"
            title="Board konnte nicht aktualisiert werden. Angezeigt wird der zuletzt geladene Stand."
            detail={jiraErrors(sprints.error).messages.join(" ")}
            retrying={sprints.isFetching}
            onRetry={() => void sprints.refetch()}
          />
        )}
      </AnimatePresence>
      {board.type === "scrum" && <BoardPlanning plan={planning} />}
      {backlog ? (
        backlogJql.data ? (
          <IssueTable jql={backlogJql.data} />
        ) : backlogJql.error ? (
          <LoadFailed
            icon={<TriangleAlertIcon />}
            title="Backlog konnte nicht geladen werden"
            description="Die Board-Konfiguration ist gerade nicht lesbar."
            detail={jiraErrors(backlogJql.error).messages.join(" ")}
            retrying={backlogJql.isFetching}
            onRetry={() => void backlogJql.refetch()}
          />
        ) : (
          <Spinner />
        )
      ) : sprints.error && !sprints.data ? (
        <LoadFailed
          icon={<TriangleAlertIcon />}
          title="Board konnte nicht geladen werden"
          description={
            sprintId === undefined
              ? "Die Vorgänge dieses Boards sind gerade nicht lesbar."
              : `Die Vorgänge von Sprint ${sprintId} sind gerade nicht lesbar. Den Sprint gibt es möglicherweise auf diesem Board nicht.`
          }
          detail={jiraErrors(sprints.error).messages.join(" ")}
          retrying={sprints.isFetching}
          onRetry={() => void sprints.refetch()}
          action={
            sprintId !== undefined && (
              <Button variant="ghost" onClick={() => onSprintChange(undefined)}>
                Aktive Sprints anzeigen
              </Button>
            )
          }
        />
      ) : !sprints.data ? (
        <BoardSkeleton />
      ) : data.length === 0 ? (
        <p className="text-muted-foreground">{sprintId === undefined ? "Kein aktiver Sprint." : "Keine Vorgänge in diesem Sprint."}</p>
      ) : null}
      <div className="flex flex-col items-start gap-4 lg:flex-row">
      <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
      {!backlog && data.map(({ sprint, columns }) => (
        <div key={sprint?.id ?? "board"} className="flex flex-col gap-2">
          {!single && sprint && <SprintInfo sprint={sprint} named />}
          {boardLanes(columns).map((lane) =>
            lane.name ? (
              <BoardLaneSection key={lane.name} name={lane.name} count={lane.columns.reduce((sum, column) => sum + column.issues.length, 0)}>
                <BoardColumns boardId={board.id} columns={lane.columns} dnd={dnd} />
              </BoardLaneSection>
            ) : (
              <BoardColumns key="all" boardId={board.id} columns={lane.columns} dnd={dnd} />
            ),
          )}
        </div>
      ))}
      {!backlog && sprints.data && (
        <BoardPagination
          hasMore={sprints.hasNextPage}
          fetching={sprints.isFetching}
          error={sprints.isFetchNextPageError ? sprints.error?.message : undefined}
          sentinelRef={sprints.sentinelRef}
          onLoadMore={sprints.loadMore}
          onRetry={() => { if (!sprints.isFetching) void (sprints.isFetchNextPageError ? sprints.fetchNextPage({ cancelRefetch: false }) : sprints.refetch()); }}
        />
      )}
      </div>
      <AnimatePresence>
        {showInsights && (
          <InsightsPanel
            key="insights"
            total={insights.insights.total}
            unit={insights.measure === "points" ? "Story Points" : "Vorgänge"}
            measure={{ value: insights.measure, options: INSIGHT_MEASURES, onChange: insights.setMeasure }}
            slice={{ value: insights.slice, options: INSIGHT_DIMENSIONS, onChange: insights.setSlice }}
            segment={{ value: insights.segment, options: SEGMENT_OPTIONS, onChange: insights.setSegment }}
            segments={insights.insights.segments}
            rows={insights.insights.rows}
            colorOf={(name, index) => insightColor(insights.segment, name, index)}
            renderLabel={(name) => <InsightLabel dimension={insights.slice} name={name} statusColor={insights.statusColors[name]} />}
            active={insights.active}
            canSelect={insights.canFilter}
            onSelect={insights.toggleRow}
            onClose={insights.closeInsights}
          />
        )}
      </AnimatePresence>
      </div>
      {flow.dialog}
    </div>
  );
}

const SEGMENT_OPTIONS = { none: "Kein Segment", ...INSIGHT_DIMENSIONS } as const;

function InsightLabel({ dimension, name, statusColor }: { dimension: keyof typeof INSIGHT_DIMENSIONS; name: string; statusColor?: string }) {
  const icon =
    dimension === "status" ? (
      <StatusIcon color={statusColor ?? ""} />
    ) : dimension === "priority" ? (
      <PriorityIcon name={name === EMPTY_VALUES.priority ? undefined : name} />
    ) : dimension === "label" ? (
      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: insightColor("label", name, 0) }} />
    ) : dimension === "assignee" ? (
      <UserRoundIcon className="size-3.5 shrink-0 text-muted-foreground" />
    ) : null;
  return (
    <>
      {icon}
      <span className="truncate">{name}</span>
    </>
  );
}

function BoardDisplayMenu() {
  const hidden = useBoardDisplay((state) => state.hiddenProperties);
  const toggleProperty = useBoardDisplay((state) => state.toggleProperty);
  const resetProperties = useBoardDisplay((state) => state.resetProperties);
  const changed = hidden.length !== DEFAULT_HIDDEN_PROPERTIES.length || hidden.some((property) => !DEFAULT_HIDDEN_PROPERTIES.includes(property));
  return (
    <DisplayMenu
      title="Eigenschaften auf Karten"
      properties={CARD_PROPERTIES}
      hidden={hidden}
      changed={changed}
      onToggle={toggleProperty}
      onReset={resetProperties}
    />
  );
}

function BoardLaneSection({ name, count, children }: { name: string; count: number; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  const reduce = useReducedMotion();
  return (
    <section className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex w-fit items-center gap-1.5 rounded-md px-1 text-sm font-medium hover:text-foreground"
      >
        <ChevronRightIcon className={cn("size-4 transition-transform duration-200", open && "rotate-90")} />
        {name}
        <span className="text-xs font-normal text-muted-foreground tabular-nums">({count} Vorgänge)</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: reduce ? 0 : -6 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE_OUT } }}
            exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function BoardColumns({ boardId, columns, dnd }: { boardId: number; columns: BoardColumn[]; dnd: BoardDnd }) {
  const filters = useBoardFilters((state) => state.filters);
  const ignoreBoard = useBoardFilters((state) => state.ignoreBoard);
  const hidden = useBoardFilters((state) => state.hiddenColumns[boardId] ?? EMPTY_COLUMNS);
  const reduce = useReducedMotion();
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      <AnimatePresence initial={false} mode="popLayout">
        {columns.filter((column) => !hidden.includes(column.name)).map((column) => {
          const scope = `${boardId}:${column.name}`;
          const issues = column.issues.filter((issue) => columnMatches(filters, ignoreBoard, boardId, column.name, cardValues(issue)));
          const statusColor = (column.issues[0] ?? issues[0])?.fields.status.statusCategory.colorName ?? "";
          const origin = !!dnd.dragging && column.statusIds.includes(dnd.dragging.fields.status.id);
          const reachable = !!dnd.targets && column.statusIds.some((id) => dnd.targets!.has(id));
          return (
            <motion.section
              key={column.name}
              layout={reduce ? false : "position"}
              initial={{ opacity: 0, scale: reduce ? 1 : 0.98 }}
              animate={{ opacity: 1, scale: 1, transition: { duration: 0.2, ease: EASE_OUT } }}
              exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
              onDragOver={(event) => {
                if (!dnd.dragging || origin) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dnd.dragging) dnd.moveTo(dnd.dragging, column);
                dnd.setDragging(undefined);
              }}
              className={cn(
                "flex w-72 shrink-0 flex-col gap-2 rounded-lg bg-muted/50 p-2 transition-[box-shadow,opacity]",
                dnd.dragging && !origin && reachable && "ring-2 ring-primary/40",
                dnd.dragging && dnd.targets && !origin && !reachable && "opacity-50",
              )}
            >
              <h2 className="flex items-center justify-between gap-2 px-1 text-sm font-medium">
                <StatusIcon color={statusColor} />
                <span className="truncate">{column.name}</span>
                <span className="text-muted-foreground tabular-nums">
                  {issues.length === column.issues.length ? issues.length : `${issues.length}/${column.issues.length}`}
                </span>
                <span className="ml-auto">
                  <FilterMenu scope={scope} issues={column.issues} label={`Spalte ${column.name} filtern`} column />
                </span>
              </h2>
              {issues.map((issue) => (
                <IssueCard key={issue.id} issue={issue} columns={columns} dnd={dnd} />
              ))}
            </motion.section>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
