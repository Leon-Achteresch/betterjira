export const SITE_URL = "https://mock-jira.atlassian.net";
export const CLOUD_ID = "mock-cloud";
export const DEFAULT_EPOCH = Date.UTC(2026, 9, 1, 8);
export const DAY_MS = 86_400_000;

export const FIELD = {
  sprint: "customfield_10020",
  points: "customfield_10016",
  flagged: "customfield_10021",
  rank: "customfield_10019",
} as const;

export type Rng = {
  next: () => number;
  int: (min: number, max: number) => number;
  pick: <T>(items: readonly T[]) => T;
  chance: (probability: number) => boolean;
};

export const createRng = (seed: number): Rng => {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    chance: (probability) => next() < probability,
  };
};

export const jiraDate = (time: number) => new Date(time).toISOString().replace("Z", "+0000");

export type Adf = { type: "doc"; version: 1; content: { type: "paragraph"; content: { type: "text"; text: string }[] }[] };

export const adf = (...paragraphs: string[]): Adf => ({
  type: "doc",
  version: 1,
  content: paragraphs.map((text) => ({ type: "paragraph", content: text ? [{ type: "text", text }] : [] })),
});

export const adfText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const node = value as { text?: unknown; content?: unknown };
  const own = typeof node.text === "string" ? node.text : "";
  const children = Array.isArray(node.content) ? node.content.map(adfText) : [];
  return [own, ...children].filter(Boolean).join(Array.isArray(node.content) && !own ? "\n" : "");
};

export type JiraUser = {
  self: string;
  accountId: string;
  accountType: "atlassian" | "app";
  emailAddress: string;
  displayName: string;
  active: boolean;
  timeZone: string;
  avatarUrls: Record<"48x48" | "24x24" | "16x16" | "32x32", string>;
};

export type StatusCategory = { self: string; id: number; key: "new" | "indeterminate" | "done"; colorName: string; name: string };
export type JiraStatus = { self: string; id: string; name: string; description: string; iconUrl: string; statusCategory: StatusCategory };
export type NamedRef = { self: string; id: string; name: string; iconUrl: string; subtask?: boolean };

export type JiraSprint = {
  id: number;
  self: string;
  state: "closed" | "active" | "future";
  name: string;
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  originBoardId: number;
  boardId: number;
  goal: string;
};

export type HistoryItem = {
  field: string;
  fieldtype: "jira" | "custom";
  fieldId: string;
  from: string | null;
  fromString: string | null;
  to: string | null;
  toString: string | null;
};
export type History = { id: string; author: JiraUser; created: string; items: HistoryItem[] };

export type JiraComment = { self: string; id: string; author: JiraUser; updateAuthor: JiraUser; body: Adf; created: string; updated: string; jsdPublic: boolean };

export type JiraWorklog = {
  self: string;
  id: string;
  issueId: string;
  author: JiraUser;
  updateAuthor: JiraUser;
  comment?: Adf;
  started: string;
  timeSpent: string;
  timeSpentSeconds: number;
  created: string;
  updated: string;
};

export type JiraAttachment = { self: string; id: string; filename: string; author: JiraUser; created: string; size: number; mimeType: string; content: string };

export type MockIssue = {
  id: string;
  key: string;
  number: number;
  projectIndex: number;
  rank: number;
  fields: Record<string, unknown>;
  parentKey?: string;
  subtaskKeys: string[];
  comments: JiraComment[];
  worklogs: JiraWorklog[];
  histories: History[];
  watchers: Set<string>;
  attachments: JiraAttachment[];
};

export type MockProject = {
  self: string;
  id: string;
  key: string;
  name: string;
  projectTypeKey: "software";
  simplified: boolean;
  style: "classic";
  isPrivate: boolean;
  avatarUrls: Record<"48x48" | "24x24" | "16x16" | "32x32", string>;
};

export type MockBoard = {
  id: number;
  self: string;
  name: string;
  type: "scrum" | "kanban";
  filterId: string;
  projectIndex: number;
};

export type MockFilter = { self: string; id: string; name: string; jql: string; description: string; favourite: boolean; owner: JiraUser };

export type JiraFieldInfo = {
  id: string;
  key: string;
  name: string;
  custom: boolean;
  orderable: boolean;
  navigable: boolean;
  searchable: boolean;
  clauseNames: string[];
  schema?: { type: string; items?: string; system?: string; custom?: string; customId?: number };
};

