import { parseJql } from "./mock-jql";
import { FIELD, SITE_URL, type MockBoard, type MockFilter } from "./mock-data";
import { JiraHttpError, type ApiVersion, type MockJira } from "./mock-store";

export type RouteName =
  | "myself"
  | "projects"
  | "fields"
  | "search"
  | "count"
  | "jql-parse"
  | "filters"
  | "filter"
  | "filter-create"
  | "filter-update"
  | "filter-delete"
  | "filter-favourite"
  | "issue"
  | "issue-create"
  | "issue-edit"
  | "transitions"
  | "transition"
  | "assignee"
  | "comments"
  | "comment-add"
  | "worklogs"
  | "worklog-add"
  | "attachments-add"
  | "remotelinks"
  | "changelog"
  | "users-assignable"
  | "users-picker"
  | "boards"
  | "board"
  | "board-config"
  | "board-sprints"
  | "board-issues"
  | "board-backlog"
  | "sprint-issues"
  | "rank";

export type RouteRequest = { method: string; version: ApiVersion; query: URLSearchParams; body: unknown; params: string[] };
export type RouteResult = { status?: number; body?: unknown; items?: number };

type Route = { name: RouteName; method: string; api: "rest" | "agile"; pattern: RegExp; handle: (request: RouteRequest) => RouteResult };

export const PAGE_CAPS = { search: 100, searchIdsOnly: 5000, agileIssues: 100, agile: 50, projects: 50, changelog: 100, users: 1000, comments: 5000, worklogs: 5000 } as const;

const KEY = "([^/]+)";
const NUMBER = "(\\d+)";
const COLUMNS = [
  { name: "To Do", statuses: [0, 1] },
  { name: "In Progress", statuses: [2] },
  { name: "In Review", statuses: [3] },
  { name: "Done", statuses: [4] },
];

const hash = (value: string) => {
  let result = 5381;
  for (let index = 0; index < value.length; index++) result = (Math.imul(result, 33) ^ value.charCodeAt(index)) >>> 0;
  return result.toString(36);
};

const record = (value: unknown) => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});

