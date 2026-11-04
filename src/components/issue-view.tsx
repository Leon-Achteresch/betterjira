import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNowStrict } from "date-fns";
import { de } from "date-fns/locale";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { ChevronRightIcon } from "lucide-react";
import { CreateBranchDialog } from "@/components/development/create-branch-dialog";
import { IssueDevelopment } from "@/components/development/issue-development";
import { IssueComments } from "@/components/issue-comments";
import { IssueDrawer } from "@/components/issue-drawer";
import { EditableField, FieldValue, richFieldIds } from "@/components/issue-fields";
import { IssueStatusMenu } from "@/components/issue-status-menu";
import { JiraStatusBadge } from "@/components/jira-status-badge";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { IssueActions } from "@/components/issues/issue-actions";
import { useIssueReadingPosition } from "@/hooks/use-issue-reading-position";
import { useIssueActions } from "@/hooks/use-issue-actions";
import { useIssueDevelopmentPanel } from "@/hooks/scm/use-issue-development-panel";
import { EASE_OUT } from "@/lib/ease";
import { useJiraIssue, useJiraSite, type JiraIssueDetail } from "@/lib/jira/queries";

const VITALS = ["assignee", "priority", "duedate"];

const container: Variants = { show: { transition: { staggerChildren: 0.03 } } };

const reveal = (reduce: boolean | null): Variants => ({
  hidden: { opacity: 0, y: reduce ? 0 : 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE_OUT } },
});

function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.section variants={reveal(reduce)} className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>
        {aside}
      </div>
      {children}
    </motion.section>
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
  useIssueReadingPosition(issueKey, !!issue.data);
  const actions = useIssueActions(issue.data, site.data?.siteUrl);
  const development = useIssueDevelopmentPanel(
    issueKey,
    issue.data && { projectKey: issue.data.fields.project.key, summary: issue.data.fields.summary },
  );

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

  return (
    <motion.article variants={container} initial="hidden" animate="show" className="flex flex-col gap-10">
      <motion.div
        variants={reveal(reduce)}
        className="sticky top-0 z-20 -mx-2 flex flex-wrap items-center gap-1.5 border-b border-border/60 bg-background px-2 py-2 text-sm text-muted-foreground"
      >
        <Link
          to="/bereiche/$key"
          params={{ key: fields.project.key }}
          className="transition-colors hover:text-foreground"
        >
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

        <IssueActions
          actions={actions}
          attachmentCount={fields.attachment?.length ?? 0}
          timeSpent={fields.timetracking?.timeSpent}
        />
      </motion.div>
      <motion.header variants={reveal(reduce)} className="flex flex-col gap-5">
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

      {subtasks.length > 0 && <Subtasks subtasks={subtasks} />}

      <Section title={`Kommentare · ${comments.length}`}>
        <IssueComments key={issue.data.key} issueKey={issue.data.key} comments={comments} />
      </Section>

      <IssueDrawer
        key={issue.data.key}
        issue={issue.data}
        open={actions.drawer}
        tab={actions.tab}
        onOpenChange={actions.setDrawer}
        onTabChange={actions.setTab}
        onCloseAutoFocus={actions.restoreFocus}
        extraFields={richFieldIds(issue.data).map((id) => (
          <Section key={id} title={issue.data.names[id] ?? id}>
            <EditableField issue={issue.data} id={id}>
              <FieldValue value={fields[id]} />
            </EditableField>
          </Section>
        ))}
        development={<IssueDevelopment {...development.panel} projectName={fields.project.name} />}
      />
      <CreateBranchDialog {...development.branchDialog} />
    </motion.article>
  );
}