export type JiraDataset = {
  epoch: number;
  me: JiraUser;
  users: JiraUser[];
  statuses: JiraStatus[];
  issueTypes: NamedRef[];
  priorities: NamedRef[];
  resolution: { self: string; id: string; name: string };
  projects: MockProject[];
  boards: MockBoard[];
  sprints: JiraSprint[];
  filters: Map<string, MockFilter>;
  issues: MockIssue[];
  byKey: Map<string, MockIssue>;
  fields: JiraFieldInfo[];
};

export type DatasetOptions = {
  seed?: number;
  issues?: number;
  projects?: readonly string[];
  users?: number;
  epoch?: number;
};

const FIRST_NAMES = ["Anna", "Ben", "Clara", "David", "Elif", "Felix", "Greta", "Hannes", "Ida", "Jonas", "Kira", "Lukas", "Mara", "Nils", "Olga", "Paul"];
const LAST_NAMES = ["Albers", "Brandt", "Celik", "Dietz", "Engel", "Fischer", "Graf", "Hoffmann", "Ivanova", "Jung", "Krause", "Lange"];
const VERBS = ["Optimize", "Fix", "Implement", "Review", "Refactor", "Document", "Migrate", "Profile", "Cache", "Validate"];
const NOUNS = ["board view", "login flow", "search index", "CSV export", "notifications", "time tracking", "API client", "dashboard", "sprint planning", "release notes", "webhooks", "permissions"];
const QUALIFIERS = ["for large projects", "in offline mode", "with many tickets", "after update", "for admins", "on slow networks", "in dark mode", ""];
const WORDS = "lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua board sprint ticket release performance cache latency".split(" ");
const LABELS = ["frontend", "backend", "performance", "ux", "tech-debt", "security", "mobile", "api"];
const POINTS = [1, 2, 3, 5, 8, 13];
const WORK_SECONDS = [1800, 3600, 5400, 7200, 14400];
const OPEN_STATUS_WEIGHTS = [4, 3, 2, 1];
const PROJECT_NAMES: Record<string, string> = { PERF: "Performance", CORE: "Core Platform", OPS: "Operations" };

const avatars = (seed: string) => ({
  "48x48": `https://avatars.mock-jira.test/${seed}/48.png`,
  "24x24": `https://avatars.mock-jira.test/${seed}/24.png`,
  "16x16": `https://avatars.mock-jira.test/${seed}/16.png`,
  "32x32": `https://avatars.mock-jira.test/${seed}/32.png`,
});

const createUser = (index: number): JiraUser => {
  const accountId = `mock-user-${String(index).padStart(3, "0")}`;
  const displayName =
    index === 0 ? "Mock Me" : `${FIRST_NAMES[index % FIRST_NAMES.length]} ${LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length]}`;
  return {
    self: `${SITE_URL}/rest/api/3/user?accountId=${accountId}`,
    accountId,
    accountType: "atlassian",
    emailAddress: `${displayName.toLowerCase().replaceAll(" ", ".")}@mock-jira.test`,
    displayName,
    active: true,
    timeZone: "Europe/Berlin",
    avatarUrls: avatars(accountId),
  };
};

const category = (id: number, key: StatusCategory["key"], colorName: string, name: string): StatusCategory => ({
  self: `${SITE_URL}/rest/api/3/statuscategory/${id}`,
  id,
  key,
  colorName,
  name,
});

const STATUS_DEFINITIONS = [
  { name: "Backlog", category: category(2, "new", "blue-gray", "To Do") },
  { name: "To Do", category: category(2, "new", "blue-gray", "To Do") },
  { name: "In Progress", category: category(4, "indeterminate", "yellow", "In Progress") },
  { name: "In Review", category: category(4, "indeterminate", "yellow", "In Progress") },
  { name: "Done", category: category(3, "done", "green", "Done") },
];

export const DONE_STATUS_INDEX = STATUS_DEFINITIONS.length - 1;

const named = (kind: string, id: string, name: string, subtask?: boolean): NamedRef => ({
  self: `${SITE_URL}/rest/api/3/${kind}/${id}`,
  id,
  name,
  iconUrl: `${SITE_URL}/images/icons/${kind}/${name.toLowerCase().replaceAll(" ", "-")}.svg`,
  ...(subtask !== undefined && { subtask }),
});

const systemField = (id: string, name: string, type: string, items?: string): JiraFieldInfo => ({
  id,
  key: id,
  name,
  custom: false,
  orderable: true,
  navigable: true,
  searchable: true,
  clauseNames: [id],
  schema: { type, system: id, ...(items && { items }) },
});

