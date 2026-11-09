import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { Effect, Schema } from "effect";
import { currentSite, jira, jiraImage, jiraSend, logout, runLogin } from "./client";
import { JiraStatus } from "./status";
import { JiraUser } from "./user";
import { withJiraQueryScope, type JiraQueryScope } from "./query-scope";

export const jiraKeys = {
  all: ["jira"] as const,
  allIssues: ["jira", "issues"] as const,
  allBoards: ["jira", "board"] as const,
  attachment: (variant: string, id: string) => ["jira", "attachment", variant, id] as const,
  wiki: (key: string, field: string) => ["jira", "wiki", key, field] as const,
  site: ["jira", "site"] as const,
  myself: ["jira", "myself"] as const,
  projects: ["jira", "projects"] as const,
  avatar: (url: string) => ["jira", "avatar", url] as const,
  issues: (jql: string) => ["jira", "issues", jql] as const,
  search: (jql: string, fields: readonly string[], pageSize: number) => ["jira", "issues", "search", jql, fields, pageSize] as const,
  issueCount: (jql: string) => ["jira", "issues", "count", jql] as const,
  fieldCatalog: ["jira", "field-catalog"] as const,
  filter: (id: string) => ["jira", "filter", id] as const,
  filterFavourite: ["jira", "filter-favourite"] as const,
  jqlValidation: (jql: string) => ["jira", "jql-validation", jql] as const,
  issue: (key: string) => ["jira", "issue", key] as const,
  issueDetail: (key: string, scope: JiraQueryScope | undefined) => ["jira", "issue", key, "detail", scope?.cloudId ?? "", scope?.accountId ?? ""] as const,
  transitions: (key: string) => ["jira", "transitions", key] as const,
  userSearch: (query: string, issueKey: string, assignee: boolean) => ["jira", "user-search", query, issueKey, assignee] as const,
  filters: ["jira", "filters"] as const,
  myWork: ["jira", "my-work"] as const,
  projectBoards: (key: string) => ["jira", "project-boards", key] as const,
  board: (id: number, sprint?: number) => ["jira", "board", id, sprint ?? "open"] as const,
  boardSprints: (id: number) => ["jira", "board-sprints", id] as const,
  boardConfig: (id: number) => ["jira", "board-config", id] as const,
  projectStats: (key: string) => ["jira", "project-stats", key] as const,
  allProjectStats: ["jira", "project-stats"] as const,
  createIssueTypes: (projectId: string) => ["jira", "create-meta", projectId] as const,
  createFields: (projectId: string, issueTypeId: string) => ["jira", "create-meta", projectId, issueTypeId] as const,
  createPermission: (projectId: string) => ["jira", "create-permission", projectId] as const,
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

export const IssueComment = Schema.Struct({
  id: Schema.String,
  author: Schema.optional(IssueUser),
  body: Schema.Unknown,
  created: Schema.String,
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
          startAt: Schema.optional(Schema.Number),
          maxResults: Schema.optional(Schema.Number),
          total: Schema.optional(Schema.Number),
          comments: Schema.Array(IssueComment),
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

export const issueQuery = (key: string, scope: JiraQueryScope | undefined, client: QueryClient) => ({
  queryKey: jiraKeys.issueDetail(key, scope),
  enabled: !!scope,
  retryOnMount: false,
  queryFn: ({ signal }: { signal: AbortSignal }) =>
    Effect.runPromise(withJiraQueryScope(client, scope, jira(`/issue/${encodeURIComponent(key)}?fields=*all&expand=names,editmeta`, IssueDetail)), { signal }),
});

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
