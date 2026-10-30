import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect, Schema } from "effect";
import { currentSite, jira, jiraAgile, jiraImage, jiraSend, logout, runLogin } from "./client";

export const jiraKeys = {
  all: ["jira"] as const,
  site: ["jira", "site"] as const,
  myself: ["jira", "myself"] as const,
  projects: ["jira", "projects"] as const,
  avatar: (url: string) => ["jira", "avatar", url] as const,
  issues: (jql: string) => ["jira", "issues", jql] as const,
  search: (jql: string, fields: readonly string[], pageSize: number) => ["jira", "issues", "search", jql, fields, pageSize] as const,
  issueCount: (jql: string) => ["jira", "issues", "count", jql] as const,
  fieldCatalog: ["jira", "field-catalog"] as const,
  filter: (id: string) => ["jira", "filter", id] as const,
  jqlValidation: (jql: string) => ["jira", "jql-validation", jql] as const,
  issue: (key: string) => ["jira", "issue", key] as const,
  transitions: (key: string) => ["jira", "transitions", key] as const,
  userSearch: (query: string, issueKey: string, assignee: boolean) => ["jira", "user-search", query, issueKey, assignee] as const,
  filters: ["jira", "filters"] as const,
  myWork: ["jira", "my-work"] as const,
  projectBoards: (key: string) => ["jira", "project-boards", key] as const,
  board: (id: number, sprint?: number) => ["jira", "board", id, sprint ?? "open"] as const,
  boardSprints: (id: number) => ["jira", "board-sprints", id] as const,
  boardConfig: (id: number) => ["jira", "board-config", id] as const,
  projectStats: (key: string) => ["jira", "project-stats", key] as const,
};

const Myself = Schema.Struct({
  accountId: Schema.String,
  displayName: Schema.String,
  emailAddress: Schema.optional(Schema.String),
  avatarUrls: Schema.Struct({ "48x48": Schema.String }),
});

export const useJiraSite = () =>
  useQuery({
    queryKey: jiraKeys.site,
    queryFn: ({ signal }) => Effect.runPromise(currentSite, { signal }),
    staleTime: Infinity,
    retry: false,
  });

export const useJiraMyself = () => {
  const site = useJiraSite();
  return useQuery({
    queryKey: jiraKeys.myself,
    queryFn: ({ signal }) => Effect.runPromise(jira("/myself", Myself), { signal }),
    enabled: !!site.data,
  });
};

const ProjectPage = Schema.Struct({
  isLast: Schema.Boolean,
  values: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      key: Schema.String,
      name: Schema.String,
      projectTypeKey: Schema.String,
      avatarUrls: Schema.Struct({ "48x48": Schema.String }),
    }),
  ),
});

const allProjects = Effect.gen(function* () {
  const projects: JiraProject[] = [];
  while (true) {
    const page = yield* jira(`/project/search?orderBy=name&maxResults=100&startAt=${projects.length}`, ProjectPage);
    projects.push(...page.values);
    if (page.isLast || page.values.length === 0) return projects;
  }
});

export const useJiraProjects = () => {
  const site = useJiraSite();
  return useQuery({
    queryKey: jiraKeys.projects,
    queryFn: ({ signal }) => Effect.runPromise(allProjects, { signal }),
    enabled: !!site.data,
  });
};

export type JiraProject = (typeof ProjectPage.Type)["values"][number];

export const useJiraAvatar = (url: string) => {
  const apiPath = url.split("/rest/api/3")[1];
  return useQuery({
    queryKey: jiraKeys.avatar(url),
    queryFn: ({ signal }) => Effect.runPromise(jiraImage(apiPath!), { signal }),
    enabled: !!apiPath,
    staleTime: Infinity,
    retry: false,
  });
};

const JiraStatus = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  statusCategory: Schema.Struct({ key: Schema.String, colorName: Schema.String }),
});

const JiraUser = Schema.Struct({
  displayName: Schema.String,
  avatarUrls: Schema.Struct({ "48x48": Schema.String }),
});

const IssuePage = Schema.Struct({
  issues: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      key: Schema.String,
      fields: Schema.Struct({
        summary: Schema.String,
        status: JiraStatus,
        assignee: Schema.NullOr(JiraUser),
      }),
    }),
  ),
});

export const useJiraIssues = (jql: string, enabled = true) => {
  const site = useJiraSite();
  return useQuery({
    queryKey: jiraKeys.issues(jql),
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({
        jql,
        fields: "summary,status,assignee",
        maxResults: "50",
      });
      return Effect.runPromise(jira(`/search/jql?${params}`, IssuePage), { signal });
    },
    enabled: !!site.data && enabled,
  });
};

