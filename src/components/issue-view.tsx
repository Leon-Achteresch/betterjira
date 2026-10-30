import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { openUrl } from "@tauri-apps/plugin-opener";
import { formatDistanceToNowStrict } from "date-fns";
import { de } from "date-fns/locale";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { ArrowUpRightIcon, ChevronRightIcon, LinkIcon, PaperclipIcon, SlidersHorizontalIcon, TimerIcon } from "lucide-react";
import { toast } from "sonner";
import { IssueComments } from "@/components/issue-comments";
import { IssueDrawer, type IssueDrawerTab } from "@/components/issue-drawer";
import { EditableField, FieldValue, richFieldIds } from "@/components/issue-fields";
import { IssueStatusMenu } from "@/components/issue-status-menu";
import { JiraStatusBadge } from "@/components/jira-status-badge";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { EASE_OUT } from "@/lib/ease";
import { useJiraIssue, useJiraSite, type JiraIssueDetail } from "@/lib/jira/queries";
import { cn } from "@/lib/utils";

const VITALS = ["assignee", "priority", "duedate"];

const container: Variants = { show: { transition: { staggerChildren: 0.03 } } };

const reveal = (reduce: boolean | null): Variants => ({
  hidden: { opacity: 0, y: reduce ? 0 : 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE_OUT } },
});

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      variants={reveal(reduce)}
      className="flex flex-col gap-3"
    >
      <div className="flex items-center gap-3">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>
        {aside}
      </div>
      {children}
    </motion.section>
  );
}

function ToolButton({
  label,
  count,
  active,
  onClick,
  children,
}: {
  label: string;
  count?: number;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip content={label} side="bottom">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={count ? `${label} (${count})` : label}
        onClick={onClick}
        className={cn("relative text-muted-foreground hover:text-foreground", active && "bg-primary/12 text-foreground")}
      >
        {children}
        {!!count && (
          <span className="absolute -top-0.5 -right-0.5 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground tabular-nums">
            {count}
          </span>
        )}
      </Button>
    </Tooltip>
  );
}

