import { type ReactNode, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMutationState, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useTransitionFlow } from "@/components/issue-status-menu";
import { ArrowRightLeftIcon, BookmarkIcon, CalendarIcon, ClockIcon, FilterIcon, FlagIcon, ListChecksIcon, TagIcon, Trash2Icon, UserRoundIcon } from "lucide-react";
import { JiraUserAvatar } from "@/components/jira-user-avatar";
import { ProjectAvatar } from "@/components/shell/project-avatar";
import { IssueTable } from "@/components/issue-table";
import { IssuePreviewTooltip } from "@/components/issues/issue-preview";
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
  EMPTY_FILTER,
  EMPTY_VIEWS,
  FILTER_FIELDS,
  type FilterField,
  type FilterValues,
  UNASSIGNED,
  filterCount,
  matchesFilter,
} from "@/lib/board-filters";
import { useBoardFilters } from "@/hooks/use-board-filters";
import { EASE_OUT } from "@/lib/ease";
import {
  BACKLOG,
  type BoardSprint,
  type JiraBoard,
  type JiraSprint,
  type JiraTransitionRequest,
  transitionsQuery,
  useJiraBacklogJql,
  useJiraBoard,
  useJiraBoardSprints,
  useJiraProjectBoards,
  useJiraProjects,
  useJiraSite,
  useJiraTransitions,
} from "@/lib/jira/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bereiche/$key")({
  validateSearch: (search: Record<string, unknown>): { board?: number; sprint?: BoardSprint } => ({
    ...(typeof search.board === "number" && { board: search.board }),
    ...((typeof search.sprint === "number" || search.sprint === BACKLOG) && { sprint: search.sprint }),
  }),
  component: Bereich,
});

function Bereich() {
  const { key } = Route.useParams();
  const { board: boardId, sprint: sprintId } = Route.useSearch();
  const navigate = Route.useNavigate();
  const site = useJiraSite();
  const projects = useJiraProjects();
  const boards = useJiraProjectBoards(key);
  const project = projects.data?.find((p) => p.key === key);
  const board = boards.data?.values.find((b) => b.id === boardId);
  const title = (
    <div className="flex min-w-0 items-center gap-2">
      {project && <ProjectAvatar project={project} />}
      <h1 className="truncate text-lg font-semibold">{project?.name ?? key}</h1>
      <span className="truncate text-sm text-muted-foreground">
        {boardId === undefined ? `${key} · Alle Vorgänge` : `${key} · ${board?.name ?? ""}`}
      </span>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 p-6">
      {!board && title}
      {!site.isPending && !site.data ? (
        <p className="text-muted-foreground">Melde dich auf der Startseite an, um Bereiche zu sehen.</p>
      ) : boardId === undefined ? (
        <IssueTable key={key} jql={`project = "${key}" ORDER BY updated DESC`} />
      ) : boards.error ? (
        <p role="alert" className="text-sm text-destructive">
          Boards konnten nicht geladen werden: {boards.error.message}
        </p>
      ) : board ? (
        <Board
          key={board.id}
          board={board}
          title={title}
          sprintId={sprintId}
          onSprintChange={(sprint) => navigate({ search: (prev) => ({ ...prev, sprint }) })}
        />
      ) : boards.isPending ? (
        <Spinner />
      ) : (
        <p className="text-muted-foreground">Board nicht gefunden.</p>
      )}
    </div>
  );
}