export const createRoutes = (jira: MockJira, pageLimit = Infinity) => {
  const { dataset } = jira;
  const { me, users, projects, boards, sprints, filters, statuses } = dataset;
  let nextFilterId = Math.max(19999, ...[...filters.keys()].map(Number)) + 1;

  const integer = (value: string | number | null | undefined, fallback: number, name: string) => {
    if (value === null || value === undefined || value === "") return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0) throw new JiraHttpError(400, [`The '${name}' parameter must be a non-negative integer.`]);
    return parsed;
  };
  const pageSize = (value: string | number | null | undefined, fallback: number, cap: number) => Math.min(integer(value, fallback, "maxResults"), cap, pageLimit);
  const offsetPage = <T>(items: readonly T[], query: URLSearchParams, fallback: number, cap: number) => {
    const startAt = integer(query.get("startAt"), 0, "startAt");
    const maxResults = pageSize(query.get("maxResults"), fallback, cap);
    const values = items.slice(startAt, startAt + maxResults);
    return { startAt, maxResults, total: items.length, isLast: startAt + values.length >= items.length, values };
  };
  const expandOf = (value: unknown) => new Set(typeof value === "string" ? value.split(",").map((part) => part.trim()) : Array.isArray(value) ? value : []);

  const filterJson = (filter: MockFilter) => ({ ...filter, owner: { accountId: filter.owner.accountId, displayName: filter.owner.displayName }, searchUrl: `${SITE_URL}/rest/api/3/search/jql?jql=${encodeURIComponent(filter.jql)}`, viewUrl: `${SITE_URL}/issues/?filter=${filter.id}` });
  const findFilter = (id: string) => {
    const filter = filters.get(id);
    if (!filter) throw new JiraHttpError(400, [`The selected filter is not available to you, perhaps it has been deleted or had its permissions changed.`]);
    return filter;
  };
  const filterInput = (body: unknown, current?: MockFilter) => {
    const input = record(body);
    const name = typeof input.name === "string" ? input.name.trim() : (current?.name ?? "");
    const jql = typeof input.jql === "string" ? input.jql : (current?.jql ?? "");
    if (!name) throw new JiraHttpError(400, [], { filterName: "You must specify a name to save this filter as." });
    if ([...filters.values()].some((filter) => filter.name === name && filter.id !== current?.id)) throw new JiraHttpError(400, [], { filterName: "Filter with same name already exists." });
    const errors = jira.validate(jql);
    if (errors.length > 0) throw new JiraHttpError(400, errors);
    return { name, jql, description: typeof input.description === "string" ? input.description : (current?.description ?? "") };
  };

  const boardJson = (board: MockBoard) => {
    const project = projects[board.projectIndex];
    return {
      id: board.id,
      self: board.self,
      name: board.name,
      type: board.type,
      location: { projectId: Number(project.id), displayName: `${project.name} (${project.key})`, projectName: project.name, projectKey: project.key, projectTypeKey: project.projectTypeKey, avatarURI: project.avatarUrls["48x48"], name: `${project.name} (${project.key})` },
    };
  };

  const matchingUsers = (query: string | null) => {
    const needle = (query ?? "").toLowerCase();
    return users.filter((user) => user.displayName.toLowerCase().includes(needle) || user.emailAddress.toLowerCase().includes(needle));
  };

  const searchInput = (request: RouteRequest) => {
    if (request.method !== "POST") {
      const { query } = request;
      return { jql: query.get("jql") ?? "", fields: query.get("fields"), maxResults: query.get("maxResults"), nextPageToken: query.get("nextPageToken"), expand: query.get("expand") };
    }
    const body = record(request.body);
    return {
      jql: typeof body.jql === "string" ? body.jql : "",
      fields: Array.isArray(body.fields) ? body.fields.join(",") : null,
      maxResults: typeof body.maxResults === "number" ? body.maxResults : null,
      nextPageToken: typeof body.nextPageToken === "string" ? body.nextPageToken : null,
      expand: body.expand,
    };
  };

  const search = (request: RouteRequest): RouteResult => {
    const input = searchInput(request);
    if (parseJql(input.jql).where === undefined) throw new JiraHttpError(400, ["Unbounded JQL queries are not allowed here. Please add a search restriction to your query."]);
    const fields = jira.requestedFields(input.fields, ["id"]);
    const idsOnly = fields.every((field) => field === "id" || field === "key");
    const maxResults = pageSize(input.maxResults, 50, idsOnly ? PAGE_CAPS.searchIdsOnly : PAGE_CAPS.search);
    const queryHash = hash(input.jql);
    let offset = 0;
    if (input.nextPageToken) {
      try {
        const token = JSON.parse(atob(input.nextPageToken)) as { q?: string; o?: number };
        if (token.q !== queryHash || !Number.isInteger(token.o)) throw new Error("mismatch");
        offset = token.o!;
      } catch {
        throw new JiraHttpError(400, ["The provided next page token is invalid or expired."]);
      }
    }
    const matches = jira.search(input.jql);
    const page = matches.slice(offset, offset + maxResults);
    const nextOffset = offset + page.length;
    const isLast = nextOffset >= matches.length || page.length === 0;
    const options = { fields, expand: expandOf(input.expand), api: request.version };
    return {
      body: {
        issues: page.map((issue) => jira.serialize(issue, options)),
        ...(!isLast && { nextPageToken: btoa(JSON.stringify({ q: queryHash, o: nextOffset })) }),
        isLast,
      },
      items: page.length,
    };
  };

  const agileIssues = (request: RouteRequest, scope: string): RouteResult => {
    const { query } = request;
    const matches = jira.search(query.get("jql") || "", scope);
    const { startAt, maxResults, total, values } = offsetPage(matches, query, 50, PAGE_CAPS.agileIssues);
    const options = { fields: jira.requestedFields(query.get("fields"), dataset.fields.map((field) => field.id)), expand: expandOf(query.get("expand")), api: "3" as const };
    return { body: { expand: "schema,names", startAt, maxResults, total, issues: values.map((issue) => jira.serialize(issue, options)) }, items: values.length };
  };

  const scrumBoard = (id: string) => {
    const board = jira.boardById(Number(id));
    if (board.type !== "scrum") throw new JiraHttpError(400, ["The board does not support sprints"]);
    return board;
  };

  const routes: Route[] = [
    { name: "myself", method: "GET", api: "rest", pattern: /^\/myself$/, handle: () => ({ body: { ...me, locale: "en_US", groups: { size: 1, items: [] }, applicationRoles: { size: 1, items: [] } } }) },
    {
      name: "projects",
      method: "GET",
      api: "rest",
      pattern: /^\/project\/search$/,
      handle: ({ query }) => {
        const needle = (query.get("query") ?? "").toLowerCase();
        const orderBy = query.get("orderBy") ?? "key";
        const sorted = projects
          .filter((project) => project.key.toLowerCase().includes(needle) || project.name.toLowerCase().includes(needle))
          .sort((a, b) => (orderBy.replace(/^[+-]/, "") === "name" ? a.name.localeCompare(b.name) : a.key.localeCompare(b.key)) * (orderBy.startsWith("-") ? -1 : 1));
        const page = offsetPage(sorted, query, 50, PAGE_CAPS.projects);
        return { body: { self: `${SITE_URL}/rest/api/3/project/search`, ...page }, items: page.values.length };
      },
    },
    { name: "fields", method: "GET", api: "rest", pattern: /^\/field$/, handle: () => ({ body: dataset.fields, items: dataset.fields.length }) },
    { name: "search", method: "GET", api: "rest", pattern: /^\/search\/jql$/, handle: search },
    { name: "search", method: "POST", api: "rest", pattern: /^\/search\/jql$/, handle: search },
    {
      name: "count",
      method: "POST",
      api: "rest",
      pattern: /^\/search\/approximate-count$/,
      handle: ({ body }) => {
        const jql = record(body).jql;
        if (typeof jql !== "string") throw new JiraHttpError(400, ["The JQL query is required."]);
        return { body: { count: jira.search(jql).length } };
      },
    },
    {
      name: "jql-parse",
      method: "POST",
      api: "rest",
      pattern: /^\/jql\/parse$/,
      handle: ({ body }) => {
        const queries = record(body).queries;
        if (!Array.isArray(queries)) throw new JiraHttpError(400, ["queries must be a list of JQL strings."]);
        return { body: { queries: queries.map((query) => ({ query, ...(jira.validate(String(query)).length > 0 && { errors: jira.validate(String(query)) }) })) } };
      },
    },
    {
      name: "filters",
      method: "GET",
      api: "rest",
      pattern: /^\/filter\/my$/,
      handle: () => {
        const own = [...filters.values()].filter((filter) => filter.owner.accountId === me.accountId).map(filterJson);
        return { body: own, items: own.length };
      },
    },
    { name: "filter", method: "GET", api: "rest", pattern: new RegExp(`^/filter/${NUMBER}$`), handle: ({ params }) => ({ body: filterJson(findFilter(params[0])) }) },
    {
      name: "filter-create",
      method: "POST",
      api: "rest",
      pattern: /^\/filter$/,
      handle: ({ body }) => {
        const input = filterInput(body);
        const id = String(nextFilterId++);
        const filter: MockFilter = { self: `${SITE_URL}/rest/api/3/filter/${id}`, id, ...input, favourite: true, owner: me };
        filters.set(id, filter);
        jira.touch();
        return { body: filterJson(filter) };
      },
    },
    {
      name: "filter-update",
      method: "PUT",
      api: "rest",
      pattern: new RegExp(`^/filter/${NUMBER}$`),
      handle: ({ params, body }) => {
        const filter = findFilter(params[0]);
        Object.assign(filter, filterInput(body, filter));
        jira.touch();
        return { body: filterJson(filter) };
      },
    },
    {
      name: "filter-delete",
      method: "DELETE",
      api: "rest",
      pattern: new RegExp(`^/filter/${NUMBER}$`),
      handle: ({ params }) => {
        findFilter(params[0]);
        filters.delete(params[0]);
        jira.touch();
        return { status: 204 };
      },
    },
    ...(["PUT", "DELETE"] as const).map(
      (method): Route => ({
        name: "filter-favourite",
        method,
        api: "rest",
        pattern: new RegExp(`^/filter/${NUMBER}/favourite$`),
        handle: ({ params }) => {
          const filter = findFilter(params[0]);
          filter.favourite = method === "PUT";
          return { body: filterJson(filter) };
        },
      }),
    ),
    {
      name: "issue-create",
      method: "POST",
      api: "rest",
      pattern: /^\/issue$/,
      handle: ({ body }) => {
        const issue = jira.createIssue(record(body));
        return { status: 201, body: { id: issue.id, key: issue.key, self: `${SITE_URL}/rest/api/3/issue/${issue.id}` } };
      },
    },
    {
      name: "issue",
      method: "GET",
      api: "rest",
      pattern: new RegExp(`^/issue/${KEY}$`),
      handle: ({ params, query, version }) => {
        const issue = jira.findIssue(params[0]);
        const fields = jira.requestedFields(query.get("fields"), dataset.fields.map((field) => field.id));
        return { body: jira.serialize(issue, { fields, expand: expandOf(query.get("expand")), api: version }) };
      },
    },
    {
      name: "issue-edit",
      method: "PUT",
      api: "rest",
      pattern: new RegExp(`^/issue/${KEY}$`),
      handle: ({ params, body }) => {
        jira.editIssue(params[0], record(body));
        return { status: 204 };
      },
    },
    {
      name: "transitions",
      method: "GET",
      api: "rest",
      pattern: new RegExp(`^/issue/${KEY}/transitions$`),
      handle: ({ params, query }) => {
        const transitions = jira.transitionsFor(jira.findIssue(params[0]), expandOf(query.get("expand")).has("transitions.fields"));
        return { body: { expand: "transitions", transitions }, items: transitions.length };
      },
    },
    {
      name: "transition",
      method: "POST",
      api: "rest",
      pattern: new RegExp(`^/issue/${KEY}/transitions$`),
      handle: ({ params, body }) => {
        jira.transition(params[0], record(body));
        return { status: 204 };
      },
    },
    {
      name: "assignee",
      method: "PUT",
      api: "rest",
      pattern: new RegExp(`^/issue/${KEY}/assignee$`),
      handle: ({ params, body }) => {
        jira.editIssue(params[0], { fields: { assignee: { accountId: record(body).accountId ?? null } } });
        return { status: 204 };
      },
    },
    {
      name: "comments",
      method: "GET",
      api: "rest",
      pattern: new RegExp(`^/issue/${KEY}/comment$`),
      handle: ({ params, query, version }) => {
        const issue = jira.findIssue(params[0]);
        const sorted = query.get("orderBy") === "-created" ? [...issue.comments].reverse() : issue.comments;
        const { values, isLast: _, ...page } = offsetPage(sorted, query, 5000, PAGE_CAPS.comments);
        return { body: { ...page, comments: values.map((comment) => jira.commentJson(comment, version)) }, items: values.length };
      },
    },
    {
      name: "comment-add",
      method: "POST",
      api: "rest",
      pattern: new RegExp(`^/issue/${KEY}/comment$`),
      handle: ({ params, body, version }) => ({ status: 201, body: jira.commentJson(jira.addComment(params[0], record(body).body), version) }),
    },
    {
      name: "worklogs",
      method: "GET",
      api: "rest",
      pattern: new RegExp(`^/issue/${KEY}/worklog$`),
      handle: ({ params, query, version }) => {
        const issue = jira.findIssue(params[0]);
        const after = Number(query.get("startedAfter") ?? -Infinity);
        const before = Number(query.get("startedBefore") ?? Infinity);
        const inRange = issue.worklogs.filter((worklog) => Date.parse(worklog.started) >= after && Date.parse(worklog.started) < before);
        const { values, isLast: _, ...page } = offsetPage(inRange, query, 5000, PAGE_CAPS.worklogs);
        return { body: { ...page, worklogs: values.map((worklog) => jira.worklogJson(worklog, version)) }, items: values.length };
      },
    },
    {
      name: "worklog-add",
      method: "POST",
      api: "rest",
      pattern: new RegExp(`^/issue/${KEY}/worklog$`),
      handle: ({ params, body, version }) => ({ status: 201, body: jira.worklogJson(jira.addWorklog(params[0], record(body)), version) }),
    },
    {
      name: "attachments-add",
      method: "POST",
      api: "rest",
      pattern: new RegExp(`^/issue/${KEY}/attachments$`),
      handle: ({ params, body }) => {
        if (!(body instanceof FormData)) throw new JiraHttpError(415, ["Attachments must be sent as multipart/form-data."]);
        const files = body.getAll("file").filter((entry): entry is File => typeof entry !== "string");
        const added = jira.addAttachments(params[0], files);
        return { body: added, items: added.length };
      },
    },
    {
      name: "remotelinks",
      method: "GET",
      api: "rest",
      pattern: new RegExp(`^/issue/${KEY}/remotelink$`),
      handle: ({ params }) => {
        jira.findIssue(params[0]);
        return { body: [] };
      },
    },
    {
      name: "changelog",
      method: "GET",
      api: "rest",
      pattern: new RegExp(`^/issue/${KEY}/changelog$`),
      handle: ({ params, query }) => {
        const issue = jira.findIssue(params[0]);
        const page = offsetPage([...issue.histories].reverse(), query, 100, PAGE_CAPS.changelog);
        return { body: { self: `${SITE_URL}/rest/api/3/issue/${issue.key}/changelog`, ...page }, items: page.values.length };
      },
    },
    {
      name: "users-assignable",
      method: "GET",
      api: "rest",
      pattern: /^\/user\/assignable\/search$/,
      handle: ({ query }) => {
        const issueKey = query.get("issueKey");
        if (issueKey) jira.findIssue(issueKey);
        const found = matchingUsers(query.get("query")).slice(integer(query.get("startAt"), 0, "startAt")).slice(0, pageSize(query.get("maxResults"), 50, PAGE_CAPS.users));
        return { body: found, items: found.length };
      },
    },
    {
      name: "users-picker",
      method: "GET",
      api: "rest",
      pattern: /^\/user\/picker$/,
      handle: ({ query }) => {
        const all = matchingUsers(query.get("query"));
        const found = all.slice(0, pageSize(query.get("maxResults"), 50, PAGE_CAPS.users));
        return {
          body: {
            users: found.map((user) => ({ accountId: user.accountId, accountType: user.accountType, html: user.displayName, displayName: user.displayName, avatarUrl: user.avatarUrls["24x24"] })),
            total: all.length,
            header: `Showing ${found.length} of ${all.length} matching users`,
          },
          items: found.length,
        };
      },
    },
    {
      name: "boards",
      method: "GET",
      api: "agile",
      pattern: /^\/board$/,
      handle: ({ query }) => {
        const project = query.get("projectKeyOrId") ?? query.get("projectLocation");
        const type = query.get("type");
        const name = (query.get("name") ?? "").toLowerCase();
        const matching = boards.filter((board) => {
          const own = projects[board.projectIndex];
          return (!project || own.key === project || own.id === project) && (!type || type.split(",").includes(board.type)) && board.name.toLowerCase().includes(name);
        });
        const page = offsetPage(matching.map(boardJson), query, 50, PAGE_CAPS.agile);
        return { body: page, items: page.values.length };
      },
    },
    { name: "board", method: "GET", api: "agile", pattern: new RegExp(`^/board/${NUMBER}$`), handle: ({ params }) => ({ body: boardJson(jira.boardById(Number(params[0]))) }) },
    {
      name: "board-config",
      method: "GET",
      api: "agile",
      pattern: new RegExp(`^/board/${NUMBER}/configuration$`),
      handle: ({ params }) => {
        const board = jira.boardById(Number(params[0]));
        const project = projects[board.projectIndex];
        return {
          body: {
            id: board.id,
            name: board.name,
            type: board.type,
            self: `${board.self}/configuration`,
            location: { type: "project", key: project.key, id: project.id, self: project.self, name: project.name },
            filter: { id: board.filterId, self: `${SITE_URL}/rest/api/3/filter/${board.filterId}` },
            columnConfig: {
              columns: COLUMNS.map((column) => ({ name: column.name, statuses: column.statuses.map((index) => ({ id: statuses[index].id, self: statuses[index].self })) })),
              constraintType: "issueCount",
            },
            estimation: { type: "field", field: { fieldId: FIELD.points, displayName: "Story Points" } },
            ranking: { rankCustomFieldId: Number(FIELD.rank.slice("customfield_".length)) },
          },
        };
      },
    },
    {
      name: "board-sprints",
      method: "GET",
      api: "agile",
      pattern: new RegExp(`^/board/${NUMBER}/sprint$`),
      handle: ({ params, query }) => {
        const board = scrumBoard(params[0]);
        const states = query.get("state")?.split(",").map((state) => state.trim());
        const matching = sprints.filter((sprint) => sprint.boardId === board.id && (!states || states.includes(sprint.state)));
        const { total: _, ...page } = offsetPage(matching, query, 50, PAGE_CAPS.agile);
        return { body: page, items: page.values.length };
      },
    },
    { name: "board-issues", method: "GET", api: "agile", pattern: new RegExp(`^/board/${NUMBER}/issue$`), handle: (request) => agileIssues(request, `${jira.boardFilterJql(jira.boardById(Number(request.params[0])))} ORDER BY Rank ASC`) },
    {
      name: "board-backlog",
      method: "GET",
      api: "agile",
      pattern: new RegExp(`^/board/${NUMBER}/backlog$`),
      handle: (request) => agileIssues(request, `${jira.boardFilterJql(scrumBoard(request.params[0]))} AND (sprint is EMPTY OR sprint not in openSprints()) AND statusCategory != Done ORDER BY Rank ASC`),
    },
    {
      name: "sprint-issues",
      method: "GET",
      api: "agile",
      pattern: new RegExp(`^/sprint/${NUMBER}/issue$`),
      handle: (request) => {
        const sprint = jira.sprintById.get(Number(request.params[0]));
        if (!sprint) throw new JiraHttpError(404, [`Sprint ${request.params[0]} does not exist.`]);
        return agileIssues(request, `${jira.boardFilterJql(jira.boardById(sprint.boardId))} AND sprint = ${sprint.id} ORDER BY Rank ASC`);
      },
    },
    {
      name: "rank",
      method: "PUT",
      api: "agile",
      pattern: /^\/issue\/rank$/,
      handle: ({ body }) => {
        const input = record(body);
        const keys = Array.isArray(input.issues) ? input.issues.map(String) : [];
        jira.rankIssues(keys, { before: input.rankBeforeIssue as string | undefined, after: input.rankAfterIssue as string | undefined });
        return { status: 204 };
      },
    },
  ];

  return (method: string, api: "rest" | "agile", path: string) => {
    for (const route of routes) {
      if (route.method !== method || route.api !== api) continue;
      const match = route.pattern.exec(path);
      if (match) return { route, params: match.slice(1).map(decodeURIComponent) };
    }
    return undefined;
  };
};

export type RouteFinder = ReturnType<typeof createRoutes>;
