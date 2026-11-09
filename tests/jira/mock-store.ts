import { compileJql, JqlError, type CompiledJql, type JqlSchema } from "./mock-jql";
import {
  adf,
  adfText,
  DONE_STATUS_INDEX,
  FIELD,
  FLAGGED_VALUE,
  formatDuration,
  jiraDate,
  SITE_URL,
  summaryFor,
  type History,
  type HistoryItem,
  type JiraAttachment,
  type JiraComment,
  type JiraDataset,
  type JiraSprint,
  type JiraStatus,
  type JiraUser,
  type JiraWorklog,
  type MockBoard,
  type MockIssue,
  type Rng,
} from "./mock-data";

export class JiraHttpError extends Error {
  constructor(
    readonly status: number,
    readonly errorMessages: string[],
    readonly errors: Record<string, string> = {},
  ) {
    super(errorMessages[0] ?? Object.values(errors)[0] ?? `HTTP ${status}`);
  }
  get body() {
    return { errorMessages: this.errorMessages, errors: this.errors };
  }
}

export type ApiVersion = "2" | "3";

export type SerializeOptions = { fields: readonly string[]; expand: ReadonlySet<string>; api: ApiVersion };

type IssueSprint = Pick<JiraSprint, "id" | "name" | "state" | "boardId">;

const ALL_FIELDS = "*all";
const SECONDS: Record<string, number> = { w: 5 * 8 * 3600, d: 8 * 3600, h: 3600, m: 60 };
const EMBEDDED_WORKLOGS = 20;
const CHANGELOG_LIMIT = 100;
const PRIORITY_WEIGHT: Record<string, number> = { Highest: 5, High: 4, Medium: 3, Low: 2, Lowest: 1 };
const TRANSITION_OFFSET = 11;
const EDITABLE = ["summary", "description", "assignee", "priority", "labels", "duedate", FIELD.points, FIELD.flagged, FIELD.sprint];

export const parseDuration = (value: string) =>
  [...value.matchAll(/(\d+(?:\.\d+)?)\s*([wdhm])/gi)].reduce((total, [, amount, unit]) => total + Number(amount) * SECONDS[unit.toLowerCase()], 0);

const time = (value: unknown) => (typeof value === "string" ? Date.parse(value) : undefined);
const iso = (value: unknown) => (typeof value === "string" ? [new Date(Date.parse(value)).toISOString()] : []);
const userTokens = (value: unknown) => {
  const user = value as JiraUser | null | undefined;
  return user ? [user.accountId, user.displayName, user.emailAddress] : [];
};
const named = (value: unknown) => {
  const ref = value as { id?: string; name?: string } | null | undefined;
  return ref ? [ref.id, ref.name].filter((token): token is string => !!token) : [];
};

