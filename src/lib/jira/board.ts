import { Effect, Schema } from "effect";
import type { InfiniteData } from "@tanstack/react-query";
import { jira } from "./client";
import type { JiraFieldInfo } from "./search";
import { quoteJql } from "./jql";

const JiraStatus = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  statusCategory: Schema.Struct({ key: Schema.String, colorName: Schema.String }),
});

const JiraUser = Schema.Struct({
  displayName: Schema.String,
  avatarUrls: Schema.Struct({ "48x48": Schema.String }),
});

export const BoardConfiguration = Schema.Struct({
  filter: Schema.Struct({ id: Schema.String }),
  estimation: Schema.optional(Schema.Struct({ field: Schema.optional(Schema.Struct({ fieldId: Schema.String })) })),
  columnConfig: Schema.Struct({
    columns: Schema.Array(
      Schema.Struct({ name: Schema.String, statuses: Schema.Array(Schema.Struct({ id: Schema.String })) }),
    ),
  }),
});

export const Sprints = Schema.Array(
  Schema.Struct({
    id: Schema.Number,
    name: Schema.String,
    state: Schema.String,
    boardId: Schema.optional(Schema.Number),
    startDate: Schema.optional(Schema.String),
    endDate: Schema.optional(Schema.String),
    goal: Schema.optional(Schema.String),
  }),
);

export type JiraSprint = (typeof Sprints.Type)[number];

export const BoardIssuePage = Schema.Struct({
  issues: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      key: Schema.String,
      fields: Schema.StructWithRest(
        Schema.Struct({
          summary: Schema.String,
          status: JiraStatus,
          assignee: Schema.NullOr(JiraUser),
          created: Schema.String,
          issuetype: Schema.Struct({ name: Schema.String, iconUrl: Schema.optional(Schema.String) }),
          priority: Schema.optional(
            Schema.NullOr(Schema.Struct({ name: Schema.String, iconUrl: Schema.optional(Schema.String) })),
          ),
          labels: Schema.optional(Schema.Array(Schema.String)),
          duedate: Schema.optional(Schema.NullOr(Schema.String)),
          parent: Schema.optional(Schema.Struct({ key: Schema.String, fields: Schema.Struct({ summary: Schema.String }) })),
          subtasks: Schema.optional(
            Schema.Array(Schema.Struct({ fields: Schema.Struct({ status: JiraStatus }) })),
          ),
        }),
        [Schema.Record(Schema.String, Schema.Unknown)],
      ),
      changelog: Schema.optional(
        Schema.Struct({
          histories: Schema.Array(
            Schema.Struct({
              created: Schema.String,
              items: Schema.Array(Schema.Struct({ field: Schema.String, from: Schema.optional(Schema.NullOr(Schema.String)) })),
            }),
          ),
        }),
      ),
    }),
  ),
  nextPageToken: Schema.optional(Schema.NullOr(Schema.String)),
  isLast: Schema.optional(Schema.Boolean),
});

export type BoardIssue = (typeof BoardIssuePage.Type)["issues"][number];

export type BoardIdentity = { id: number; type: string };
export type BoardConfig = typeof BoardConfiguration.Type;
export type BoardMetadata = { config: BoardConfig; sprintField?: string; flaggedField?: string; pointsField?: string; sprintId?: number; boardId: number; boardType: string };
export type BoardPage = typeof BoardIssuePage.Type & { metadata: BoardMetadata };
export type BoardData = InfiniteData<BoardPage>;

export const BOARD_PAGE_SIZE = 100;