const Filters = Schema.Array(Schema.Struct({ id: Schema.String, name: Schema.String, favourite: Schema.optional(Schema.Boolean) }));

export const useJiraFilters = () => {
  const site = useJiraSite();
  return useQuery({
    queryKey: jiraKeys.filters,
    queryFn: ({ signal }) =>
      Effect.runPromise(jira("/filter/my?includeFavourites=true", Filters), { signal }),
    enabled: !!site.data,
  });
};

export type JiraFilter = (typeof Filters.Type)[number];

const BoardPage = Schema.Struct({
  values: Schema.Array(
    Schema.Struct({
      id: Schema.Number,
      name: Schema.String,
      type: Schema.String,
      location: Schema.optional(Schema.Struct({ projectKey: Schema.optional(Schema.String) })),
    }),
  ),
});

export const useJiraProjectBoards = (key: string) => {
  const site = useJiraSite();
  return useQuery({
    queryKey: jiraKeys.projectBoards(key),
    queryFn: ({ signal }) =>
      Effect.runPromise(
        jiraAgile(`/board?projectLocation=${encodeURIComponent(key)}&maxResults=50`, BoardPage).pipe(
          Effect.map(({ values }) => ({ values: values.filter((board) => board.location?.projectKey === key) })),
        ),
        { signal },
      ),
    enabled: !!site.data,
  });
};

export type JiraBoard = (typeof BoardPage.Type)["values"][number];

const BoardConfiguration = Schema.Struct({
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

export const BACKLOG = "backlog";

export type BoardSprint = number | typeof BACKLOG;

const sprintClause = (board: JiraBoard, sprint?: number) => {
  if (sprint !== undefined) return ` AND sprint = ${sprint}`;
  return board.type === "scrum" ? " AND sprint in openSprints()" : "";
};

export const useJiraBacklogJql = (board: JiraBoard) => {
  const site = useJiraSite();
  return useQuery({
    queryKey: jiraKeys.boardConfig(board.id),
    queryFn: ({ signal }) => Effect.runPromise(jiraAgile(`/board/${board.id}/configuration`, BoardConfiguration), { signal }),
    select: (config) =>
      `filter = ${config.filter.id} AND (sprint is EMPTY OR sprint not in openSprints() AND sprint not in futureSprints()) AND statusCategory != Done ORDER BY Rank ASC`,
    enabled: !!site.data,
  });
};

const SprintPage = Schema.Struct({ values: Sprints, isLast: Schema.optional(Schema.Boolean) });

const MAX_SPRINT_PAGES = 20;

const boardSprints = (boardId: number) =>
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

export const useJiraBoardSprints = (board: JiraBoard) => {
  const site = useJiraSite();
  return useQuery({
    queryKey: jiraKeys.boardSprints(board.id),
    queryFn: ({ signal }) => Effect.runPromise(boardSprints(board.id), { signal }),
    enabled: !!site.data && board.type === "scrum",
  });
};

const Fields = Schema.Array(
  Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    schema: Schema.optional(Schema.Struct({ custom: Schema.optional(Schema.String) })),
  }),
);

const BoardIssuePage = Schema.Struct({
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

const isSprints = Schema.is(Sprints);

const enteredColumn = (issue: BoardIssue, statusIds: string[]) =>
  issue.changelog?.histories.find((history) =>
    history.items.some((item) => item.field === "status" && !statusIds.includes(item.from ?? "")),
  )?.created ?? issue.fields.created;

const boardWithIssues = (board: JiraBoard, sprintId?: number) =>
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
    const { issues } = yield* jira(`/search/jql?${params}`, BoardIssuePage);
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

export const useJiraBoard = (board: JiraBoard, sprintId?: number, enabled = true) => {
  const site = useJiraSite();
  return useQuery({
    queryKey: jiraKeys.board(board.id, sprintId),
    queryFn: ({ signal }) => Effect.runPromise(boardWithIssues(board, sprintId), { signal }),
    enabled: !!site.data && enabled,
  });
};

export const useJiraLogin = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: runLogin,
    onSuccess: () => queryClient.resetQueries({ queryKey: jiraKeys.all }),
  });
};

export const useJiraLogout = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => Effect.runPromise(logout),
    onSuccess: () => queryClient.resetQueries({ queryKey: jiraKeys.all }),
  });
};

const MyWorkPage = Schema.Struct({
  issues: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      key: Schema.String,
      fields: Schema.Struct({
        summary: Schema.String,
        updated: Schema.String,
        status: Schema.Struct({
          name: Schema.String,
          statusCategory: Schema.Struct({ key: Schema.String, colorName: Schema.String }),
        }),
        project: Schema.Struct({ id: Schema.String, key: Schema.String, name: Schema.String }),
        priority: Schema.optional(Schema.NullOr(Schema.Struct({ name: Schema.String }))),
      }),
    }),
  ),
});