const sprintDate = (date?: string) =>
  date ? new Date(date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "?";

const DAY_MS = 86_400_000;

const daysSince = (date: string) => Math.max(0, Math.floor((Date.now() - new Date(date).getTime()) / DAY_MS));

const HIGH_PRIORITY = /highest|high|critical|blocker|kritisch|hoch|dringend/i;

type BoardColumn = NonNullable<ReturnType<typeof useJiraBoard>["data"]>[number]["columns"][number];
type BoardCard = BoardColumn["issues"][number];

type BoardDnd = {
  dragging?: BoardCard;
  setDragging: (issue?: BoardCard) => void;
  targets?: Set<string>;
  moving: string[];
  moveTo: (issue: BoardCard, column: BoardColumn) => void;
};

const cardValues = ({ fields }: BoardCard): FilterValues => ({
  assignee: [fields.assignee?.displayName ?? UNASSIGNED],
  issuetype: [fields.issuetype.name],
  priority: fields.priority ? [fields.priority.name] : [],
  label: fields.labels ?? [],
});

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
  const moving = dnd.moving.includes(issue.key);
  const days = daysSince(issue.inColumnSince);
  const subtasks = fields.subtasks ?? [];
  const doneSubtasks = subtasks.filter((subtask) => subtask.fields.status.statusCategory.key === "done").length;
  const overdue = !!fields.duedate && fields.duedate < new Date().toISOString().slice(0, 10);

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
        "relative cursor-grab transition-[background-color,opacity] hover:bg-muted/50 active:cursor-grabbing",
        (moving || dnd.dragging?.key === issue.key) && "opacity-50",
      )}
    >
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{issue.key}</span>
          <span className="truncate">{fields.issuetype.name}</span>
          {issue.flagged && <FlagIcon aria-label="Markiert" className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />}
          <span className="ml-auto tabular-nums" title="Rang im Board">
            #{issue.rank}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" className="relative z-10 -my-1" aria-label={`${issue.key} in andere Spalte verschieben`} disabled={moving}>
                {moving ? <Spinner /> : <ArrowRightLeftIcon />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-40">
              <DropdownMenuLabel>Verschieben nach</DropdownMenuLabel>
              {columns
                .filter((column) => !column.statusIds.includes(fields.status.id))
                .map((column) => (
                  <DropdownMenuItem key={column.name} onSelect={() => dnd.moveTo(issue, column)}>
                    {column.name}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Link to="/issue/$key" params={{ key: issue.key }} draggable={false} className="line-clamp-3 outline-none after:absolute after:inset-0 after:rounded-[inherit] focus-visible:after:ring-2 focus-visible:after:ring-ring">
          {fields.summary}
        </Link>
        {fields.parent && (
          <p className="truncate text-xs text-muted-foreground" title={fields.parent.key}>
            {fields.parent.fields.summary}
          </p>
        )}
        {fields.labels && fields.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {fields.labels.map((label) => (
              <Badge key={label} variant="outline">
                {label}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {fields.priority && (
            <Badge variant={HIGH_PRIORITY.test(fields.priority.name) ? "destructive" : "secondary"}>
              {fields.priority.name}
            </Badge>
          )}
          {issue.points !== undefined && (
            <Badge variant="secondary" title="Story Points">
              {issue.points} SP
            </Badge>
          )}
          {subtasks.length > 0 && (
            <span className="flex items-center gap-1" title="Erledigte Unteraufgaben">
              <ListChecksIcon className="size-3.5" />
              {doneSubtasks}/{subtasks.length}
            </span>
          )}
          {fields.duedate && (
            <span className={cn("flex items-center gap-1", overdue && "text-destructive")} title="Fälligkeit">
              <CalendarIcon className="size-3.5" />
              {sprintDate(fields.duedate)}
            </span>
          )}
          <span
            className={cn("flex items-center gap-1", days >= 7 && "text-warning")}
            title={`In dieser Spalte seit ${sprintDate(issue.inColumnSince)}`}
          >
            <ClockIcon className="size-3.5" />
            {days === 1 ? "1 Tag" : `${days} Tage`}
          </span>
          {fields.assignee && (
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
  const allIssues = data.flatMap(({ columns }) => columns.flatMap((column) => column.issues));
  const single = data.length === 1;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-w-0 items-center gap-4">
        {title}
        <SprintPicker board={board} sprintId={sprintId} onChange={onSprintChange} />
        {single && data[0].sprint && <SprintInfo sprint={data[0].sprint} named={board.type !== "scrum"} />}
        {!backlog && (
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <ViewMenu board={String(board.id)} />
            <FilterMenu scope={String(board.id)} issues={allIssues} label="Board filtern" />
          </div>
        )}
      </div>
      {backlog ? (
        backlogJql.error ? (
          <p role="alert" className="text-sm text-destructive">
            {backlogJql.error.message}
          </p>
        ) : backlogJql.data ? (
          <IssueTable jql={backlogJql.data} />
        ) : (
          <Spinner />
        )
      ) : sprints.error ? (
        <p role="alert" className="text-sm text-destructive">
          {sprints.error.message}
        </p>
      ) : !sprints.data ? (
        <Spinner />
      ) : data.length === 0 ? (
        <p className="text-muted-foreground">{sprintId === undefined ? "Kein aktiver Sprint." : "Keine Vorgänge in diesem Sprint."}</p>
      ) : null}
      {!backlog && data.map(({ sprint, columns }) => (
        <div key={sprint?.id ?? "board"} className="flex flex-col gap-2">
          {!single && sprint && <SprintInfo sprint={sprint} named />}
          <BoardColumns boardId={board.id} columns={columns} dnd={dnd} />
        </div>
      ))}
      {flow.dialog}
    </div>
  );
}

function BoardColumns({ boardId, columns, dnd }: { boardId: number; columns: BoardColumn[]; dnd: BoardDnd }) {
  const filters = useBoardFilters((state) => state.filters);
  const ignoreBoard = useBoardFilters((state) => state.ignoreBoard);
  const boardFilter = filters[boardId] ?? EMPTY_FILTER;
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((column) => {
        const scope = `${boardId}:${column.name}`;
        const columnFilter = filters[scope] ?? EMPTY_FILTER;
        const issues = column.issues.filter((issue) => {
          const values = cardValues(issue);
          return (ignoreBoard[scope] || matchesFilter(boardFilter, values)) && matchesFilter(columnFilter, values);
        });
        const origin = !!dnd.dragging && column.statusIds.includes(dnd.dragging.fields.status.id);
        const reachable = !!dnd.targets && column.statusIds.some((id) => dnd.targets!.has(id));
        return (
          <section
            key={column.name}
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
            <h2 className="flex items-center justify-between gap-2 px-1 text-xs font-medium uppercase text-muted-foreground">
              <span className="truncate">{column.name}</span>
              <span className="ml-auto tabular-nums">
                {issues.length === column.issues.length ? issues.length : `${issues.length}/${column.issues.length}`}
              </span>
              <FilterMenu scope={scope} issues={column.issues} label={`Spalte ${column.name} filtern`} column />
            </h2>
            {issues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} columns={columns} dnd={dnd} />
            ))}
          </section>
        );
      })}
    </div>
  );
}