const customField = (id: string, name: string, type: string, custom: string, items?: string): JiraFieldInfo => ({
  id,
  key: id,
  name,
  custom: true,
  orderable: true,
  navigable: true,
  searchable: true,
  clauseNames: [`cf[${id.slice("customfield_".length)}]`, name],
  schema: { type, custom, customId: Number(id.slice("customfield_".length)), ...(items && { items }) },
});

export const FIELDS: JiraFieldInfo[] = [
  systemField("summary", "Summary", "string"),
  systemField("description", "Description", "string"),
  systemField("status", "Status", "status"),
  systemField("assignee", "Assignee", "user"),
  systemField("reporter", "Reporter", "user"),
  systemField("created", "Created", "datetime"),
  systemField("updated", "Updated", "datetime"),
  systemField("resolutiondate", "Resolved", "datetime"),
  systemField("resolution", "Resolution", "resolution"),
  systemField("issuetype", "Issue Type", "issuetype"),
  systemField("priority", "Priority", "priority"),
  systemField("labels", "Labels", "array", "string"),
  systemField("duedate", "Due date", "date"),
  systemField("project", "Project", "project"),
  systemField("parent", "Parent", "issuelink"),
  systemField("subtasks", "Sub-tasks", "array", "issuelinks"),
  systemField("comment", "Comment", "comments-page"),
  systemField("worklog", "Log Work", "array", "worklog"),
  systemField("timetracking", "Time tracking", "timetracking"),
  systemField("timespent", "Time Spent", "number"),
  systemField("timeoriginalestimate", "Original Estimate", "number"),
  systemField("attachment", "Attachment", "array", "attachment"),
  systemField("issuelinks", "Linked Issues", "array", "issuelinks"),
  systemField("components", "Components", "array", "component"),
  systemField("fixVersions", "Fix versions", "array", "version"),
  systemField("watches", "Watchers", "watches"),
  customField(FIELD.sprint, "Sprint", "array", "com.pyxis.greenhopper.jira:gh-sprint", "json"),
  customField(FIELD.points, "Story Points", "number", "com.atlassian.jira.plugin.system.customfieldtypes:float"),
  customField(FIELD.flagged, "Flagged", "array", "com.atlassian.jira.plugin.system.customfieldtypes:multicheckboxes", "option"),
  customField(FIELD.rank, "Rank", "any", "com.pyxis.greenhopper.jira:gh-lexo-rank"),
];

export const FLAGGED_VALUE = { self: `${SITE_URL}/rest/api/3/customFieldOption/10019`, value: "Impediment", id: "10019" };

const sentence = (rng: Rng, min: number, max: number) =>
  Array.from({ length: rng.int(min, max) }, () => rng.pick(WORDS)).join(" ");

export const summaryFor = (rng: Rng) => `${rng.pick(VERBS)} ${rng.pick(NOUNS)} ${rng.pick(QUALIFIERS)}`.trim();

export const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return [hours && `${hours}h`, minutes && `${minutes}m`].filter(Boolean).join(" ") || "0m";
};

const createSprints = (board: MockBoard, project: MockProject, epoch: number) => {
  const length = 14 * DAY_MS;
  const activeStart = epoch - 7 * DAY_MS;
  const states: JiraSprint["state"][] = ["closed", "closed", "closed", "closed", "closed", "closed", "active", "future", "future"];
  const activeIndex = states.indexOf("active");
  return states.map((state, index): JiraSprint => {
    const id = board.id * 100 + index + 1;
    const start = activeStart + (index - activeIndex) * length;
    return {
      id,
      self: `${SITE_URL}/rest/agile/1.0/sprint/${id}`,
      state,
      name: `${project.key} Sprint ${index + 1}`,
      ...(state !== "future" && { startDate: jiraDate(start), endDate: jiraDate(start + length) }),
      ...(state === "closed" && { completeDate: jiraDate(start + length) }),
      originBoardId: board.id,
      boardId: board.id,
      goal: state === "active" ? `Ship ${project.name} improvements` : "",
    };
  });
};

const weightedIndex = (rng: Rng, weights: readonly number[]) => {
  let roll = rng.next() * weights.reduce((sum, weight) => sum + weight, 0);
  for (const [index, weight] of weights.entries()) {
    roll -= weight;
    if (roll < 0) return index;
  }
  return weights.length - 1;
};