export type JiraWorkIssue = (typeof MyWorkPage.Type)["issues"][number];

export const useJiraMyWork = () => {
  const site = useJiraSite();
  return useQuery({
    queryKey: jiraKeys.myWork,
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({
        jql: "assignee = currentUser() AND (statusCategory != Done OR resolved >= -7d) ORDER BY updated DESC",
        fields: "summary,status,updated,project,priority",
        maxResults: "100",
      });
      return Effect.runPromise(jira(`/search/jql?${params}`, MyWorkPage), { signal });
    },
    enabled: !!site.data,
  });
};

const EditField = Schema.Struct({
  required: Schema.Boolean,
  name: Schema.String,
  schema: Schema.Struct({
    type: Schema.String,
    items: Schema.optional(Schema.String),
    system: Schema.optional(Schema.String),
    custom: Schema.optional(Schema.String),
  }),
  allowedValues: Schema.optional(Schema.Array(Schema.Unknown)),
  operations: Schema.optional(Schema.Array(Schema.String)),
});

export type JiraEditField = typeof EditField.Type;

const IssueUser = Schema.Struct({
  accountId: Schema.optional(Schema.String),
  displayName: Schema.String,
  avatarUrls: Schema.Struct({ "48x48": Schema.String }),
});

const IssueDetail = Schema.Struct({
  id: Schema.String,
  key: Schema.String,
  names: Schema.Record(Schema.String, Schema.String),
  editmeta: Schema.Struct({ fields: Schema.Record(Schema.String, EditField) }),
  fields: Schema.StructWithRest(
    Schema.Struct({
      summary: Schema.String,
      description: Schema.optional(Schema.NullOr(Schema.Unknown)),
      status: JiraStatus,
      created: Schema.String,
      updated: Schema.String,
      issuetype: Schema.Struct({ name: Schema.String }),
      project: Schema.Struct({ key: Schema.String, name: Schema.String }),
      parent: Schema.optional(Schema.Struct({ key: Schema.String, fields: Schema.Struct({ summary: Schema.String }) })),
      subtasks: Schema.optional(
        Schema.Array(Schema.Struct({ id: Schema.String, key: Schema.String, fields: Schema.Struct({ summary: Schema.String, status: JiraStatus }) })),
      ),
      comment: Schema.optional(
        Schema.Struct({
          comments: Schema.Array(
            Schema.Struct({ id: Schema.String, author: Schema.optional(IssueUser), body: Schema.Unknown, created: Schema.String }),
          ),
        }),
      ),
      attachment: Schema.optional(
        Schema.Array(
          Schema.Struct({
            id: Schema.String,
            filename: Schema.String,
            size: Schema.Number,
            mimeType: Schema.String,
            created: Schema.String,
            author: Schema.optional(IssueUser),
          }),
        ),
      ),
      timetracking: Schema.optional(
        Schema.Struct({
          originalEstimate: Schema.optional(Schema.String),
          remainingEstimate: Schema.optional(Schema.String),
          timeSpent: Schema.optional(Schema.String),
        }),
      ),
      worklog: Schema.optional(
        Schema.Struct({
          total: Schema.Number,
          worklogs: Schema.Array(
            Schema.Struct({
              id: Schema.String,
              author: Schema.optional(IssueUser),
              timeSpent: Schema.String,
              started: Schema.String,
              comment: Schema.optional(Schema.Unknown),
            }),
          ),
        }),
      ),
    }),
    [Schema.Record(Schema.String, Schema.Unknown)],
  ),
});

export type JiraIssueDetail = typeof IssueDetail.Type;

export const useJiraIssue = (key: string) => {
  const site = useJiraSite();
  return useQuery({
    queryKey: jiraKeys.issue(key),
    queryFn: ({ signal }) =>
      Effect.runPromise(jira(`/issue/${encodeURIComponent(key)}?fields=*all&expand=names,editmeta`, IssueDetail), { signal }),
    enabled: !!site.data,
  });
};

const TransitionField = Schema.Struct({
  required: Schema.Boolean,
  name: Schema.String,
  schema: Schema.Struct({
    type: Schema.String,
    items: Schema.optional(Schema.String),
    system: Schema.optional(Schema.String),
    custom: Schema.optional(Schema.String),
  }),
  allowedValues: Schema.optional(Schema.Array(Schema.Unknown)),
});

const Transitions = Schema.Struct({
  transitions: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      name: Schema.String,
      to: JiraStatus,
      fields: Schema.optional(Schema.Record(Schema.String, TransitionField)),
    }),
  ),
});

