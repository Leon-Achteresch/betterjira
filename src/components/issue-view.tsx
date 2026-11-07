import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNowStrict } from "date-fns";
import { de } from "date-fns/locale";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { ChevronRightIcon } from "lucide-react";
import { CreateBranchDialog } from "@/components/development/create-branch-dialog";
import { IssueDevelopment } from "@/components/development/issue-development";
import { IssueComments } from "@/components/issue-comments";
import { IssueDrawer, type IssueDrawerTab } from "@/components/issue-drawer";
import { EditableField, FieldValue, richFieldIds } from "@/components/issue-fields";
import { IssueStatusMenu } from "@/components/issue-status-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { IssueActions } from "@/components/issues/issue-actions";
import { IssueLinksPanel } from "@/components/issues/issue-links-panel";
import { RemoteLinksPanel } from "@/components/issues/remote-links-panel";
import { IssueSubtasks } from "@/components/issues/issue-subtasks";
import { useIssueReadingPosition } from "@/hooks/use-issue-reading-position";
import { useIssueActions } from "@/hooks/use-issue-actions";
import { useIssueDevelopmentPanel } from "@/hooks/scm/use-issue-development-panel";
import { useIssueLinks } from "@/hooks/jira/use-issue-links";
import { useRemoteLinks } from "@/hooks/jira/use-remote-links";
import { EASE_OUT } from "@/lib/ease";
import { useJiraIssue, useJiraSite, type JiraIssueDetail } from "@/lib/jira/queries";
import { cn } from "@/lib/utils";

const VITALS = ["assignee", "reporter", "priority", "duedate", "labels"];

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

function Property({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn("flex min-w-32 flex-col gap-1", wide && "hidden @5xl:flex")}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function Vitals({ issue }: { issue: JiraIssueDetail }) {
  const ids = VITALS.filter((id) => id in issue.fields || id in issue.editmeta.fields);
  return (
    <dl className="flex flex-wrap items-start gap-x-8 gap-y-3 border-y py-3 @5xl:flex-col @5xl:flex-nowrap @5xl:items-stretch @5xl:gap-y-5 @5xl:border-y-0 @5xl:border-l @5xl:py-1 @5xl:pl-8">
      <Property label="Status">
        <IssueStatusMenu issueKey={issue.key} status={issue.fields.status} />
      </Property>
      {ids.map((id) => (
        <Property key={id} label={issue.editmeta.fields[id]?.name ?? issue.names[id] ?? id}>
          <EditableField issue={issue} id={id}>
            <FieldValue value={issue.fields[id]} />
          </EditableField>
        </Property>
      ))}
      <Property label="Aktualisiert" wide>
        <span title={new Date(issue.fields.updated).toLocaleString("de-DE")}>
          {formatDistanceToNowStrict(new Date(issue.fields.updated), { locale: de, addSuffix: true })}
        </span>
      </Property>
      <Property label="Erstellt" wide>
        {new Date(issue.fields.created).toLocaleDateString("de-DE", { dateStyle: "medium" })}
      </Property>
    </dl>
  );
}

const LAYOUT = {
  article: "mx-auto grid w-full max-w-4xl gap-y-8 @5xl:max-w-none @5xl:grid-cols-[minmax(0,1fr)_17rem] @5xl:gap-x-12",
  bar: "@5xl:col-span-2 @5xl:row-start-1",
  header: "min-w-0 @5xl:col-start-1 @5xl:row-start-2",
  aside: "@5xl:sticky @5xl:top-16 @5xl:col-start-2 @5xl:row-span-2 @5xl:row-start-2 @5xl:self-start",
  body: "flex min-w-0 flex-col gap-10 @5xl:col-start-1 @5xl:row-start-3",
};

function IssueViewSkeleton() {
  return (
    <div aria-busy aria-label="Ticket wird geladen" className={LAYOUT.article}>
      <Skeleton className={cn(LAYOUT.bar, "h-9 w-full")} />
      <div className={cn(LAYOUT.header, "flex flex-col gap-2")}>
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-2/3" />
      </div>
      <div className={LAYOUT.aside}>
        <div className="flex flex-wrap gap-x-8 gap-y-5 border-y py-3 @5xl:flex-col @5xl:border-y-0 @5xl:border-l @5xl:py-1 @5xl:pl-8">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-32" />
            </div>
          ))}
        </div>
      </div>
      <div className={cn(LAYOUT.body, "gap-3")}>
        <Skeleton className="h-3 w-24" />
        {["w-full", "w-11/12", "w-full", "w-3/4", "w-5/6"].map((width, index) => (
          <Skeleton key={index} className={cn("h-4", width)} />
        ))}
      </div>
    </div>
  );
}

export function IssueView({ issueKey, initialTab }: { issueKey: string; initialTab?: IssueDrawerTab }) {
  const site = useJiraSite();
  const issue = useJiraIssue(issueKey);
  const reduce = useReducedMotion();
  useIssueReadingPosition(issueKey, !!issue.data);
  const actions = useIssueActions(issue.data, site.data?.siteUrl, initialTab);
  const links = useIssueLinks(issueKey);
  const remoteLinks = useRemoteLinks(issueKey);
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
  if (!issue.data) return <IssueViewSkeleton />;
  const { fields } = issue.data;
  const subtasks = fields.subtasks ?? [];
  const comments = fields.comment?.comments ?? [];

  return (
    <motion.article variants={container} initial="hidden" animate="show" className={LAYOUT.article}>
      <motion.div
        variants={reveal(reduce)}
        className={cn(LAYOUT.bar, "sticky top-0 z-20 -mx-2 flex flex-wrap items-center gap-1.5 border-b border-border/60 bg-background px-2 py-2 text-sm text-muted-foreground")}
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
      <motion.header variants={reveal(reduce)} className={cn(LAYOUT.header, "flex flex-col gap-5")}>
        <EditableField issue={issue.data} id="summary">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">{fields.summary}</h1>
        </EditableField>

        <p className="text-xs text-muted-foreground @5xl:hidden">
          aktualisiert {formatDistanceToNowStrict(new Date(fields.updated), { locale: de, addSuffix: true })} · erstellt{" "}
          {new Date(fields.created).toLocaleDateString("de-DE", { dateStyle: "medium" })}
        </p>
      </motion.header>

      <motion.aside variants={reveal(reduce)} aria-label="Eigenschaften" className={LAYOUT.aside}>
        <Vitals issue={issue.data} />
      </motion.aside>

      <div className={LAYOUT.body}>
        <Section title="Beschreibung">
          <EditableField issue={issue.data} id="description" className="text-[0.95rem] leading-relaxed">
            {fields.description ? (
              <FieldValue value={fields.description} />
            ) : (
              <p className="text-sm text-muted-foreground">Keine Beschreibung.</p>
            )}
          </EditableField>
        </Section>

        {subtasks.length > 0 && (
          <Section title="Unteraufgaben">
            <IssueSubtasks key={issue.data.key} subtasks={subtasks} />
          </Section>
        )}

        <Section title={links.summary ? `Verknüpfungen · ${links.summary.total}` : "Verknüpfungen"}>
          <IssueLinksPanel
            summary={links.summary}
            error={links.error}
            refreshError={links.refreshError}
            retrying={links.retrying}
            onRetry={links.retry}
          />
        </Section>

        <motion.div variants={reveal(reduce)}>
          <RemoteLinksPanel {...remoteLinks} />
        </motion.div>

        <Section title={`Kommentare · ${comments.length}`}>
          <IssueComments key={issue.data.key} issueKey={issue.data.key} comments={comments} />
        </Section>
      </div>

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
