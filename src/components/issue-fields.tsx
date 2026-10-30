import { useState, type FormEvent, type ReactNode } from "react";
import { PencilIcon } from "lucide-react";
import { AdfContent, ExternalLink, safeUrl } from "@/components/adf-content";
import { encode, initialValue, jiraErrors, JiraFieldInput, kindOf } from "@/components/jira-field-input";
import { JiraUserLabel } from "@/components/jira-user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useJiraEditIssue, useJiraEditIssueWiki, useJiraWikiField } from "@/lib/jira/issue";
import type { JiraIssueDetail } from "@/lib/jira/queries";
import { cn } from "@/lib/utils";

const HIDDEN = new Set([
  "summary",
  "description",
  "status",
  "project",
  "parent",
  "subtasks",
  "comment",
  "attachment",
  "worklog",
  "issuelinks",
  "timetracking",
  "timeoriginalestimate",
  "aggregatetimeoriginalestimate",
  "timeestimate",
  "aggregatetimeestimate",
  "timespent",
  "aggregatetimespent",
  "progress",
  "aggregateprogress",
  "workratio",
  "lastViewed",
  "watches",
  "votes",
  "statuscategorychangedate",
  "statusCategory",
  "thumbnail",
  "issuerestriction",
  "security",
]);

const FIRST = ["assignee", "reporter", "priority", "labels", "duedate", "components", "fixVersions", "versions", "issuetype", "resolution"];
const LAST = ["creator", "created", "updated", "resolutiondate"];

const isAdf = (value: unknown) => typeof value === "object" && value !== null && (value as { type?: unknown }).type === "doc";

const isUser = (value: unknown): value is { displayName: string; avatarUrls: { "48x48": string } } =>
  typeof value === "object" && value !== null && "displayName" in value && "avatarUrls" in value;

const blank = (value: unknown) => value == null || value === "" || (Array.isArray(value) && value.length === 0);

const labelOf = (value: object): string | undefined => {
  const { name, value: optionValue, key, child } = value as { name?: unknown; value?: unknown; key?: unknown; child?: object | null };
  const label = [name, optionValue, key].find((item) => typeof item === "string") as string | undefined;
  const childLabel = child ? labelOf(child) : undefined;
  return label && childLabel ? `${label} › ${childLabel}` : label;
};

type DevOverall = { count?: number; state?: string; failedBuildCount?: number };

const DEV_LABELS: Record<string, string> = {
  pullrequest: "Pull Requests",
  build: "Builds",
  branch: "Branches",
  repository: "Commits",
  review: "Reviews",
  "deployment-environment": "Deployments",
};

const DEV_STATES: Record<string, string> = { OPEN: "offen", MERGED: "gemergt", DECLINED: "abgelehnt" };

const devSummary = (value: string) => {
  const json = /json=(\{.*\})\}$/s.exec(value)?.[1];
  if (!json) return undefined;
  try {
    const summary = (JSON.parse(json) as { cachedValue?: { summary?: Record<string, { overall?: DevOverall }> } }).cachedValue?.summary;
    return summary && Object.entries(summary).flatMap(([type, { overall }]) => (overall?.count ? [{ type, ...overall }] : []));
  } catch {
    return undefined;
  }
};