function Vitals({ issue }: { issue: JiraIssueDetail }) {
  const ids = VITALS.filter((id) => id in issue.fields || id in issue.editmeta.fields);
  return (
    <dl className="flex flex-wrap items-start gap-x-8 gap-y-3 border-y py-3">
      <div className="flex flex-col gap-1">
        <dt className="text-xs text-muted-foreground">Status</dt>
        <dd>
          <IssueStatusMenu issueKey={issue.key} status={issue.fields.status} />
        </dd>
      </div>
      {ids.map((id) => (
        <div key={id} className="flex min-w-32 flex-col gap-1">
          <dt className="text-xs text-muted-foreground">{issue.editmeta.fields[id]?.name ?? issue.names[id] ?? id}</dt>
          <dd className="text-sm">
            <EditableField issue={issue} id={id}>
              <FieldValue value={issue.fields[id]} />
            </EditableField>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Subtasks({ subtasks }: { subtasks: NonNullable<JiraIssueDetail["fields"]["subtasks"]> }) {
  const done = subtasks.filter((subtask) => subtask.fields.status.statusCategory.key === "done").length;
  return (
    <Section
      title="Unteraufgaben"
      aside={
        <span className="flex flex-1 items-center gap-3 text-xs text-muted-foreground tabular-nums">
          {done}/{subtasks.length}
          <Progress value={(done / subtasks.length) * 100} className="h-1 max-w-32" />
        </span>
      }
    >
      <ul className="-mx-2 flex flex-col">
        {subtasks.map((subtask) => (
          <li key={subtask.id}>
            <Link
              to="/issue/$key"
              params={{ key: subtask.key }}
              className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-4 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
            >
              <span className="font-mono text-xs text-muted-foreground">{subtask.key}</span>
              <span className="truncate">{subtask.fields.summary}</span>
              <JiraStatusBadge status={subtask.fields.status} />
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function IssueView({ issueKey }: { issueKey: string }) {
  const site = useJiraSite();
  const issue = useJiraIssue(issueKey);
  const reduce = useReducedMotion();
  const [drawer, setDrawer] = useState(false);
  const [tab, setTab] = useState<IssueDrawerTab>("details");

  if (issue.error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {issue.error.message}
      </p>
    );
  }
  if (!issue.data) return <Spinner />;
  const { fields } = issue.data;
  const subtasks = fields.subtasks ?? [];
  const comments = fields.comment?.comments ?? [];
  const url = site.data && `${site.data.siteUrl}/browse/${issue.data.key}`;
  const show = (next: IssueDrawerTab) => {
    setTab(next);
    setDrawer(true);
  };

  return (
    <motion.article variants={container} initial="hidden" animate="show" className="flex flex-col gap-10">
      <motion.header
        variants={reveal(reduce)}
        className="flex flex-col gap-5"
      >
        <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <Link to="/bereiche/$key" params={{ key: fields.project.key }} className="transition-colors hover:text-foreground">
            {fields.project.name}
          </Link>
          {fields.parent && (
            <>
              <ChevronRightIcon className="size-3.5 opacity-50" />
              <Link
                to="/issue/$key"
                params={{ key: fields.parent.key }}
                title={fields.parent.fields.summary}
                className="font-mono text-xs transition-colors hover:text-foreground"
              >
                {fields.parent.key}
              </Link>
            </>
          )}
          <ChevronRightIcon className="size-3.5 opacity-50" />
          <span className="font-mono text-xs text-foreground">{issue.data.key}</span>
          <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs">{fields.issuetype.name}</span>

          <div className="ml-auto flex items-center gap-0.5">
            <ToolButton label="Alle Felder" active={drawer && tab === "details"} onClick={() => show("details")}>
              <SlidersHorizontalIcon />
            </ToolButton>
            <ToolButton
              label="Anhänge"
              count={fields.attachment?.length}
              active={drawer && tab === "attachments"}
              onClick={() => show("attachments")}
            >
              <PaperclipIcon />
            </ToolButton>
            <ToolButton
              label={fields.timetracking?.timeSpent ? `Zeiterfassung · ${fields.timetracking.timeSpent}` : "Zeiterfassung"}
              active={drawer && tab === "time"}
              onClick={() => show("time")}
            >
              <TimerIcon />
            </ToolButton>
            {url && (
              <>
                <span className="mx-1 h-4 w-px bg-border" />
                <ToolButton
                  label="Link kopieren"
                  onClick={() =>
                    void navigator.clipboard.writeText(url).then(
                      () => toast.success("Link kopiert"),
                      () => toast.error("Link konnte nicht kopiert werden"),
                    )
                  }
                >
                  <LinkIcon />
                </ToolButton>
                <ToolButton label="In Jira öffnen" onClick={() => void openUrl(url)}>
                  <ArrowUpRightIcon />
                </ToolButton>
              </>
            )}
          </div>
        </div>

        <EditableField issue={issue.data} id="summary">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">{fields.summary}</h1>
        </EditableField>

        <Vitals issue={issue.data} />

        <p className="text-xs text-muted-foreground">
          aktualisiert {formatDistanceToNowStrict(new Date(fields.updated), { locale: de, addSuffix: true })} · erstellt{" "}
          {new Date(fields.created).toLocaleDateString("de-DE", { dateStyle: "medium" })}
        </p>
      </motion.header>

      <Section title="Beschreibung">
        <EditableField issue={issue.data} id="description" className="text-[0.95rem] leading-relaxed">
          {fields.description ? (
            <FieldValue value={fields.description} />
          ) : (
            <p className="text-sm text-muted-foreground">Keine Beschreibung.</p>
          )}
        </EditableField>
      </Section>

      {richFieldIds(issue.data).map((id) => (
        <Section key={id} title={issue.data.names[id] ?? id}>
          <EditableField issue={issue.data} id={id}>
            <FieldValue value={fields[id]} />
          </EditableField>
        </Section>
      ))}

      {subtasks.length > 0 && <Subtasks subtasks={subtasks} />}

      <Section title={`Kommentare · ${comments.length}`}>
        <IssueComments issueKey={issue.data.key} comments={comments} />
      </Section>

      <IssueDrawer issue={issue.data} open={drawer} tab={tab} onOpenChange={setDrawer} onTabChange={setTab} />
    </motion.article>
  );
}
