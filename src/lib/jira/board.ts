import { Data, Effect, Schema } from "effect";
import { jira, jiraAgile } from "./client";
import { JiraStatus } from "./status";
import { JiraUser } from "./user";

export const BoardPage = Schema.Struct({
  values: Schema.Array(
    Schema.Struct({
      id: Schema.Number,
      name: Schema.String,
      type: Schema.String,
      location: Schema.optional(Schema.Struct({ projectKey: Schema.optional(Schema.String) })),
    }),
  ),
});

export type JiraBoard = (typeof BoardPage.Type)["values"][number];

export const BoardConfiguration = Schema.Struct({
  filter: Schema.Struct({ id: Schema.String }),
  estimation: Schema.optional(Schema.Struct({ field: Schema.optional(Schema.Struct({ fieldId: Schema.String })) })),
  columnConfig: Schema.Struct({
    columns: Schema.Array(
      Schema.Struct({ name: Schema.String, statuses: Schema.Array(Schema.Struct({ id: Schema.String })) }),
    ),
  }),
});

const Sprints = Schema.Array(
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

const sprintClause = (board: JiraBoard, sprint?: number) => {
  if (sprint !== undefined) return ` AND sprint = ${sprint}`;
  return board.type === "scrum" ? " AND sprint in openSprints()" : "";
};

const SprintPage = Schema.Struct({ values: Sprints, isLast: Schema.optional(Schema.Boolean) });

const MAX_SPRINT_PAGES = 20;

export const boardSprints = (boardId: number) =>
  Effect.gen(function* () {
    const sprints: JiraSprint[] = [];
    for (let page = 0; page < MAX_SPRINT_PAGES; page++) {
      const { values, isLast } = yield* jiraAgile(
        `/board/${boardId}/sprint?state=active,future,closed&maxResults=50&startAt=${sprints.length}`,
        SprintPage,
      );
      sprints.push(...values);
      if (isLast !== false || values.length === 0) break;
    }
    return sprints;
  });

const Fields = Schema.Array(
  Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    schema: Schema.optional(Schema.Struct({ custom: Schema.optional(Schema.String) })),
  }),
);

const BoardIssuePage = Schema.Struct({
  nextPageToken: Schema.optional(Schema.NullOr(Schema.String)),
  isLast: Schema.optional(Schema.Boolean),
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
});

type BoardIssue = (typeof BoardIssuePage.Type)["issues"][number];

export class BoardPaginationError extends Data.TaggedError("BoardPaginationError")<{ message: string }> {}

const allBoardIssues = (params: URLSearchParams) =>
  Effect.gen(function* () {
    const issues = new Map<string, BoardIssue>();
    const tokens = new Set<string>();
    const query = new URLSearchParams(params);
    while (true) {
      const page = yield* jira(`/search/jql?${query}`, BoardIssuePage);
      for (const issue of page.issues) issues.set(issue.id, issue);
      if (page.isLast === true || (!page.nextPageToken && page.isLast !== false)) return [...issues.values()];
      if (!page.nextPageToken || tokens.has(page.nextPageToken)) {
        return yield* new BoardPaginationError({ message: "Jira liefert keine gültige Folgeseite für das Board. Bitte erneut versuchen." });
      }
      tokens.add(page.nextPageToken);
      query.set("nextPageToken", page.nextPageToken);
    }
  });

const isSprints = Schema.is(Sprints);

const enteredColumn = (issue: BoardIssue, statusIds: string[]) =>
  issue.changelog?.histories.find((history) =>
    history.items.some((item) => item.field === "status" && !statusIds.includes(item.from ?? "")),
  )?.created ?? issue.fields.created;

export const boardWithIssues = (board: JiraBoard, sprintId?: number) =>
  Effect.gen(function* () {
    const config = yield* jiraAgile(`/board/${board.id}/configuration`, BoardConfiguration);
    const fields = yield* jira("/field", Fields);
    const sprintField =
      board.type === "scrum"
        ? fields.find((field) => field.schema?.custom === "com.pyxis.greenhopper.jira:gh-sprint")?.id
        : undefined;
    const flaggedField = fields.find((field) => field.name === "Flagged")?.id;
    const pointsField = config.estimation?.field?.fieldId;
    const params = new URLSearchParams({
      jql: `filter = ${config.filter.id}${sprintClause(board, sprintId)} ORDER BY Rank ASC`,
      fields: [
        "summary,status,assignee,created,issuetype,priority,labels,duedate,parent,subtasks",
        sprintField,
        flaggedField,
        pointsField,
      ]
        .filter(Boolean)
        .join(","),
      expand: "changelog",
      maxResults: "100",
    });
    const issues = yield* allBoardIssues(params);
    const cards = issues.map((issue, index) => {
      const points = pointsField ? issue.fields[pointsField] : undefined;
      const flagged = flaggedField ? issue.fields[flaggedField] : undefined;
      return {
        ...issue,
        rank: index + 1,
        points: typeof points === "number" ? points : undefined,
        flagged: Array.isArray(flagged) && flagged.length > 0,
      };
    });
    const columns = (group: typeof cards) =>
      config.columnConfig.columns.map((column) => {
        const statusIds = column.statuses.map((status) => status.id);
        return {
          name: column.name,
          statusIds,
          issues: group
            .filter((card) => statusIds.includes(card.fields.status.id))
            .map((card) => ({ ...card, inColumnSince: enteredColumn(card, statusIds) })),
        };
      });
    if (!sprintField) return [{ sprint: null, columns: columns(cards) }];
    const groups = new Map<number, { sprint: JiraSprint; cards: typeof cards }>();
    for (const card of cards) {
      const sprints = card.fields[sprintField];
      const active = isSprints(sprints)
        ? sprints.filter((sprint) => (sprintId !== undefined ? sprint.id === sprintId : sprint.state === "active"))
        : [];
      const sprint = active.find((sprint) => sprint.boardId === board.id) ?? active[0];
      if (!sprint) continue;
      const group = groups.get(sprint.id) ?? { sprint, cards: [] };
      group.cards.push(card);
      groups.set(sprint.id, group);
    }
    return [...groups.values()].map(({ sprint, cards }) => ({ sprint, columns: columns(cards) }));
  });
