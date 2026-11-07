import { Schema } from "effect";

const RememberedIssue = Schema.Struct({
  key: Schema.String,
  summary: Schema.String,
});

export const IssueContext = Schema.Struct({
  summary: Schema.String,
  note: Schema.String,
  scrollTop: Schema.Number,
  visitedAt: Schema.Number,
  statusName: Schema.optional(Schema.String),
  statusColor: Schema.optional(Schema.String),
});

export type IssueContext = typeof IssueContext.Type;

export const Workspace = Schema.Struct({
  recent: Schema.Array(RememberedIssue),
  pinned: Schema.Array(RememberedIssue),
  drafts: Schema.Record(Schema.String, Schema.String),
  newestFirst: Schema.Boolean,
  contexts: Schema.optional(Schema.Record(Schema.String, IssueContext)),
});

export type Workspace = typeof Workspace.Type;
export type RememberedIssue = typeof RememberedIssue.Type;

export const Workspaces = Schema.Record(Schema.String, Workspace);
export const EMPTY_WORKSPACE: Workspace = {
  recent: [],
  pinned: [],
  drafts: {},
  newestFirst: false,
  contexts: {},
};
export const RECENT_ISSUE_LIMIT = 50;
export const WORKSPACE_STORAGE_KEY = "betterjira-workspaces";

export const workspaceId = (cloudId: string, accountId: string) => JSON.stringify([cloudId, accountId]);

export const rememberIssue = (
  workspace: Workspace,
  issue: RememberedIssue,
  context: Partial<IssueContext> = {},
  retainedKeys: readonly string[] = [],
): Workspace => {
  const recent = [issue, ...workspace.recent.filter(({ key }) => key !== issue.key)].slice(0, RECENT_ISSUE_LIMIT);
  const retained = new Set([
    ...recent.map((entry) => entry.key),
    ...workspace.pinned.map((entry) => entry.key),
    ...Object.keys(workspace.drafts),
    ...retainedKeys,
  ]);
  const contexts = Object.fromEntries(
    Object.entries(workspace.contexts ?? {}).filter(([key, entry]) =>
      retained.has(key) || entry.note.trim() || (Number.isFinite(entry.scrollTop) && entry.scrollTop > 0),
    ),
  );
  return {
    ...workspace,
    recent,
    pinned: workspace.pinned.map((pinned) => (pinned.key === issue.key ? issue : pinned)),
    contexts: {
      ...contexts,
      [issue.key]: {
        note: "",
        scrollTop: 0,
        visitedAt: 0,
        ...workspace.contexts?.[issue.key],
        ...context,
        summary: issue.summary,
      },
    },
  };
};

export const setIssueContext = (workspace: Workspace, key: string, patch: Partial<IssueContext>): Workspace => ({
  ...workspace,
  contexts: {
    ...workspace.contexts,
    [key]: {
      summary: key,
      note: "",
      scrollTop: 0,
      visitedAt: 0,
      ...workspace.contexts?.[key],
      ...patch,
    },
  },
});

export const WORK_QUEUE_FILTERS = [
  { id: "recent", label: "Zuletzt" },
  { id: "pinned", label: "Angeheftet" },
  { id: "drafts", label: "Angefangen" },
] as const;

export type WorkQueueFilter = (typeof WORK_QUEUE_FILTERS)[number]["id"];

const isStringArray = Schema.is(Schema.Array(Schema.String));

export const scopedFieldDraftKeys = (ids: readonly string[], scope: string | undefined) => {
  if (!scope) return [];
  return [
    ...new Set(
      ids.flatMap((id) => {
        try {
          const parts: unknown = JSON.parse(id);
          return isStringArray(parts) && parts.length === 4 && JSON.stringify(parts.slice(0, 2)) === scope && parts[2]
            ? [parts[2]]
            : [];
        } catch {
          return [];
        }
      }),
    ),
  ];
};

export const workQueueItems = (
  workspace: Workspace,
  filter: WorkQueueFilter = "recent",
  query = "",
  fieldDraftKeys: readonly string[] = [],
) => {
  const remembered = new Map([...workspace.pinned, ...workspace.recent].map((issue) => [issue.key, issue]));
  const contextKeys = Object.keys(workspace.contexts ?? {}).filter((key) => workspace.contexts?.[key]?.note.trim());
  const keys = [
    ...new Set([
      ...workspace.recent.map((issue) => issue.key),
      ...remembered.keys(),
      ...Object.keys(workspace.drafts),
      ...contextKeys,
      ...fieldDraftKeys,
    ]),
  ];
  const normalized = query.trim().toLocaleLowerCase("de");
  return keys
    .map((key) => {
      const context = workspace.contexts?.[key];
      return {
        key,
        summary: remembered.get(key)?.summary ?? context?.summary ?? key,
        note: context?.note ?? "",
        hasDraft: !!workspace.drafts[key]?.trim(),
        hasFieldDraft: fieldDraftKeys.includes(key),
        pinned: workspace.pinned.some((issue) => issue.key === key),
        visitedAt: context?.visitedAt ?? 0,
        hasReadingPosition: (context?.scrollTop ?? 0) > 80,
        status: context?.statusName
          ? { name: context.statusName, statusCategory: { colorName: context.statusColor ?? "" } }
          : undefined,
      };
    })
    .filter(
      (item) =>
        (filter !== "pinned" || item.pinned) &&
        (filter !== "drafts" || item.hasDraft || item.hasFieldDraft || !!item.note.trim()) &&
        (!normalized || `${item.key} ${item.summary} ${item.note}`.toLocaleLowerCase("de").includes(normalized)),
    );
};

export type WorkQueueItem = ReturnType<typeof workQueueItems>[number];

export const togglePinnedIssue = (workspace: Workspace, issue: RememberedIssue): Workspace => ({
  ...workspace,
  pinned: workspace.pinned.some(({ key }) => key === issue.key)
    ? workspace.pinned.filter(({ key }) => key !== issue.key)
    : [...workspace.pinned, issue],
});

export const setCommentDraft = (workspace: Workspace, key: string, draft: string): Workspace => {
  const { [key]: previous, ...others } = workspace.drafts;
  return { ...workspace, drafts: draft ? { ...others, [key]: draft } : others };
};

export const clearSubmittedDraft = (workspace: Workspace, key: string, submitted: string): Workspace =>
  workspace.drafts[key] === submitted ? setCommentDraft(workspace, key, "") : workspace;

export const COMMENT_TEMPLATES = [
  {
    label: "Statusupdate",
    body: "*Stand*\n\n* Nächster Schritt:\n* Offene Fragen:",
  },
  {
    label: "Rückfrage",
    body: "*Rückfrage*\n\n* Was ich noch brauche:\n* Warum das wichtig ist:",
  },
  {
    label: "Übergabe",
    body: "*Übergabe*\n\n* Erledigt:\n* Noch offen:\n* Zum Testen:",
  },
] as const;

export const appendTemplate = (draft: string, template: string) =>
  draft.trim() ? `${draft.trimEnd()}\n\n${template}` : template;