export const createMockJira = (dataset: JiraDataset, now: () => number) => {
  const { issues, byKey, me, statuses, users, sprints, filters, priorities, issueTypes, projects, boards } = dataset;
  const byId = new Map(issues.map((issue) => [issue.id, issue]));
  const sprintById = new Map(sprints.map((sprint) => [sprint.id, sprint]));
  const searchCache = new Map<string, MockIssue[]>();
  let version = 0;
  let sequence = 1_000_000;
  const nextId = () => String(sequence++);

  const touch = () => {
    version++;
    searchCache.clear();
  };

  const sprintsOf = (issue: MockIssue) => (issue.fields[FIELD.sprint] as IssueSprint[] | null) ?? [];
  const projectOf = (issue: MockIssue) => projects[issue.projectIndex];
  const findUser = (accountId: unknown) => users.find((user) => user.accountId === accountId);

  const schema: JqlSchema<MockIssue> = {
    fields: {},
    functions: {
      currentuser: () => [me.accountId],
      opensprints: () => sprints.filter((sprint) => sprint.state !== "closed").map((sprint) => String(sprint.id)),
      closedsprints: () => sprints.filter((sprint) => sprint.state === "closed").map((sprint) => String(sprint.id)),
      futuresprints: () => sprints.filter((sprint) => sprint.state === "future").map((sprint) => String(sprint.id)),
    },
    filter: (reference) => (filters.get(reference) ?? [...filters.values()].find((filter) => filter.name === reference))?.jql,
    sort: {
      rank: (issue) => issue.rank,
      [FIELD.rank]: (issue) => issue.rank,
      created: (issue) => time(issue.fields.created),
      updated: (issue) => time(issue.fields.updated),
      resolved: (issue) => time(issue.fields.resolutiondate),
      duedate: (issue) => time(issue.fields.duedate),
      key: (issue) => `${projectOf(issue).key}-${String(issue.number).padStart(9, "0")}`,
      id: (issue) => Number(issue.id),
      priority: (issue) => PRIORITY_WEIGHT[(issue.fields.priority as { name: string }).name],
      status: (issue) => (issue.fields.status as JiraStatus).name,
      summary: (issue) => String(issue.fields.summary).toLowerCase(),
      assignee: (issue) => (issue.fields.assignee as JiraUser | null)?.displayName,
    },
    defaultOrder: [{ field: "created", direction: "desc" }],
    now,
  };
  const bind = (names: string[], values: (issue: MockIssue) => readonly string[], type?: "text" | "date" | "number") => {
    for (const name of names) schema.fields[name] = { values, type };
  };
  bind(["project"], (issue) => [projectOf(issue).key, projectOf(issue).id, projectOf(issue).name]);
  bind(["key", "issuekey", "id"], (issue) => [issue.key, issue.id]);
  bind(["summary"], (issue) => [String(issue.fields.summary)], "text");
  bind(["description"], (issue) => [adfText(issue.fields.description)], "text");
  bind(["text"], (issue) => [String(issue.fields.summary), adfText(issue.fields.description), ...issue.comments.map((comment) => adfText(comment.body))], "text");
  bind(["status"], (issue) => named(issue.fields.status));
  bind(["statuscategory"], (issue) => {
    const { statusCategory } = issue.fields.status as JiraStatus;
    return [statusCategory.key, statusCategory.name, String(statusCategory.id)];
  });
  bind(["assignee"], (issue) => userTokens(issue.fields.assignee));
  bind(["reporter"], (issue) => userTokens(issue.fields.reporter));
  bind(["watcher"], (issue) => [...issue.watchers]);
  bind(["type", "issuetype"], (issue) => named(issue.fields.issuetype));
  bind(["priority"], (issue) => named(issue.fields.priority));
  bind(["labels"], (issue) => issue.fields.labels as string[]);
  bind(["sprint", `cf[${FIELD.sprint.slice(12)}]`], (issue) => sprintsOf(issue).flatMap((sprint) => [String(sprint.id), sprint.name]));
  bind(["resolution"], (issue) => named(issue.fields.resolution));
  bind(["parent"], (issue) => (issue.parentKey ? [issue.parentKey, byKey.get(issue.parentKey)?.id ?? ""] : []));
  bind(["created", "createddate"], (issue) => iso(issue.fields.created), "date");
  bind(["updated", "updateddate"], (issue) => iso(issue.fields.updated), "date");
  bind(["resolved", "resolutiondate"], (issue) => iso(issue.fields.resolutiondate), "date");
  bind(["due", "duedate"], (issue) => iso(issue.fields.duedate), "date");
  bind(["worklogauthor"], (issue) => issue.worklogs.map((worklog) => worklog.author.accountId));
  bind(["worklogdate"], (issue) => issue.worklogs.flatMap((worklog) => iso(worklog.started)), "date");
  bind(["story points", `cf[${FIELD.points.slice(12)}]`], (issue) => (typeof issue.fields[FIELD.points] === "number" ? [String(issue.fields[FIELD.points])] : []), "number");

  const compile = (jql: string): CompiledJql<MockIssue> => compileJql(jql, schema);

  const run = (compiled: CompiledJql<MockIssue>, scope?: CompiledJql<MockIssue>) =>
    issues.filter((issue) => compiled.matches(issue) && (!scope || scope.matches(issue))).sort(compiled.ordered || !scope ? compiled.compare : scope.compare);

  const search = (jql: string, scopeJql?: string) => {
    const cacheKey = `${scopeJql ?? ""}\u0000${jql}`;
    const cached = searchCache.get(cacheKey);
    if (cached) return cached;
    const compiled = compile(jql);
    const scope = scopeJql === undefined ? undefined : compile(scopeJql);
    const result = run(compiled, scope);
    if (!compiled.dynamic && !scope?.dynamic) searchCache.set(cacheKey, result);
    return result;
  };

  const validate = (jql: string) => {
    try {
      compile(jql);
      return [];
    } catch (error) {
      if (error instanceof JqlError) return [error.message];
      throw error;
    }
  };

  const findIssue = (keyOrId: string) => {
    const issue = byKey.get(keyOrId.toUpperCase()) ?? byId.get(keyOrId);
    if (!issue) throw new JiraHttpError(404, ["Issue does not exist or you do not have permission to see it."]);
    return issue;
  };

  const summaryRef = (issue: MockIssue, api: ApiVersion) => ({
    id: issue.id,
    key: issue.key,
    self: `${SITE_URL}/rest/api/${api}/issue/${issue.id}`,
    fields: { summary: issue.fields.summary, status: issue.fields.status, priority: issue.fields.priority, issuetype: issue.fields.issuetype },
  });

  const forApi = (value: unknown, api: ApiVersion) => (api === "2" ? adfText(value) : value);

  const commentJson = (comment: JiraComment, api: ApiVersion) => ({ ...comment, body: forApi(comment.body, api) });
  const worklogJson = (worklog: JiraWorklog, api: ApiVersion) =>
    worklog.comment === undefined ? worklog : { ...worklog, comment: forApi(worklog.comment, api) };

  const fieldValue = (issue: MockIssue, id: string, api: ApiVersion): unknown => {
    switch (id) {
      case "parent": {
        const parent = issue.parentKey ? byKey.get(issue.parentKey) : undefined;
        return parent ? summaryRef(parent, api) : undefined;
      }
      case "subtasks":
        return issue.subtaskKeys.flatMap((key) => {
          const subtask = byKey.get(key);
          return subtask ? [summaryRef(subtask, api)] : [];
        });
      case "description":
        return issue.fields.description === null ? null : forApi(issue.fields.description, api);
      case "comment":
        return {
          comments: issue.comments.map((comment) => commentJson(comment, api)),
          self: `${SITE_URL}/rest/api/${api}/issue/${issue.id}/comment`,
          maxResults: issue.comments.length,
          total: issue.comments.length,
          startAt: 0,
        };
      case "worklog":
        return {
          startAt: 0,
          maxResults: EMBEDDED_WORKLOGS,
          total: issue.worklogs.length,
          worklogs: issue.worklogs.slice(0, EMBEDDED_WORKLOGS).map((worklog) => worklogJson(worklog, api)),
        };
      case "timespent": {
        const spent = issue.worklogs.reduce((sum, worklog) => sum + worklog.timeSpentSeconds, 0);
        return spent > 0 ? spent : null;
      }
      case "timetracking": {
        const spent = issue.worklogs.reduce((sum, worklog) => sum + worklog.timeSpentSeconds, 0);
        const estimate = issue.fields.timeoriginalestimate as number | null;
        return {
          ...(estimate !== null && { originalEstimate: formatDuration(estimate), originalEstimateSeconds: estimate }),
          ...(estimate !== null && { remainingEstimate: formatDuration(Math.max(0, estimate - spent)), remainingEstimateSeconds: Math.max(0, estimate - spent) }),
          ...(spent > 0 && { timeSpent: formatDuration(spent), timeSpentSeconds: spent }),
        };
      }
      case "attachment":
        return issue.attachments;
      case "watches":
        return { self: `${SITE_URL}/rest/api/${api}/issue/${issue.key}/watchers`, watchCount: issue.watchers.size, isWatching: issue.watchers.has(me.accountId) };
      case FIELD.rank:
        return `0|i${issue.rank.toString(36).padStart(6, "0")}:`;
      default:
        return issue.fields[id];
    }
  };

  const fieldIds = dataset.fields.map((field) => field.id);

  const requestedFields = (param: string | null, fallback: readonly string[]) => {
    if (param === null) return fallback;
    const parts = param.split(",").map((part) => part.trim()).filter(Boolean);
    const excluded = new Set(parts.filter((part) => part.startsWith("-")).map((part) => part.slice(1)));
    const included = parts.flatMap((part) => (part === ALL_FIELDS || part === "*navigable" ? fieldIds : part.startsWith("-") ? [] : [part]));
    return [...new Set(included)].filter((id) => !excluded.has(id));
  };

  const editmeta = () => ({
    fields: Object.fromEntries(
      EDITABLE.map((id) => {
        const field = dataset.fields.find((entry) => entry.id === id)!;
        const allowedValues = id === "priority" ? priorities : id === FIELD.flagged ? [FLAGGED_VALUE] : undefined;
        return [id, { required: id === "summary", name: field.name, key: id, schema: field.schema, operations: id === "labels" ? ["add", "set", "remove"] : ["set"], ...(allowedValues && { allowedValues }) }];
      }),
    ),
  });

  const serialize = (issue: MockIssue, { fields, expand, api }: SerializeOptions) => {
    const values: Record<string, unknown> = {};
    for (const id of fields) {
      const value = fieldValue(issue, id, api);
      if (value !== undefined) values[id] = value;
    }
    return {
      expand: "renderedFields,names,schema,operations,editmeta,changelog,versionedRepresentations",
      id: issue.id,
      self: `${SITE_URL}/rest/api/${api}/issue/${issue.id}`,
      key: issue.key,
      fields: values,
      ...(expand.has("changelog") && {
        changelog: { startAt: 0, maxResults: Math.min(CHANGELOG_LIMIT, issue.histories.length), total: issue.histories.length, histories: issue.histories.slice(0, CHANGELOG_LIMIT) },
      }),
      ...(expand.has("names") && { names: Object.fromEntries(dataset.fields.filter((field) => fields.includes(field.id)).map((field) => [field.id, field.name])) }),
      ...(expand.has("editmeta") && { editmeta: editmeta() }),
    };
  };

  const record = (issue: MockIssue, author: JiraUser, items: HistoryItem[]) => {
    const created = jiraDate(now());
    if (items.length > 0) issue.histories.unshift({ id: nextId(), author, created, items } satisfies History);
    issue.fields.updated = created;
    touch();
  };

  const change = (field: string, from: unknown, to: unknown, label: (value: unknown) => string | null): HistoryItem => ({
    field,
    fieldtype: field.startsWith("customfield_") ? "custom" : "jira",
    fieldId: field,
    from: (from as { id?: string; accountId?: string } | null)?.accountId ?? (from as { id?: string } | null)?.id ?? null,
    fromString: label(from),
    to: (to as { id?: string; accountId?: string } | null)?.accountId ?? (to as { id?: string } | null)?.id ?? null,
    toString: label(to),
  });

  const labelOf = (value: unknown) => {
    if (value === null || value === undefined) return null;
    if (typeof value !== "object") return String(value);
    if (Array.isArray(value)) return value.map((entry) => (typeof entry === "object" ? ((entry as { name?: string; value?: string }).name ?? (entry as { value?: string }).value) : entry)).join(" ");
    const ref = value as { displayName?: string; name?: string };
    return ref.displayName ?? ref.name ?? adfText(value);
  };

  const resolveField = (id: string, value: unknown, issue: MockIssue): unknown => {
    switch (id) {
      case "summary":
        if (typeof value !== "string" || value.trim() === "") throw new JiraHttpError(400, [], { summary: "You must specify a summary of the issue." });
        return value;
      case "description":
        return typeof value === "string" ? adf(...value.split("\n")) : value;
      case "assignee": {
        const accountId = (value as { accountId?: string | null } | null)?.accountId ?? null;
        if (accountId === null) return null;
        const user = findUser(accountId);
        if (!user) throw new JiraHttpError(400, [], { assignee: `User '${accountId}' cannot be assigned issues.` });
        return user;
      }
      case "priority": {
        const ref = value as { id?: string; name?: string };
        const priority = priorities.find((entry) => entry.id === ref?.id || entry.name === ref?.name);
        if (!priority) throw new JiraHttpError(400, [], { priority: "Specify a valid priority." });
        return priority;
      }
      case "labels":
        if (!Array.isArray(value) || value.some((label) => typeof label !== "string" || /\s/.test(label))) throw new JiraHttpError(400, [], { labels: "Labels must be strings without spaces." });
        return value;
      case FIELD.sprint: {
        if (value === null) return null;
        const sprint = sprintById.get(Number(value));
        if (!sprint || sprint.boardId !== issue.projectIndex * 2 + 1) throw new JiraHttpError(400, [], { [FIELD.sprint]: "Sprint does not exist." });
        return [{ id: sprint.id, name: sprint.name, state: sprint.state, boardId: sprint.boardId, goal: sprint.goal, startDate: sprint.startDate, endDate: sprint.endDate }];
      }
      case FIELD.points:
        if (value !== null && typeof value !== "number") throw new JiraHttpError(400, [], { [FIELD.points]: "Story Points must be a number." });
        return value;
      default:
        return value;
    }
  };

  const resolveFields = (issue: MockIssue, values: Record<string, unknown>) =>
    Object.entries(values).map(([id, raw]) => {
      if (!EDITABLE.includes(id)) throw new JiraHttpError(400, [], { [id]: `Field '${id}' cannot be set. It is not on the appropriate screen, or unknown.` });
      return [id, resolveField(id, raw, issue)] as const;
    });

  const applyResolvedFields = (issue: MockIssue, values: ReturnType<typeof resolveFields>, author: JiraUser, items: HistoryItem[] = []) => {
    for (const [id, value] of values) {
      items.push(change(id, issue.fields[id], value, labelOf));
      issue.fields[id] = value;
      if (id === "assignee" && value && typeof value === "object" && "accountId" in value && typeof value.accountId === "string") issue.watchers.add(value.accountId);
    }
    record(issue, author, items);
  };

  const applyFields = (issue: MockIssue, values: Record<string, unknown>, author: JiraUser) =>
    applyResolvedFields(issue, resolveFields(issue, values), author);

  const editIssue = (key: string, body: { fields?: Record<string, unknown>; update?: Record<string, { add?: unknown; remove?: unknown; set?: unknown }[]> }, author = me) => {
    const issue = findIssue(key);
    const fields = { ...body.fields };
    for (const [id, operations] of Object.entries(body.update ?? {})) {
      if (id !== "labels") throw new JiraHttpError(400, [], { [id]: `Field '${id}' cannot be updated with operations.` });
      let labels = [...((fields.labels as string[] | undefined) ?? (issue.fields.labels as string[]))];
      for (const operation of operations) {
        if (operation.set !== undefined) labels = operation.set as string[];
        if (typeof operation.add === "string" && !labels.includes(operation.add)) labels.push(operation.add);
        if (typeof operation.remove === "string") labels = labels.filter((label) => label !== operation.remove);
      }
      fields.labels = labels;
    }
    applyFields(issue, fields, author);
  };

  const transitionsFor = (issue: MockIssue, withFields: boolean) => {
    const current = (issue.fields.status as JiraStatus).id;
    return statuses
      .map((status, index) => ({ status, index }))
      .filter(({ status }) => status.id !== current)
      .map(({ status, index }) => ({
        id: String(TRANSITION_OFFSET + index),
        name: status.name,
        to: status,
        hasScreen: index === DONE_STATUS_INDEX,
        isGlobal: true,
        isInitial: false,
        isAvailable: true,
        isConditional: false,
        isLooped: false,
        ...(withFields && {
          fields:
            index === DONE_STATUS_INDEX
              ? { resolution: { required: false, name: "Resolution", key: "resolution", schema: { type: "resolution", system: "resolution" }, operations: ["set"], allowedValues: [dataset.resolution] } }
              : {},
        }),
      }));
  };

  const transition = (key: string, body: { transition?: { id?: string }; fields?: Record<string, unknown> }, author = me) => {
    const issue = findIssue(key);
    const target = transitionsFor(issue, false).find((entry) => entry.id === body.transition?.id);
    if (!target) throw new JiraHttpError(400, [`Transition id '${body.transition?.id}' is not valid for this issue.`]);
    const extra = Object.fromEntries(Object.entries(body.fields ?? {}).filter(([id]) => id !== "resolution"));
    const resolved = resolveFields(issue, extra);
    const from = issue.fields.status;
    const done = target.to.statusCategory.key === "done";
    issue.fields.status = target.to;
    issue.fields.resolution = done ? dataset.resolution : null;
    issue.fields.resolutiondate = done ? jiraDate(now()) : null;
    const items = [change("status", from, target.to, labelOf)];
    applyResolvedFields(issue, resolved, author, items);
  };

  const transitionTo = (key: string, statusName: string, author = me) => {
    const issue = findIssue(key);
    const target = transitionsFor(issue, false).find((entry) => entry.to.name === statusName || entry.to.id === statusName);
    if (target) transition(key, { transition: { id: target.id } }, author);
  };

  const addComment = (key: string, body: unknown, author = me) => {
    const issue = findIssue(key);
    if (body === undefined || adfText(body).trim() === "") throw new JiraHttpError(400, [], { comment: "Comment body can not be empty!" });
    const created = jiraDate(now());
    const id = nextId();
    const comment: JiraComment = { self: `${SITE_URL}/rest/api/3/issue/${issue.id}/comment/${id}`, id, author, updateAuthor: author, body: typeof body === "string" ? adf(body) : (body as JiraComment["body"]), created, updated: created, jsdPublic: true };
    issue.comments.push(comment);
    record(issue, author, []);
    return comment;
  };

  const addWorklog = (key: string, input: { timeSpent?: string; timeSpentSeconds?: number; started?: string; comment?: unknown }, author = me) => {
    const issue = findIssue(key);
    const seconds = input.timeSpentSeconds ?? parseDuration(input.timeSpent ?? "");
    if (!(seconds > 0)) throw new JiraHttpError(400, [], { timeLogged: "You must indicate the time spent working." });
    const created = jiraDate(now());
    const id = nextId();
    const worklog: JiraWorklog = {
      self: `${SITE_URL}/rest/api/3/issue/${issue.id}/worklog/${id}`,
      id,
      issueId: issue.id,
      author,
      updateAuthor: author,
      ...(input.comment !== undefined && { comment: typeof input.comment === "string" ? adf(input.comment) : (input.comment as JiraWorklog["comment"]) }),
      started: input.started ?? created,
      timeSpent: formatDuration(seconds),
      timeSpentSeconds: seconds,
      created,
      updated: created,
    };
    issue.worklogs.push(worklog);
    record(issue, author, [{ field: "timespent", fieldtype: "jira", fieldId: "timespent", from: null, fromString: null, to: String(seconds), toString: String(seconds) }]);
    return worklog;
  };

  const addAttachments = (key: string, files: { name: string; size: number; type: string }[], author = me) => {
    const issue = findIssue(key);
    const created = jiraDate(now());
    const added = files.map((file): JiraAttachment => {
      const id = nextId();
      return { self: `${SITE_URL}/rest/api/3/attachment/${id}`, id, filename: file.name, author, created, size: file.size, mimeType: file.type || "application/octet-stream", content: `${SITE_URL}/rest/api/3/attachment/content/${id}` };
    });
    issue.attachments.push(...added);
    record(issue, author, added.map((attachment) => ({ field: "Attachment", fieldtype: "jira", fieldId: "attachment", from: null, fromString: null, to: attachment.id, toString: attachment.filename })));
    return added;
  };

  const createIssue = (input: { fields?: Record<string, unknown> }, author = me) => {
    const fields = input.fields ?? {};
    const projectRef = fields.project as { key?: string; id?: string } | undefined;
    const projectIndex = projects.findIndex((project) => project.key === projectRef?.key || project.id === projectRef?.id);
    if (projectIndex < 0) throw new JiraHttpError(400, [], { project: "Specify a valid project ID or key" });
    const typeRef = fields.issuetype as { id?: string; name?: string } | undefined;
    const issuetype = issueTypes.find((type) => type.id === typeRef?.id || type.name === typeRef?.name);
    if (!issuetype) throw new JiraHttpError(400, [], { issuetype: "Specify an issue type" });
    const parentKey = (fields.parent as { key?: string } | undefined)?.key;
    const parent = parentKey ? findIssue(parentKey) : undefined;
    if (issuetype.subtask && !parent) throw new JiraHttpError(400, [], { parent: "Given parent issue does not belong to appropriate hierarchy." });
    const project = projects[projectIndex];
    const number = 1 + Math.max(0, ...issues.filter((issue) => issue.projectIndex === projectIndex).map((issue) => issue.number));
    const created = jiraDate(now());
    const issue: MockIssue = {
      id: nextId(),
      key: `${project.key}-${number}`,
      number,
      projectIndex,
      rank: Math.max(-1, ...issues.map((entry) => entry.rank)) + 1,
      parentKey: parent?.key,
      subtaskKeys: [],
      comments: [],
      worklogs: [],
      histories: [],
      watchers: new Set([author.accountId]),
      attachments: [],
      fields: {
        summary: "",
        description: null,
        status: statuses[1],
        assignee: null,
        reporter: author,
        created,
        updated: created,
        resolutiondate: null,
        resolution: null,
        issuetype,
        priority: priorities[2],
        labels: [],
        duedate: null,
        project: { self: project.self, id: project.id, key: project.key, name: project.name, projectTypeKey: project.projectTypeKey, avatarUrls: project.avatarUrls },
        timeoriginalestimate: null,
        issuelinks: [],
        components: [],
        fixVersions: [],
        [FIELD.sprint]: null,
        [FIELD.points]: null,
        [FIELD.flagged]: null,
      },
    };
    const editable = Object.fromEntries(Object.entries(fields).filter(([id]) => !["project", "issuetype", "parent", "reporter"].includes(id)));
    if (typeof editable.summary !== "string" || editable.summary.trim() === "") throw new JiraHttpError(400, [], { summary: "You must specify a summary of the issue." });
    for (const [id, raw] of Object.entries(editable)) {
      if (!EDITABLE.includes(id)) throw new JiraHttpError(400, [], { [id]: `Field '${id}' cannot be set. It is not on the appropriate screen, or unknown.` });
      issue.fields[id] = resolveField(id, raw, issue);
    }
    issues.push(issue);
    byKey.set(issue.key, issue);
    byId.set(issue.id, issue);
    parent?.subtaskKeys.push(issue.key);
    touch();
    return issue;
  };

  const rankIssues = (keys: string[], position: { before?: string; after?: string }) => {
    if (keys.length === 0 || keys.length > 50) throw new JiraHttpError(400, ["Between 1 and 50 issues can be ranked at once."]);
    const moving = keys.map(findIssue);
    const anchorKey = position.before ?? position.after;
    if (!anchorKey) throw new JiraHttpError(400, ["rankBeforeIssue or rankAfterIssue is required."]);
    const anchor = findIssue(anchorKey);
    const order = [...issues].sort((a, b) => a.rank - b.rank).filter((issue) => !moving.includes(issue));
    const anchorIndex = order.indexOf(anchor);
    if (anchorIndex < 0) throw new JiraHttpError(400, ["An issue cannot be ranked relative to itself."]);
    order.splice(position.before ? anchorIndex : anchorIndex + 1, 0, ...moving);
    order.forEach((issue, index) => (issue.rank = index));
    for (const issue of moving) record(issue, me, [{ field: "Rank", fieldtype: "custom", fieldId: FIELD.rank, from: null, fromString: null, to: null, toString: "Ranked higher" }]);
  };

  const CHANGE_KINDS = ["status", "assignee", "summary", "comment", "priority"] as const;
  type ChangeKind = (typeof CHANGE_KINDS)[number];

  const simulateChanges = (rng: Rng, count: number, { kinds = CHANGE_KINDS, keys }: { kinds?: readonly ChangeKind[]; keys?: readonly string[] } = {}) => {
    const others = users.filter((user) => user.accountId !== me.accountId);
    const actors = others.length > 0 ? others : users;
    const pool = keys ? keys.map(findIssue) : issues;
    const changed: { key: string; kind: ChangeKind }[] = [];
    for (let index = 0; index < count; index++) {
      const issue = rng.pick(pool);
      const author = rng.pick(actors);
      const kind = rng.pick(kinds);
      if (kind === "status") {
        const options = transitionsFor(issue, false);
        transition(issue.key, { transition: { id: rng.pick(options).id } }, author);
      }
      if (kind === "assignee") applyFields(issue, { assignee: rng.chance(0.15) ? null : { accountId: rng.pick(users).accountId } }, author);
      if (kind === "summary") applyFields(issue, { summary: summaryFor(rng) }, author);
      if (kind === "priority") applyFields(issue, { priority: { id: rng.pick(priorities).id } }, author);
      if (kind === "comment") addComment(issue.key, adf(`Automated change ${index + 1}`), author);
      changed.push({ key: issue.key, kind });
    }
    return changed;
  };

  const boardById = (id: number) => {
    const board = boards.find((entry) => entry.id === id);
    if (!board) throw new JiraHttpError(404, [`Board ${id} does not exist or you do not have permission to see it.`]);
    return board;
  };

  const boardFilterJql = (board: MockBoard) => `filter = ${board.filterId}`;

  return {
    dataset,
    get version() {
      return version;
    },
    touch,
    compile,
    search,
    validate,
    findIssue,
    serialize,
    requestedFields,
    transitionsFor,
    editIssue,
    transition,
    transitionTo,
    addComment,
    addWorklog,
    addAttachments,
    createIssue,
    rankIssues,
    simulateChanges,
    boardById,
    boardFilterJql,
    commentJson,
    worklogJson,
    findUser,
    sprintById,
  };
};

export type MockJira = ReturnType<typeof createMockJira>;
