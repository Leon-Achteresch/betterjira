import { type InfiniteData, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { Data, Effect } from "effect";
import { fetchBoardPage, type BoardData, type BoardIssue } from "./board";
import { jiraKeys } from "./keys";
import { fieldCatalogQuery } from "./metadata-query";
import { mergeIssuePages } from "./issue-page-cache";
import { composeJql, quoteJql } from "./jql";
import { searchIssues, type SearchPage, type SearchIssue } from "./search";
import { reconcileIds } from "./reconcile-ids";

export const BOARD_RECONCILE_DELAY = 150;
const RECONCILE_BATCH_SIZE = 50;
class JiraPaginationError extends Data.TaggedError("JiraPaginationError")<{ message: string }> {}

const collectChangedIssues = async <Issue>(load: (token?: string) => Promise<{ issues: readonly Issue[]; isLast?: boolean; nextPageToken?: string | null }>) => {
  const issues: Issue[] = [];
  const seen = new Set<string>();
  let token: string | undefined;
  for (let page = 0; page < RECONCILE_BATCH_SIZE; page++) {
    const result = await load(token);
    issues.push(...result.issues);
    const next = result.nextPageToken;
    if (result.isLast || !next) return issues;
    if (seen.has(next)) throw new JiraPaginationError({ message: "Jira liefert einen wiederholten Seitentoken" });
    seen.add(next);
    token = next;
  }
  throw new JiraPaginationError({ message: "Jira überschreitet das Seitenlimit beim Ticketabgleich" });
};

type BoardPatch = { queryKey: QueryKey; previous: BoardIssue; optimistic: BoardIssue };
type PendingRefresh = { keys: Set<string>; timer: ReturnType<typeof setTimeout> };
const pending = new WeakMap<QueryClient, PendingRefresh>();
const running = new WeakMap<QueryClient, Promise<void>>();
const revisions = new WeakMap<QueryClient, Map<string, number>>();

const revision = (client: QueryClient, key: string) => revisions.get(client)?.get(key) ?? 0;

const optimisticFields = (fields: Record<string, unknown>) => ({
  ...(typeof fields.summary === "string" && { summary: fields.summary }),
  ...(typeof fields.duedate === "string" || fields.duedate === null ? { duedate: fields.duedate } : {}),
  ...(Array.isArray(fields.labels) && fields.labels.every((label): label is string => typeof label === "string") && { labels: fields.labels }),
});

export const patchBoardIssue = (client: QueryClient, key: string, fields: Record<string, unknown>, status?: BoardIssue["fields"]["status"]) => {
  const current = revisions.get(client) ?? new Map<string, number>();
  current.set(key, revision(client, key) + 1);
  revisions.set(client, current);
  const patches: BoardPatch[] = [];
  const patch = optimisticFields(fields);
  if (!status && Object.keys(patch).length === 0) return patches;
  for (const [queryKey, data] of client.getQueriesData<BoardData>({ queryKey: jiraKeys.allBoards })) {
    if (!data) continue;
    let changed = false;
    const previous = new Map<string, BoardIssue>();
    const pages = data.pages.map((page) => ({ ...page, issues: page.issues.map((issue) => {
      if (issue.key !== key) return issue;
      changed = true;
      const optimistic = { ...issue, fields: { ...issue.fields, ...patch, ...(status && { status }) } };
      previous.set(issue.key, issue);
      return optimistic;
    }) }));
    if (changed) {
      const stored = client.setQueryData<BoardData>(queryKey, { ...data, pages });
      for (const page of stored?.pages ?? []) for (const optimistic of page.issues) {
        const before = previous.get(optimistic.key);
        if (before) patches.push({ queryKey, previous: before, optimistic });
      }
    }
  }
  return patches;
};

export const rollbackBoardPatches = (client: QueryClient, patches: BoardPatch[]) => {
  for (const { queryKey, previous, optimistic } of patches) {
    client.setQueryData<BoardData>(queryKey, (data) => data && ({ ...data, pages: data.pages.map((page) => ({
      ...page, issues: page.issues.map((issue) => {
        if (issue.key !== optimistic.key) return issue;
        const fields = { ...issue.fields };
        for (const field of Object.keys(optimistic.fields)) {
          if (optimistic.fields[field] !== previous.fields[field] && fields[field] === optimistic.fields[field]) fields[field] = previous.fields[field];
        }
        return { ...issue, fields };
      }),
    })) }));
  }
};

export const reconcileBoards = async (client: QueryClient, keys: readonly string[]) => {
  if (!keys.length) return;
  const versions = new Map(keys.map((key) => [key, revision(client, key)]));
  const site = client.getQueryData(jiraKeys.site);
  const queries = client.getQueryCache().findAll({ queryKey: jiraKeys.allBoards, type: "active" });
  await Promise.all(queries.map(async (query) => {
    const queryKey = query.queryKey;
    const data = client.getQueryData<BoardData>(queryKey);
    const metadata = data?.pages[0]?.metadata;
    if (!metadata) return;
    await client.cancelQueries({ queryKey, exact: true });
    const fields = await client.fetchQuery(fieldCatalogQuery());
    const refreshed: BoardIssue[] = [];
    for (let offset = 0; offset < keys.length; offset += RECONCILE_BATCH_SIZE) {
      const batch = keys.slice(offset, offset + RECONCILE_BATCH_SIZE);
      const ids = reconcileIds(client, batch, data.pages.flatMap((page) => page.issues));
      const issues = await collectChangedIssues<BoardIssue>((token) => client.fetchQuery({
        queryKey: jiraKeys.boardReconcile(metadata.boardId, metadata.sprintId, batch, token),
        queryFn: ({ signal }) => Effect.runPromise(fetchBoardPage(
          { id: metadata.boardId, type: metadata.boardType },
          metadata.config, fields, metadata.sprintId, token, batch, ids,
        ), { signal }),
        staleTime: 0,
        gcTime: 0,
        retry: false,
      }));
      refreshed.push(...issues);
    }
    if (client.getQueryData(jiraKeys.site) !== site) return;
    const applicable = keys.filter((key) => revision(client, key) === versions.get(key));
    client.setQueryData<BoardData>(queryKey, (current) => current && mergeIssuePages(current, applicable, refreshed.filter((issue) => applicable.includes(issue.key))));
  }));
};

export const reconcileSearches = async (client: QueryClient, keys: readonly string[]) => {
  const versions = new Map(keys.map((key) => [key, revision(client, key)]));
  const site = client.getQueryData(jiraKeys.site);
  const queries = client.getQueryCache().findAll({ queryKey: jiraKeys.allIssues, type: "active" });
  await Promise.all(queries.map(async (query) => {
    const [,, kind, jql, fields] = query.queryKey;
    if (kind !== "search" || typeof jql !== "string" || !Array.isArray(fields) || !fields.every((field): field is string => typeof field === "string")) return;
    await client.cancelQueries({ queryKey: query.queryKey, exact: true });
    const refreshed: SearchIssue[] = [];
    const current = client.getQueryData<InfiniteData<SearchPage>>(query.queryKey);
    for (let offset = 0; offset < keys.length; offset += RECONCILE_BATCH_SIZE) {
      const batch = keys.slice(offset, offset + RECONCILE_BATCH_SIZE);
      const clause = `key in (${batch.map(quoteJql).join(",")})`;
      const ids = reconcileIds(client, batch, current?.pages.flatMap((page) => page.issues) ?? []);
      const issues = await collectChangedIssues<SearchIssue>((token) => client.fetchQuery({
        queryKey: jiraKeys.searchReconcile(jql, fields, batch, token),
        queryFn: ({ signal }) => Effect.runPromise(searchIssues(composeJql(jql, [clause]), fields, token, RECONCILE_BATCH_SIZE, ids), { signal }),
        staleTime: 0,
        gcTime: 0,
        retry: false,
      }));
      refreshed.push(...issues);
    }
    if (client.getQueryData(jiraKeys.site) !== site) return;
    const applicable = keys.filter((key) => revision(client, key) === versions.get(key));
    client.setQueryData<InfiniteData<SearchPage>>(query.queryKey, (current) => current && mergeIssuePages(current, applicable, refreshed.filter((issue) => applicable.includes(issue.key))));
  }));
};

export const scheduleBoardReconcile = (client: QueryClient, key: string) => {
  const previous = pending.get(client);
  if (previous) {
    previous.keys.add(key);
    return;
  }
  const keys = new Set([key]);
  const timer = setTimeout(() => {
    pending.delete(client);
    void client.refetchQueries({ queryKey: jiraKeys.myWork, type: "active" }, { cancelRefetch: false });
    void client.refetchQueries({ queryKey: jiraKeys.allIssueCounts, type: "active" }, { cancelRefetch: false });
    const next = (running.get(client) ?? Promise.resolve()).then(async () => {
      await Promise.all([reconcileBoards(client, [...keys]), reconcileSearches(client, [...keys])]);
    }).catch(() => {
      void client.invalidateQueries({ queryKey: jiraKeys.allBoards, refetchType: "none" });
      void client.invalidateQueries({ queryKey: jiraKeys.allIssues, refetchType: "none" });
    }).finally(() => { if (running.get(client) === next) running.delete(client); });
    running.set(client, next);
  }, BOARD_RECONCILE_DELAY);
  pending.set(client, { keys, timer });
};