function DevSummary({ items }: { items: (DevOverall & { type: string })[] }) {
  if (items.length === 0) return <span className="text-muted-foreground">–</span>;
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((item) => (
        <li key={item.type}>
          <span className="tabular-nums">{item.count}</span> {DEV_LABELS[item.type] ?? item.type}
          {item.type === "build" ? (
            item.failedBuildCount ? (
              <span className="text-destructive"> · {item.failedBuildCount} fehlgeschlagen</span>
            ) : (
              <span className="text-muted-foreground"> · erfolgreich</span>
            )
          ) : (
            item.state && <span className="text-muted-foreground"> · {DEV_STATES[item.state] ?? item.state.toLowerCase()}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function FieldValue({ value }: { value: unknown }) {
  if (blank(value) || value === "{}") return <span className="text-muted-foreground">–</span>;
  const dev = typeof value === "string" ? devSummary(value) : undefined;
  if (dev) return <DevSummary items={dev} />;
  if (isAdf(value)) return <AdfContent doc={value} />;
  if (isUser(value)) return <JiraUserLabel user={value} />;
  if (Array.isArray(value)) {
    return (
      <span className="flex flex-wrap gap-1">
        {value.map((item, index) =>
          isUser(item) ? (
            <JiraUserLabel key={index} user={item} />
          ) : (
            <Badge key={index} variant="outline" className="max-w-full shrink justify-start truncate">
              {typeof item === "object" && item !== null ? labelOf(item) ?? "?" : String(item)}
            </Badge>
          ),
        )}
      </span>
    );
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return <>{new Date(value).toLocaleDateString("de-DE")}</>;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return <>{new Date(value).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}</>;
  }
  const href = safeUrl(value);
  if (href) {
    return (
      <ExternalLink href={href} className="block truncate">
        {href.replace(/^https?:\/\//i, "")}
      </ExternalLink>
    );
  }
  if (typeof value === "boolean") return <>{value ? "Ja" : "Nein"}</>;
  if (typeof value === "object" && value !== null) return <>{labelOf(value) ?? "–"}</>;
  return <>{String(value)}</>;
}

const editKind = (issue: JiraIssueDetail, id: string) => {
  const meta = issue.editmeta.fields[id];
  if (!meta || (meta.operations && !meta.operations.includes("set"))) return undefined;
  const kind = kindOf(meta);
  return kind ? { meta, kind } : undefined;
};

export function EditableField({
  issue,
  id,
  children,
  className,
}: {
  issue: JiraIssueDetail;
  id: string;
  children: ReactNode;
  className?: string;
}) {
  const editable = editKind(issue, id);
  const edit = useJiraEditIssue(issue.key);
  const [draft, setDraft] = useState<{ value: unknown }>();
  const current = issue.fields[id];

  if (!editable) return <div className={className}>{children}</div>;
  const { meta, kind } = editable;

  if (!draft) {
    return (
      <button
        type="button"
        onClick={() => {
          edit.reset();
          setDraft({ value: initialValue(kind, current) });
        }}
        className={cn(
          "group relative -mx-1.5 flex w-[calc(100%+0.75rem)] rounded-md px-1.5 py-0.5 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <span className="min-w-0 flex-1">{children}</span>
        <PencilIcon
          aria-label={`${meta.name} bearbeiten`}
          className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        />
      </button>
    );
  }

  if (kind === "richtext") {
    return <WikiEditor issueKey={issue.key} id={id} className={className} onDone={() => setDraft(undefined)} />;
  }

  const errors = jiraErrors(edit.error);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    edit.mutate({ [id]: encode(kind, draft.value) }, { onSuccess: () => setDraft(undefined) });
  };

  return (
    <form
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          setDraft(undefined);
        }
      }}
      className={cn("flex flex-col gap-2", className)}
    >
      <JiraFieldInput
        id={`field-${id}`}
        field={meta}
        kind={kind}
        value={draft.value}
        issueKey={issue.key}
        onChange={(value) => setDraft({ value })}
      />
      {[...errors.messages, ...Object.values(errors.fields)].map((message) => (
        <p key={message} role="alert" className="text-xs text-destructive">
          {message}
        </p>
      ))}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={edit.isPending}>
          {edit.isPending && <Spinner />}
          Speichern
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(undefined)}>
          Abbrechen
        </Button>
      </div>
    </form>
  );
}

function WikiEditor({ issueKey, id, className, onDone }: { issueKey: string; id: string; className?: string; onDone: () => void }) {
  const wiki = useJiraWikiField(issueKey, id);
  if (wiki.error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {wiki.error.message}
      </p>
    );
  }
  if (wiki.data === undefined) return <Spinner />;
  return <WikiForm issueKey={issueKey} id={id} initial={wiki.data} className={className} onDone={onDone} />;
}

function WikiForm({
  issueKey,
  id,
  initial,
  className,
  onDone,
}: {
  issueKey: string;
  id: string;
  initial: string;
  className?: string;
  onDone: () => void;
}) {
  const edit = useJiraEditIssueWiki(issueKey);
  const [text, setText] = useState(initial);
  const errors = jiraErrors(edit.error);
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (text === initial) return onDone();
    edit.mutate({ [id]: text }, { onSuccess: onDone });
  };

  return (
    <form onSubmit={submit} className={cn("flex flex-col gap-2", className)}>
      <Textarea
        autoFocus
        value={text}
        aria-label="Text bearbeiten"
        className="min-h-48 font-mono text-xs"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onDone();
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submit();
        }}
      />
      {[...errors.messages, ...Object.values(errors.fields)].map((message) => (
        <p key={message} role="alert" className="text-xs text-destructive">
          {message}
        </p>
      ))}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={edit.isPending}>
          {edit.isPending && <Spinner />}
          Speichern
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Abbrechen
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">Jira-Wiki-Syntax · ⌘ + Enter speichert</span>
      </div>
    </form>
  );
}

const rank = (id: string) => {
  if (FIRST.includes(id)) return FIRST.indexOf(id);
  if (LAST.includes(id)) return 1000 + LAST.indexOf(id);
  return 100;
};

export const richFieldIds = (issue: JiraIssueDetail) =>
  Object.keys(issue.fields).filter((id) => id !== "description" && !HIDDEN.has(id) && isAdf(issue.fields[id]));

export function IssueFields({ issue }: { issue: JiraIssueDetail }) {
  const nameOf = (id: string) => issue.editmeta.fields[id]?.name ?? issue.names[id] ?? id;
  const rich = new Set(richFieldIds(issue));
  const ids = [...new Set([...Object.keys(issue.fields), ...Object.keys(issue.editmeta.fields)])]
    .filter((id) => !HIDDEN.has(id) && !rich.has(id))
    .filter((id) => !blank(issue.fields[id]) || editKind(issue, id))
    .sort((a, b) => rank(a) - rank(b) || nameOf(a).localeCompare(nameOf(b), "de"));

  return (
    <dl className="flex min-w-0 flex-col gap-4">
      {ids.map((id) => (
        <div key={id} className="flex flex-col gap-1">
          <dt className="text-xs text-muted-foreground">
            {nameOf(id)}
            {issue.editmeta.fields[id]?.required && <span className="text-destructive">*</span>}
          </dt>
          <dd className="min-w-0 text-sm wrap-anywhere">
            <EditableField issue={issue} id={id}>
              <FieldValue value={issue.fields[id]} />
            </EditableField>
          </dd>
        </div>
      ))}
    </dl>
  );
}
