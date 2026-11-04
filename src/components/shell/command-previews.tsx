import { formatDistanceToNowStrict } from "date-fns";
import { de } from "date-fns/locale";
import { FunnelIcon, SquareKanbanIcon } from "lucide-react";
import { AdfContent } from "@/components/adf-content";
import { JiraStatusBadge } from "@/components/jira-status-badge";
import { JiraUserLabel } from "@/components/jira-user-avatar";
import { ProjectAvatar } from "@/components/shell/project-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { isJiraUser } from "@/lib/jira/user";
import { useJiraIssue, useJiraIssues, useJiraProjectBoards, type JiraProject } from "@/lib/jira/queries";

export function IssuePreview({ issueKey }: { issueKey: string }) {
  const issue = useJiraIssue(issueKey);
  if (issue.isPending) {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }
  if (!issue.data) return <p className="text-sm text-muted-foreground">Vorgang {issueKey} nicht gefunden.</p>;
  const { fields } = issue.data;
  const assignee = isJiraUser(fields.assignee) ? fields.assignee : null;
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">{issue.data.key}</span>
        <span>·</span>
        <span className="truncate">{fields.issuetype.name}</span>
      </div>
      <h3 className="text-sm font-semibold leading-snug text-foreground">{fields.summary}</h3>
      <div className="flex flex-wrap items-center gap-2">
        <JiraStatusBadge status={fields.status} />
        <span className="truncate text-xs text-muted-foreground">{fields.project.name}</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <JiraUserLabel user={assignee} />
      </div>
      <p className="text-xs text-muted-foreground">
        Aktualisiert {formatDistanceToNowStrict(new Date(fields.updated), { locale: de, addSuffix: true })}
      </p>
      {fields.description ? (
        <div className="relative max-h-40 overflow-hidden text-muted-foreground [mask-image:linear-gradient(to_bottom,black_70%,transparent)]">
          <AdfContent doc={fields.description} className="gap-2 text-xs" />
        </div>
      ) : null}
    </div>
  );
}

export function ProjectPreview({ project }: { project: JiraProject }) {
  const boards = useJiraProjectBoards(project.key);
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-3">
        <ProjectAvatar project={project} size="lg" />
        <div className="grid min-w-0">
          <span className="truncate text-sm font-semibold text-foreground">{project.name}</span>
          <span className="font-mono text-xs text-muted-foreground">{project.key}</span>
        </div>
      </div>
      <div className="grid gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Boards</span>
        {boards.isPending ? (
          <Skeleton className="h-5 w-2/3" />
        ) : boards.data?.values.length ? (
          boards.data.values.map((board) => (
            <span key={board.id} className="flex items-center gap-2 text-xs text-foreground">
              <SquareKanbanIcon className="size-3.5 text-muted-foreground" />
              <span className="truncate">{board.name}</span>
            </span>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">Keine Boards</span>
        )}
      </div>
    </div>
  );
}

export function FilterPreview({ id, name }: { id: string; name: string }) {
  const issues = useJiraIssues(`filter = ${id}`);
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <FunnelIcon className="size-4 text-muted-foreground" />
        <span className="truncate text-sm font-semibold text-foreground">{name}</span>
      </div>
      {issues.isPending ? (
        <div className="grid gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : issues.error ? (
        <p className="text-xs text-destructive">Filter konnte nicht geladen werden</p>
      ) : issues.data?.issues.length ? (
        <div className="grid gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {issues.data.issues.length >= 50 ? "50+" : issues.data.issues.length} Vorgänge
          </span>
          {issues.data.issues.slice(0, 6).map((issue) => (
            <div key={issue.id} className="grid gap-0.5 rounded-md bg-background px-2 py-1.5 ring-1 ring-border">
              <span className="truncate text-xs text-foreground">{issue.fields.summary}</span>
              <span className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                {issue.key}
                <span className="truncate font-sans">{issue.fields.status.name}</span>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Keine Vorgänge</p>
      )}
    </div>
  );
}

export function IssueKey({ value }: { value: string }) {
  return <span className="font-mono text-[10px] text-muted-foreground">{value}</span>;
}
