import type { ReactElement, ReactNode } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { de } from "date-fns/locale";
import { AnimatePresence, motion } from "motion/react";
import { CalendarIcon, ListChecksIcon, MessageSquareIcon, PaperclipIcon, TimerIcon } from "lucide-react";
import { JiraStatusBadge } from "@/components/jira-status-badge";
import { JiraUserAvatar, JiraUserLabel } from "@/components/jira-user-avatar";
import { Tooltip } from "@/components/motion/tooltip";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EASE_OUT } from "@/lib/ease";
import { fieldText } from "@/lib/jira/field-text";
import { type JiraIssueDetail, useJiraIssue } from "@/lib/jira/queries";

type PreviewUser = { displayName: string; avatarUrls: { "48x48": string } };

const PREVIEW_DELAY = 700;

const FADE = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15, ease: EASE_OUT } };

const isUser = (value: unknown): value is PreviewUser =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as PreviewUser).displayName === "string" &&
  typeof (value as PreviewUser).avatarUrls?.["48x48"] === "string";

const stringList = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);

const relative = (date: string) => formatDistanceToNowStrict(new Date(date), { locale: de, addSuffix: true });

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[0.65rem] tracking-wide text-muted-foreground uppercase">{label}</span>
      <span className="truncate font-normal">{children}</span>
    </span>
  );
}

function Count({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1 [&_svg]:size-3.5">
      {icon}
      {children}
    </span>
  );
}

function PreviewBody({ issue }: { issue: JiraIssueDetail }) {
  const { fields } = issue;
  const assignee = isUser(fields.assignee) ? fields.assignee : null;
  const reporter = isUser(fields.reporter) ? fields.reporter : null;
  const priority = fieldText(fields.priority);
  const duedate = typeof fields.duedate === "string" ? fields.duedate : undefined;
  const labels = stringList(fields.labels);
  const description = fields.description ? fieldText(fields.description) : "";
  const subtasks = fields.subtasks ?? [];
  const doneSubtasks = subtasks.filter((subtask) => subtask.fields.status.statusCategory.key === "done").length;
  const comments = fields.comment?.comments ?? [];
  const lastComment = comments.at(-1);
  const attachments = fields.attachment?.length ?? 0;
  const timeSpent = fields.timetracking?.timeSpent;

  return (
    <span className="flex flex-col gap-3">
      <span className="flex items-center gap-2 text-muted-foreground">
        <span className="truncate">{fields.project.name}</span>
        <span>·</span>
        <span className="font-mono">{issue.key}</span>
        <span>·</span>
        <span className="truncate">{fields.issuetype.name}</span>
        <JiraStatusBadge status={fields.status} className="ml-auto shrink-0" />
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-base font-semibold leading-snug">{fields.summary}</span>
        {fields.parent && (
          <span className="truncate font-normal text-muted-foreground">
            <span className="font-mono">{fields.parent.key}</span> {fields.parent.fields.summary}
          </span>
        )}
      </span>
      {description && <span className="line-clamp-6 font-normal leading-relaxed text-muted-foreground">{description}</span>}
      <span className="grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-border pt-3">
        <Meta label="Zugewiesen">
          <JiraUserLabel user={assignee} />
        </Meta>
        <Meta label="Gemeldet von">
          <JiraUserLabel user={reporter} />
        </Meta>
        <Meta label="Priorität">{priority || "–"}</Meta>
        <Meta label="Fällig">
          {duedate ? (
            <span className="flex items-center gap-1">
              <CalendarIcon className="size-3.5" />
              {new Date(duedate).toLocaleDateString("de-DE")}
            </span>
          ) : (
            "–"
          )}
        </Meta>
        <Meta label="Erstellt">{relative(fields.created)}</Meta>
        <Meta label="Aktualisiert">{relative(fields.updated)}</Meta>
      </span>
      {labels.length > 0 && (
        <span className="flex flex-wrap gap-1">
          {labels.map((label) => (
            <Badge key={label} variant="outline">
              {label}
            </Badge>
          ))}
        </span>
      )}
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 font-normal text-muted-foreground">
        {subtasks.length > 0 && (
          <Count icon={<ListChecksIcon />}>
            {doneSubtasks}/{subtasks.length} Unteraufgaben
          </Count>
        )}
        <Count icon={<MessageSquareIcon />}>{comments.length}</Count>
        <Count icon={<PaperclipIcon />}>{attachments}</Count>
        {timeSpent && <Count icon={<TimerIcon />}>{timeSpent}</Count>}
      </span>
      {lastComment && (
        <span className="flex gap-2 rounded-md bg-muted/60 p-2 font-normal">
          {lastComment.author && <JiraUserAvatar user={lastComment.author} />}
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-muted-foreground">
              {lastComment.author?.displayName ?? "Unbekannt"} · {relative(lastComment.created)}
            </span>
            <span className="line-clamp-2">{fieldText(lastComment.body)}</span>
          </span>
        </span>
      )}
    </span>
  );
}

function IssuePreview({ issueKey }: { issueKey: string }) {
  const issue = useJiraIssue(issueKey);

  return (
    <span className="flex w-[28rem] max-w-full flex-col py-1 text-left">
      <AnimatePresence mode="wait" initial={false}>
        {issue.data ? (
          <motion.span key="data" {...FADE} className="flex flex-col">
            <PreviewBody issue={issue.data} />
          </motion.span>
        ) : (
          <motion.span key="loading" {...FADE} className="flex flex-col gap-3">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
            <span className="grid grid-cols-2 gap-3">
              <Skeleton className="h-8" />
              <Skeleton className="h-8" />
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

export function IssuePreviewTooltip({ issueKey, children }: { issueKey: string; children: ReactElement }) {
  return (
    <Tooltip
      followCursor
      delay={PREVIEW_DELAY}
      side="bottom"
      align="start"
      className="max-w-[min(30rem,calc(100vw-16px))] rounded-xl px-4 py-3 shadow-xl"
      content={<IssuePreview issueKey={issueKey} />}
    >
      {children}
    </Tooltip>
  );
}