export const createDataset = ({
  seed = 1,
  issues: issueCount = 2000,
  projects: projectKeys = ["PERF", "CORE", "OPS"],
  users: userCount = 24,
  epoch = DEFAULT_EPOCH,
}: DatasetOptions = {}): JiraDataset => {
  const rng = createRng(seed);
  const users = Array.from({ length: Math.max(1, userCount) }, (_, index) => createUser(index));
  const me = users[0];
  const others = users.length > 1 ? users.slice(1) : users;
  const statuses = STATUS_DEFINITIONS.map(
    (definition, index): JiraStatus => ({
      self: `${SITE_URL}/rest/api/3/status/${10000 + index}`,
      id: String(10000 + index),
      name: definition.name,
      description: "",
      iconUrl: `${SITE_URL}/images/icons/statuses/generic.png`,
      statusCategory: definition.category,
    }),
  );
  const issueTypes = [
    named("issuetype", "10001", "Story", false),
    named("issuetype", "10002", "Bug", false),
    named("issuetype", "10003", "Task", false),
    named("issuetype", "10004", "Sub-task", true),
  ];
  const priorities = ["Highest", "High", "Medium", "Low", "Lowest"].map((name, index) => named("priority", String(index + 1), name));
  const resolution = { self: `${SITE_URL}/rest/api/3/resolution/10000`, id: "10000", name: "Done" };

  const projects = projectKeys.map(
    (key, index): MockProject => ({
      self: `${SITE_URL}/rest/api/3/project/${10100 + index}`,
      id: String(10100 + index),
      key,
      name: PROJECT_NAMES[key] ?? `Project ${key}`,
      projectTypeKey: "software",
      simplified: false,
      style: "classic",
      isPrivate: false,
      avatarUrls: avatars(`project-${key}`),
    }),
  );
  const filters = new Map<string, MockFilter>();
  const boards: MockBoard[] = [];
  const sprints: JiraSprint[] = [];
  for (const [index, project] of projects.entries()) {
    const filterId = String(10000 + index);
    filters.set(filterId, {
      self: `${SITE_URL}/rest/api/3/filter/${filterId}`,
      id: filterId,
      name: `Filter for ${project.key} board`,
      jql: `project = ${project.key} ORDER BY Rank ASC`,
      description: "",
      favourite: index === 0,
      owner: me,
    });
    for (const type of ["scrum", "kanban"] as const) {
      const id = index * 2 + (type === "scrum" ? 1 : 2);
      const board: MockBoard = { id, self: `${SITE_URL}/rest/agile/1.0/board/${id}`, name: `${project.key} ${type === "scrum" ? "Scrum" : "Kanban"}`, type, filterId, projectIndex: index };
      boards.push(board);
      if (type === "scrum") sprints.push(...createSprints(board, project, epoch));
    }
  }

  const issues: MockIssue[] = [];
  const byKey = new Map<string, MockIssue>();
  const numbers = projects.map(() => 0);
  const lastParent: (MockIssue | undefined)[] = projects.map(() => undefined);
  const span = 540 * DAY_MS;
  let historyId = 1;
  let commentId = 1;
  let worklogId = 1;

  for (let index = 0; index < issueCount; index++) {
    const projectIndex = index % projects.length;
    const project = projects[projectIndex];
    const number = ++numbers[projectIndex];
    const id = String(10000 + index);
    const key = `${project.key}-${number}`;
    const age = 1 - index / Math.max(1, issueCount);
    const created = epoch - Math.round(age * span) - rng.int(0, 3_600_000);
    const updated = created + rng.int(0, Math.min(epoch - created, 60 * DAY_MS));
    const statusIndex = rng.chance(0.15 + 0.7 * age) ? DONE_STATUS_INDEX : weightedIndex(rng, OPEN_STATUS_WEIGHTS);
    const status = statuses[statusIndex];
    const done = statusIndex === DONE_STATUS_INDEX;
    const parent = lastParent[projectIndex];
    const isSubtask = parent !== undefined && rng.chance(0.12);
    const issuetype = isSubtask ? issueTypes[3] : issueTypes[weightedIndex(rng, [45, 25, 30])];
    const assignee = !done && rng.chance(0.25) ? null : rng.chance(0.08) ? me : rng.pick(others);
    const reporter = rng.pick(users);
    const boardSprints = sprints.filter((sprint) => sprint.boardId === projectIndex * 2 + 1);
    const closed = boardSprints.filter((sprint) => sprint.state === "closed");
    const future = boardSprints.filter((sprint) => sprint.state === "future");
    const active = boardSprints.find((sprint) => sprint.state === "active");
    const sprintRoll = rng.next();
    const sprint = done
      ? sprintRoll < 0.8
        ? rng.pick(closed)
        : active
      : sprintRoll < 0.4
        ? active
        : sprintRoll < 0.6
          ? rng.pick(future)
          : undefined;
    const sprintValue = sprint ? [{ id: sprint.id, name: sprint.name, state: sprint.state, boardId: sprint.boardId, goal: sprint.goal, startDate: sprint.startDate, endDate: sprint.endDate }] : null;

    const histories: History[] = [];
    for (let step = 1; step <= statusIndex; step++) {
      histories.push({
        id: String(historyId++),
        author: rng.pick(users),
        created: jiraDate(created + Math.round(((updated - created) * step) / Math.max(1, statusIndex))),
        items: [
          {
            field: "status",
            fieldtype: "jira",
            fieldId: "status",
            from: statuses[step - 1].id,
            fromString: statuses[step - 1].name,
            to: statuses[step].id,
            toString: statuses[step].name,
          },
        ],
      });
    }
    if (rng.chance(0.3)) {
      histories.push({
        id: String(historyId++),
        author: rng.pick(users),
        created: jiraDate(created + Math.round((updated - created) / 3)),
        items: [{ field: "assignee", fieldtype: "jira", fieldId: "assignee", from: null, fromString: null, to: assignee?.accountId ?? null, toString: assignee?.displayName ?? null }],
      });
    }
    histories.sort((a, b) => Date.parse(b.created) - Date.parse(a.created));

    const comments = Array.from({ length: rng.int(0, 3) }, (): JiraComment => {
      const author = rng.pick(users);
      const at = jiraDate(created + rng.int(0, updated - created));
      const commentKey = String(commentId++);
      return { self: `${SITE_URL}/rest/api/3/issue/${id}/comment/${commentKey}`, id: commentKey, author, updateAuthor: author, body: adf(sentence(rng, 6, 30)), created: at, updated: at, jsdPublic: true };
    }).sort((a, b) => Date.parse(a.created) - Date.parse(b.created));

    const worklogs = Array.from({ length: statusIndex >= 2 ? rng.int(0, 2) : 0 }, (): JiraWorklog => {
      const author = rng.pick(users);
      const seconds = rng.pick(WORK_SECONDS);
      const started = jiraDate(created + rng.int(0, updated - created));
      const worklogKey = String(worklogId++);
      return { self: `${SITE_URL}/rest/api/3/issue/${id}/worklog/${worklogKey}`, id: worklogKey, issueId: id, author, updateAuthor: author, started, timeSpent: formatDuration(seconds), timeSpentSeconds: seconds, created: started, updated: started };
    });
    const estimate = rng.chance(0.4) ? rng.pick(WORK_SECONDS) * 2 : null;

    const issue: MockIssue = {
      id,
      key,
      number,
      projectIndex,
      rank: index,
      parentKey: isSubtask ? parent.key : undefined,
      subtaskKeys: [],
      comments,
      worklogs,
      histories,
      watchers: new Set([reporter.accountId, ...(assignee ? [assignee.accountId] : []), ...(rng.chance(0.1) ? [me.accountId] : [])]),
      attachments: [],
      fields: {
        summary: summaryFor(rng),
        description: adf(...Array.from({ length: rng.int(1, 3) }, () => sentence(rng, 8, 40))),
        status,
        assignee,
        reporter,
        created: jiraDate(created),
        updated: jiraDate(updated),
        resolutiondate: done ? jiraDate(updated) : null,
        resolution: done ? resolution : null,
        issuetype,
        priority: priorities[weightedIndex(rng, [5, 20, 50, 20, 5])],
        labels: Array.from(new Set(Array.from({ length: rng.int(0, 2) }, () => rng.pick(LABELS)))),
        duedate: rng.chance(0.25) ? jiraDate(epoch + rng.int(-60, 60) * DAY_MS).slice(0, 10) : null,
        project: { self: project.self, id: project.id, key: project.key, name: project.name, projectTypeKey: project.projectTypeKey, avatarUrls: project.avatarUrls },
        timeoriginalestimate: estimate,
        issuelinks: [],
        components: [],
        fixVersions: [],
        [FIELD.sprint]: sprintValue,
        [FIELD.points]: isSubtask || rng.chance(0.3) ? null : rng.pick(POINTS),
        [FIELD.flagged]: rng.chance(0.03) ? [FLAGGED_VALUE] : null,
      },
    };
    if (isSubtask) parent.subtaskKeys.push(key);
    else lastParent[projectIndex] = issue;
    issues.push(issue);
    byKey.set(key, issue);
  }

  return { epoch, me, users, statuses, issueTypes, priorities, resolution, projects, boards, sprints, filters, issues, byKey, fields: FIELDS };
};