export const fetchBoardPage = (
  board: BoardIdentity,
  config: BoardConfig,
  fields: readonly JiraFieldInfo[],
  sprintId?: number,
  pageToken?: string,
  issueKeys?: readonly string[],
  reconcileIssueIds: readonly string[] = [],
) => {
  const sprintField = board.type === "scrum"
    ? fields.find((field) => field.schema?.custom === "com.pyxis.greenhopper.jira:gh-sprint")?.id
    : undefined;
  const flaggedField = fields.find((field) => field.name === "Flagged")?.id;
  const pointsField = config.estimation?.field?.fieldId;
  const sprint = sprintId !== undefined ? ` AND sprint = ${sprintId}` : board.type === "scrum" ? " AND sprint in openSprints()" : "";
  const params = new URLSearchParams({
    jql: `filter = ${config.filter.id}${sprint}${issueKeys?.length ? ` AND key in (${issueKeys.map(quoteJql).join(",")})` : ""} ORDER BY Rank ASC`,
    fields: ["summary,status,assignee,created,issuetype,priority,labels,duedate,parent,subtasks", sprintField, flaggedField, pointsField].filter(Boolean).join(","),
    expand: "changelog",
    maxResults: String(BOARD_PAGE_SIZE),
  });
  if (pageToken) params.set("nextPageToken", pageToken);
  if (reconcileIssueIds.length) params.set("reconcileIssues", reconcileIssueIds.join(","));
  return jira(`/search/jql?${params}`, BoardIssuePage).pipe(
    Effect.map((page): BoardPage => ({ ...page, metadata: { config, sprintField, flaggedField, pointsField, sprintId, boardId: board.id, boardType: board.type } })),
  );
};

const isSprints = Schema.is(Sprints);

const enteredColumn = (issue: BoardIssue, statusIds: readonly string[]) =>
  issue.changelog?.histories.reduce((latest, history) =>
    history.created > latest && history.items.some((item) => item.field === "status" && !statusIds.includes(item.from ?? ""))
      ? history.created : latest, issue.fields.created) ?? issue.fields.created;

export const boardGroups = (data: BoardData) => {
  const metadata = data.pages[0]?.metadata;
  if (!metadata) return [];
  const { config, sprintField, flaggedField, pointsField, sprintId, boardId } = metadata;
  const seen = new Set<string>();
  const cards = data.pages.flatMap((page) => page.issues).filter((issue) => {
    if (seen.has(issue.id)) return false;
    seen.add(issue.id);
    return true;
  }).map((issue, index) => {
    const points = pointsField ? issue.fields[pointsField] : undefined;
    const flagged = flaggedField ? issue.fields[flaggedField] : undefined;
    return { ...issue, rank: index + 1, points: typeof points === "number" ? points : undefined, flagged: Array.isArray(flagged) && flagged.length > 0 };
  });
  const columns = (group: typeof cards) => {
    const byStatus = new Map<string, typeof cards>();
    for (const card of group) {
      const bucket = byStatus.get(card.fields.status.id) ?? [];
      bucket.push(card);
      byStatus.set(card.fields.status.id, bucket);
    }
    return config.columnConfig.columns.map((column) => {
      const statusIds = column.statuses.map((status) => status.id);
      return { name: column.name, statusIds, issues: statusIds.flatMap((id) => byStatus.get(id) ?? [])
        .sort((a, b) => a.rank - b.rank)
        .map((card) => ({ ...card, inColumnSince: enteredColumn(card, statusIds) })) };
    });
  };
  if (!sprintField) return [{ sprint: null, columns: columns(cards) }];
  const groups = new Map<number, { sprint: JiraSprint; cards: typeof cards }>();
  for (const card of cards) {
    const sprints = card.fields[sprintField];
    const active = isSprints(sprints) ? sprints.filter((sprint) => sprintId !== undefined ? sprint.id === sprintId : sprint.state === "active") : [];
    const sprint = active.find((sprint) => sprint.boardId === boardId) ?? active[0];
    if (!sprint) continue;
    const group = groups.get(sprint.id) ?? { sprint, cards: [] };
    group.cards.push(card);
    groups.set(sprint.id, group);
  }
  return [...groups.values()].map(({ sprint, cards }) => ({ sprint, columns: columns(cards) }));
};

