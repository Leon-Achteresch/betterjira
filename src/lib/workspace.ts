import { Schema } from "effect";
import { AdfDoc, appendBlocks, isAdfDoc, isBlankAdf, sameAdf, textToAdf, type AdfNode } from "./jira/adf";

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
  commentDrafts: Schema.optional(Schema.Record(Schema.String, AdfDoc)),
  replyDrafts: Schema.optional(Schema.Record(Schema.String, Schema.Record(Schema.String, AdfDoc))),
  editDrafts: Schema.optional(Schema.Record(Schema.String, Schema.Record(Schema.String, AdfDoc))),
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
  commentDrafts: {},
  replyDrafts: {},
  editDrafts: {},
};
export const RECENT_ISSUE_LIMIT = 50;

export const workspaceId = (cloudId: string, accountId: string) => JSON.stringify([cloudId, accountId]);

const draftKeys = (workspace: Workspace) => [
  ...Object.keys(workspace.drafts),
  ...Object.keys(workspace.commentDrafts ?? {}),
  ...Object.keys(workspace.replyDrafts ?? {}),
  ...Object.keys(workspace.editDrafts ?? {}),
];

const hasCommentDraft = (workspace: Workspace, key: string) =>
  !!workspace.drafts[key]?.trim() ||
  !!workspace.commentDrafts?.[key] ||
  Object.keys(workspace.replyDrafts?.[key] ?? {}).length > 0 ||
  Object.keys(workspace.editDrafts?.[key] ?? {}).length > 0;

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
    ...draftKeys(workspace),
    ...retainedKeys,
  ]);
  const contexts = Object.fromEntries(
    Object.entries(workspace.contexts ?? {}).filter(([key, entry]) => retained.has(key) || entry.note.trim()),
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
      ...draftKeys(workspace),
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
        hasDraft: hasCommentDraft(workspace, key),
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

const without = <V>(record: Readonly<Record<string, V>> | undefined, key: string): Record<string, V> =>
  Object.fromEntries(Object.entries(record ?? {}).filter(([entry]) => entry !== key));

const kept = (draft: AdfNode | undefined): draft is AdfNode => !!draft && !isBlankAdf(draft);

export const mainDraftOf = (workspace: Workspace, key: string) => workspace.commentDrafts?.[key];

export const setMainDraft = (workspace: Workspace, key: string, draft: AdfNode | undefined): Workspace => ({
  ...workspace,
  commentDrafts: { ...without(workspace.commentDrafts, key), ...(kept(draft) && { [key]: draft }) },
});

export const clearSubmittedMainDraft = (workspace: Workspace, key: string, submitted: AdfNode): Workspace =>
  sameAdf(mainDraftOf(workspace, key), submitted) ? setMainDraft(workspace, key, undefined) : workspace;

export const replyDraftOf = (workspace: Workspace, key: string, thread: string) => workspace.replyDrafts?.[key]?.[thread];

type NestedDrafts = Readonly<Record<string, Readonly<Record<string, AdfNode>>>>;

const setNestedDraft = (record: NestedDrafts | undefined, key: string, inner: string, draft: AdfNode | undefined) => {
  const entries = { ...without(record?.[key], inner), ...(kept(draft) && { [inner]: draft }) };
  const others = without(record, key);
  return Object.keys(entries).length > 0 ? { ...others, [key]: entries } : others;
};

export const setReplyDraft = (workspace: Workspace, key: string, thread: string, draft: AdfNode | undefined): Workspace => ({
  ...workspace,
  replyDrafts: setNestedDraft(workspace.replyDrafts, key, thread, draft),
});

export const clearSubmittedReplyDraft = (workspace: Workspace, key: string, thread: string, submitted: AdfNode): Workspace =>
  sameAdf(replyDraftOf(workspace, key, thread), submitted) ? setReplyDraft(workspace, key, thread, undefined) : workspace;

export const editDraftOf = (workspace: Workspace, key: string, commentId: string) => workspace.editDrafts?.[key]?.[commentId];

export const setEditDraft = (workspace: Workspace, key: string, commentId: string, draft: AdfNode | undefined): Workspace => ({
  ...workspace,
  editDrafts: setNestedDraft(workspace.editDrafts, key, commentId, draft),
});

export const clearSubmittedEditDraft = (workspace: Workspace, key: string, commentId: string, submitted: AdfNode): Workspace =>
  sameAdf(editDraftOf(workspace, key, commentId), submitted) ? setEditDraft(workspace, key, commentId, undefined) : workspace;

export const pruneEditDrafts = (workspace: Workspace, key: string, existingIds: readonly string[]): Workspace => {
  const existing = new Set(existingIds);
  const stale = Object.keys(workspace.editDrafts?.[key] ?? {}).filter((id) => !existing.has(id));
  return stale.reduce((current, id) => setEditDraft(current, key, id, undefined), workspace);
};

export const migrateLegacyDrafts = (workspace: Workspace): Workspace => {
  if (Object.keys(workspace.drafts).length === 0) return workspace;
  const commentDrafts: Record<string, AdfNode> = { ...workspace.commentDrafts };
  for (const [key, text] of Object.entries(workspace.drafts)) {
    if (text.trim()) commentDrafts[key] = appendBlocks(commentDrafts[key], textToAdf(text).content ?? []);
  }
  return { ...workspace, drafts: {}, commentDrafts };
};

export const migrateWorkspaces = (workspaces: typeof Workspaces.Type): Record<string, Workspace> =>
  Object.fromEntries(Object.entries(workspaces).map(([id, workspace]) => [id, migrateLegacyDrafts(workspace)]));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const docsOnly = (value: unknown): Record<string, AdfNode> =>
  isRecord(value) ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, AdfNode] => isAdfDoc(entry[1]))) : {};

const nestedDocsOnly = (value: unknown): Record<string, Record<string, AdfNode>> =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value)
          .map(([key, inner]) => [key, docsOnly(inner)] as const)
          .filter(([, inner]) => Object.keys(inner).length > 0),
      )
    : {};

const isWorkspace = Schema.is(Workspace);

export const sanitizeWorkspace = (value: unknown): Workspace | undefined => {
  if (!isRecord(value)) return undefined;
  const cleaned = {
    ...value,
    commentDrafts: docsOnly(value.commentDrafts),
    replyDrafts: nestedDocsOnly(value.replyDrafts),
    editDrafts: nestedDocsOnly(value.editDrafts),
  };
  return isWorkspace(cleaned) ? cleaned : undefined;
};

export const restoreWorkspaces = (value: unknown): Record<string, Workspace> =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).flatMap(([id, stored]) => {
          const workspace = sanitizeWorkspace(stored);
          return workspace ? [[id, migrateLegacyDrafts(workspace)] as const] : [];
        }),
      )
    : {};

const boldLine = (text: string): AdfNode => ({ type: "paragraph", content: [{ type: "text", text, marks: [{ type: "strong" }] }] });

const bullets = (...items: string[]): AdfNode => ({
  type: "bulletList",
  content: items.map((item) => ({ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: item }] }] })),
});

export const ADF_COMMENT_TEMPLATES: readonly { label: string; blocks: readonly AdfNode[] }[] = [
  { label: "Statusupdate", blocks: [boldLine("Stand"), bullets("Nächster Schritt:", "Offene Fragen:")] },
  { label: "Rückfrage", blocks: [boldLine("Rückfrage"), bullets("Was ich noch brauche:", "Warum das wichtig ist:")] },
  { label: "Übergabe", blocks: [boldLine("Übergabe"), bullets("Erledigt:", "Noch offen:", "Zum Testen:")] },
];