const IssueFieldValues = Schema.Struct({ fields: Schema.Record(Schema.String, Schema.Unknown) });

export type JiraTransition = (typeof Transitions.Type)["transitions"][number];
export type JiraTransitionField = typeof TransitionField.Type;

const transitionsWithValues = (key: string) =>
  Effect.gen(function* () {
    const path = `/issue/${encodeURIComponent(key)}`;
    const { transitions } = yield* jira(`${path}/transitions?expand=transitions.fields`, Transitions);
    const ids = [...new Set(transitions.flatMap((transition) => Object.keys(transition.fields ?? {})))];
    if (ids.length === 0) return { transitions, current: {} };
    const { fields } = yield* jira(`${path}?${new URLSearchParams({ fields: ids.join(",") })}`, IssueFieldValues);
    return { transitions, current: fields };
  });

export const transitionsQuery = (key: string) => ({
  queryKey: jiraKeys.transitions(key),
  queryFn: ({ signal }: { signal: AbortSignal }) => Effect.runPromise(transitionsWithValues(key), { signal }),
});

export const useJiraTransitions = (key: string, enabled: boolean) => {
  const site = useJiraSite();
  return useQuery({ ...transitionsQuery(key), enabled: enabled && !!site.data, staleTime: 0 });
};

export type JiraTransitionRequest = {
  issueKey: string;
  body: {
    transition: { id: string };
    fields?: Record<string, unknown>;
    update?: Record<string, unknown>;
  };
};

export const useJiraTransition = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["jira", "transition"],
    mutationFn: ({ issueKey, body }: JiraTransitionRequest) =>
      Effect.runPromise(
        jiraSend(`/issue/${encodeURIComponent(issueKey)}/transitions`, { method: "POST", body: JSON.stringify(body) }),
      ),
    onSuccess: (_, { issueKey }) =>
      Promise.all(
        [jiraKeys.issue(issueKey), jiraKeys.transitions(issueKey), jiraKeys.myWork, ["jira", "issues"], ["jira", "board"]].map(
          (queryKey) => queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  });
};

const SearchUser = {
  accountId: Schema.String,
  accountType: Schema.optional(Schema.String),
  displayName: Schema.optional(Schema.NullOr(Schema.String)),
};
const AssignableUsers = Schema.Array(Schema.Struct({ ...SearchUser, avatarUrls: Schema.Struct({ "48x48": Schema.String }) }));
const PickerUsers = Schema.Struct({ users: Schema.Array(Schema.Struct({ ...SearchUser, avatarUrl: Schema.optional(Schema.String) })) });

export type JiraUserResult = { accountId: string; displayName: string; avatarUrls: { "48x48": string } };

const toUserResult = (user: { accountId: string; displayName?: string | null }, avatar = ""): JiraUserResult => ({
  accountId: user.accountId,
  displayName: user.displayName ?? "Unbekannt",
  avatarUrls: { "48x48": avatar },
});

export type UserSearchScope = { issueKey?: string; assignee?: boolean };

const searchUsers = (query: string, { issueKey, assignee }: UserSearchScope) =>
  Effect.gen(function* () {
    const assignableRequest = issueKey
      ? jira(`/user/assignable/search?${new URLSearchParams({ query, issueKey, maxResults: "20" })}`, AssignableUsers).pipe(
          Effect.map((users) => users.filter((user) => user.accountType !== "app")),
          Effect.orElseSucceed(() => undefined),
        )
      : Effect.succeed(undefined);
    const pickerRequest = jira(`/user/picker?${new URLSearchParams({ query, maxResults: "20", showAvatar: "true" })}`, PickerUsers).pipe(
      Effect.map(({ users }) => users.filter((user) => user.accountType !== "app")),
    );
    const [assignable, picker] = yield* Effect.all([assignableRequest, pickerRequest], { concurrency: "unbounded" });
    const users = [
      ...(assignable ?? []).map((user) => toUserResult(user, user.avatarUrls["48x48"])),
      ...(assignee && assignable ? [] : picker.map((user) => toUserResult(user, user.avatarUrl))),
    ];
    return users.filter((user, index) => users.findIndex((other) => other.accountId === user.accountId) === index).slice(0, 10);
  });

export const useJiraUserSearch = (query: string, scope: UserSearchScope = {}) => {
  const site = useJiraSite();
  return useQuery({
    queryKey: jiraKeys.userSearch(query, scope.issueKey ?? "", !!scope.assignee),
    queryFn: ({ signal }) => Effect.runPromise(searchUsers(query, scope), { signal }),
    enabled: query.trim().length > 0 && !!site.data,
    placeholderData: (previous) => previous,
  });
};
