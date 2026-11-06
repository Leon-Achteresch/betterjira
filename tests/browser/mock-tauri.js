if (new URLSearchParams(location.search).get("reduce") === "1") {
  const originalMatchMedia = window.matchMedia.bind(window);
  window.matchMedia = (query) => {
    const result = originalMatchMedia(query);
    if (query.includes("prefers-reduced-motion")) Object.defineProperty(result, "matches", { value: true });
    return result;
  };
}
const scenario = new URLSearchParams(location.search).get("scenario");
const accountId = new URLSearchParams(location.search).get("account") || "qa-user";
const scheme = matchMedia("(prefers-color-scheme: dark)");
const applyScheme = () => document.documentElement.classList.toggle("dark", scheme.matches);
applyScheme();
scheme.addEventListener("change", applyScheme);
const author = {
  accountId: "qa-user",
  displayName: "Alex Beispiel",
  avatarUrls: { "48x48": "/logo.svg" },
};
const status = {
  id: "3",
  name: "In Arbeit",
  statusCategory: { key: "indeterminate", colorName: "yellow" },
};
const project = {
  id: "1",
  key: "DEMO",
  name: "Produktentwicklung",
  projectTypeKey: "software",
  avatarUrls: author.avatarUrls,
};
const paragraph = (text) => ({
  type: "doc",
  version: 1,
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});
const titles = [
  "Suche für den Arbeitsalltag vereinfachen",
  "Tastaturbedienung im Editor verbessern",
  "Übergabe an das Team vorbereiten",
];
const issues = Array.from({ length: scenario === "busy" ? 35 : scenario === "workspace" ? 12 : scenario === "ai" ? 8 : 3 }, (_, index) => ({
  id: String(index + 1),
  key: `DEMO-${index + 1}`,
  names: {
    assignee: "Bearbeiter",
    priority: "Priorität",
    duedate: "Fällig",
    description: "Beschreibung",
    summary: "Zusammenfassung",
  },
  editmeta: {
    fields: {
      summary: {
        name: "Zusammenfassung",
        required: true,
        schema: { type: "string", system: "summary" },
        operations: ["set"],
      },
      description: {
        name: "Beschreibung",
        required: false,
        schema: { type: "string", system: "description" },
        operations: ["set"],
      },
    },
  },
  fields: {
    summary: titles[index % titles.length] + (index > 2 ? ` · Teil ${index + 1}` : ""),
    status: { ...status },
    project,
    assignee: author,
    reporter: author,
    priority: { name: "Mittel" },
    issuetype: { name: "Aufgabe" },
    created: "2026-11-01T09:00:00Z",
    updated: "2026-11-04T10:00:00Z",
    description: paragraph(
      "Wir möchten die täglichen Abläufe mit weniger Kontextwechseln erledigen und die Zusammenarbeit im Team vereinfachen.",
    ),
    comment: {
      total: 2,
      comments: [
        {
          id: "c1",
          author,
          created: "2026-11-02T10:00:00Z",
          body: paragraph("Die erste Fassung ist bereit. Bitte besonders den Wechsel zwischen Vorgängen prüfen."),
        },
        {
          id: "c2",
          author,
          created: "2026-11-04T10:00:00Z",
          body: paragraph("Der aktuelle Stand ist mit dem Team abgestimmt."),
        },
      ],
    },
    attachment: [],
    subtasks: [],
    timetracking: {
      originalEstimate: "4h",
      timeSpent: "30m",
      remainingEstimate: "3h 30m",
    },
    worklog: { total: 0, worklogs: [] },
  },
}));
if (scenario === "busy") {
  issues[0].fields.description = {
    type: "doc",
    version: 1,
    content: Array.from({ length: 14 }, (_, index) => [
      { type: "heading", attrs: { level: 3 }, content: [{ type: "text", text: `Arbeitsschritt ${index + 1}` }] },
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "Beim Lesen dieses umfangreichen Tickets ist der genaue Wiedereinstieg nach einer Unterbrechung wichtig. Das Team prüft Anforderungen, Abhängigkeiten und die offenen Rückfragen sorgfältig. Die Lesestelle soll auch nach einem Wechsel zu einem anderen Vorgang erhalten bleiben.",
          },
        ],
      },
    ]).flat(),
  };
}
const boardStatuses = [
  { id: "10", name: "Triage", statusCategory: { key: "new", colorName: "blue-gray" } },
  { id: "11", name: "Zu erledigen", statusCategory: { key: "new", colorName: "blue-gray" } },
  { id: "3", name: "In Arbeit", statusCategory: { key: "indeterminate", colorName: "yellow" } },
  { id: "12", name: "Review", statusCategory: { key: "indeterminate", colorName: "yellow" } },
  { id: "13", name: "Blockiert", statusCategory: { key: "indeterminate", colorName: "yellow" } },
  { id: "4", name: "Erledigt", statusCategory: { key: "done", colorName: "green" } },
];
if (scenario === "board") {
  const people = ["Alex Beispiel", "Sam Muster", "Kim Probe", "Jo Test"].map((displayName, index) => ({
    accountId: `qa-${index}`,
    displayName,
    avatarUrls: author.avatarUrls,
  }));
  const priorities = ["Highest", "High", "Medium", "Low", "Lowest"];
  const labelPool = ["Performance", "Barrierefreiheit", "Dokumentation", "Bug", "Design", "Sicherheit"];
  const summaries = [
  "Datentabelle: Kopfmenü schwer auffindbar",
  "Datumsauswahl lädt bei langsamer Verbindung zu lange",
  "Combobox überspringt deaktivierte Optionen",
  "Toast-Stapel erscheint in falscher Reihenfolge",
  "Command Palette hängt bei Fehlern der Quelle",
  "Popover verrutscht auf iOS",
  "Select: Tippen springt nicht zwischen Gruppen",
  "Tailwind-Upgrade vorbereiten",
  "Avatar: Fallback bei fehlender Nutzer-ID",
  "Aria-Label für Formularfelder ergänzen",
  ];
  let seed = 7;
  const pick = (list) => list[(seed = (seed * 9301 + 49297) % 233280) % list.length];
  issues.length = 0;
  for (let index = 0; index < 64; index++) {
    const statusIndex = [0, 1, 1, 1, 2, 2, 3, 4, 5, 5, 5][index % 11];
    const labels = labelPool.filter(() => pick([0, 0, 0, 1]) === 1).slice(0, 2);
    issues.push({
      id: String(index + 1),
      key: `DEMO-${index + 1}`,
      fields: {
        summary: `${summaries[index % summaries.length]}${index >= summaries.length ? ` (${Math.floor(index / summaries.length) + 1})` : ""}`,
        status: boardStatuses[statusIndex],
        project,
        assignee: index % 7 === 6 ? null : pick(people),
        reporter: author,
        priority: { name: pick(priorities) },
        issuetype: { name: pick(["Aufgabe", "Bug", "Story"]) },
        labels,
        duedate: index % 3 === 0 ? `2026-11-${String((index % 27) + 1).padStart(2, "0")}` : null,
        created: "2026-10-20T09:00:00Z",
        updated: "2026-11-04T10:00:00Z",
        customfield_10016: pick([1, 2, 3, 5, 8]),
        subtasks: [],
        comment: { total: 0, comments: [] },
        attachment: [],
        worklog: { total: 0, worklogs: [] },
      },
    });
  }
}
if (scenario === "time-tracking") {
  const other = { accountId: "qa-other", displayName: "Sam Muster", avatarUrls: author.avatarUrls };
  const entries = [
    [0, "tt-1", author, "2026-11-02T09:00:00.000+0100", 3600, "Anforderungen mit dem Team abgestimmt"],
    [0, "tt-2", author, "2026-11-02T14:00:00.000+0100", 1800, ""],
    [0, "tt-3", other, "2026-11-02T10:00:00.000+0100", 7200, "Fremde Buchung"],
    [1, "tt-4", author, "2026-11-04T23:30:00.000+0000", 2700, "Testfälle ergänzt"],
    [1, "tt-5", author, "2026-11-06T08:15:00.000+0100", 4500, "Review vorbereitet"],
    [2, "tt-6", author, "2026-10-27T13:00:00.000+0100", 7200, "Übergabe dokumentiert"],
  ];
  for (const [index, id, user, started, seconds, text] of entries) {
    issues[index].fields.worklog.worklogs.push({ id, author: user, started, timeSpentSeconds: seconds, timeSpent: `${seconds / 60}m`, ...(text && { comment: paragraph(text) }) });
    issues[index].fields.worklog.total++;
  }
}
const wiki = Object.fromEntries(
  issues.map((issue) => [issue.key, "h2. Beschreibung\n\nVorhandener Text für die Bearbeitung."]),
);
const transitions = [
  { id: "21", name: "In Arbeit", to: status },
  {
    id: "31",
    name: "Erledigt",
    to: { id: "4", name: "Erledigt", statusCategory: { key: "done", colorName: "green" } },
  },
];
if (scenario === "board")
  transitions.splice(0, transitions.length, ...boardStatuses.map((entry) => ({ id: `t${entry.id}`, name: entry.name, to: entry })));
const briefing = {
  runId: "qa-briefing",
  generatedAt: new Date().toISOString(),
  summary: "Beginne mit der offenen Rückfrage, bevor du die Übergabe vorbereitest.",
  items: issues.slice(0, 8).map((issue, index) => ({
    key: issue.key,
    title: issue.fields.summary,
    urgency: index === 0 ? "now" : "today",
    action: index === 0 ? "Offene Rückfrage mit dem Team klären" : "Nächsten Schritt und Zuständigkeit prüfen",
    reason: "Im Ticket ist eine Abstimmung dokumentiert, die vor der weiteren Bearbeitung abgeschlossen werden sollte.",
    waitingOn: index === 1 ? "Design-Team" : null,
  })),
};
if (scenario === "ai") {
  localStorage.setItem(
    "betterjira-attention",
    JSON.stringify({
      state: {
        enabled: true,
        webhookUrl: "https://example.test/briefing",
        token: "qa-local-token",
        intervalMinutes: 30,
        pendingRunId: null,
        lastTriggeredAt: Date.now(),
      },
      version: 0,
    }),
  );
  localStorage.setItem(
    "betterjira-attention-runs",
    JSON.stringify({ state: { owners: { "qa-briefing": JSON.stringify(["qa-cloud", "qa-user"]) } }, version: 0 }),
  );
}
if (scenario === "busy") {
  const stored = JSON.parse(localStorage.getItem("betterjira-workspaces") || '{"state":{"workspaces":{}},"version":0}');
  const id = JSON.stringify(["qa-cloud", "qa-user"]);
  const current = stored.state.workspaces[id] || {
    recent: [],
    pinned: [],
    drafts: {},
    newestFirst: false,
    contexts: {},
  };
  const seen = new Set(current.recent.map((issue) => issue.key));
  current.recent = [
    ...current.recent,
    ...issues
      .filter((issue) => !seen.has(issue.key))
      .map((issue) => ({ key: issue.key, summary: issue.fields.summary })),
  ].slice(0, 50);
  current.contexts = {
    ...Object.fromEntries(
      issues.map((issue, index) => [
        issue.key,
        {
          summary: issue.fields.summary,
          note: "",
          scrollTop: 0,
          visitedAt: Date.now() - index * 60000,
          statusName: "In Arbeit",
          statusColor: "yellow",
        },
      ]),
    ),
    ...current.contexts,
  };
  stored.state.workspaces[id] = current;
  localStorage.setItem("betterjira-workspaces", JSON.stringify(stored));
  if (!localStorage.getItem("betterjira-issue-tabs")) {
    const keys = issues.slice(0, 12).map((issue) => issue.key);
    localStorage.setItem("betterjira-issue-tabs", JSON.stringify({ state: { keys, pinned: [keys[1]] }, version: 0 }));
  }
}
if (scenario === "notifications" || scenario === "notifications-foreign") {
  const minutes = (count) => Date.now() - count * 60000;
  const qaPeople = ["Sam Muster", "Kim Probe", "Jo Test"].map((displayName) => ({ displayName, avatarUrls: author.avatarUrls }));
  const entry = (id, issueKey, kind, created, title, body, actor, read = false) => ({
    id,
    issueKey,
    summary: issues.find((issue) => issue.key === issueKey)?.fields.summary ?? `QA-Testticket ${issueKey}`,
    kind,
    created,
    title,
    body,
    actor: qaPeople[actor],
    read,
  });
  const items = [
    entry("qa:1", "DEMO-1", "direct", minutes(5), "hat dich in einem Kommentar erwähnt", "Kannst du die Übergabe bis morgen prüfen?", 0),
    entry("qa:2", "DEMO-1", "direct", minutes(40), "hat den Status geändert", "Zu erledigen → In Arbeit", 1),
    entry("qa:3", "DEMO-2", "direct", minutes(90), "hat dir ein Ticket zugewiesen", "", 2),
    entry("qa:4", "DEMO-3", "direct", minutes(26 * 60), "hat einen Kommentar hinzugefügt", "Der Entwurf liegt im Team-Ordner.", 1, true),
    ...Array.from({ length: 9 }, (_, index) =>
      entry(`qa:w${index}`, `DEMO-${index + 4}`, "watching", minutes(15 + index * 20), "hat die Priorität geändert", "Hoch", index % 3, index > 5),
    ),
  ];
  const owner = JSON.stringify(scenario === "notifications" ? ["qa-cloud", "qa-user"] : ["other-cloud", "other-user"]);
  if (scenario === "notifications-foreign" || !localStorage.getItem("betterjira-notifications"))
    localStorage.setItem("betterjira-notifications", JSON.stringify({ state: { owner, items, checkedAt: minutes(1) }, version: 2 }));
}
const scmScenario = scenario?.startsWith("scm") ? scenario : null;
const scmHoursAgo = (hours) => new Date(Date.now() - hours * 3600000).toISOString();
const scmPerson = (login) => ({ login, avatarUrl: "/logo.svg" });
const scmGraphPullRequest = (repo, number, title, state, hours, extra = {}) => ({
  number,
  title,
  url: `https://github.com/${repo}/pull/${number}`,
  state,
  isDraft: false,
  headRefName: `feature/DEMO-${number}`,
  baseRefName: "main",
  updatedAt: scmHoursAgo(hours),
  author: scmPerson("qa-alex"),
  latestReviews: { nodes: [] },
  reviewRequests: { nodes: [] },
  commits: { nodes: [{ commit: { statusCheckRollup: state === "OPEN" ? { state: "SUCCESS" } : null } }] },
  ...extra,
});
const scmGithub = {
  "qa/web-app": {
    OPEN: [
      scmGraphPullRequest("qa/web-app", 41, "DEMO-1 Suche für den Arbeitsalltag vereinfachen", "OPEN", 2, {
        latestReviews: { nodes: [{ state: "APPROVED", author: scmPerson("qa-kim") }] },
      }),
      scmGraphPullRequest("qa/web-app", 39, "DEMO-2 Tastaturbedienung im Editor verbessern", "OPEN", 26, {
        commits: { nodes: [{ commit: { statusCheckRollup: { state: "FAILURE" } } }] },
        latestReviews: { nodes: [{ state: "CHANGES_REQUESTED", author: scmPerson("qa-sam") }] },
      }),
      scmGraphPullRequest("qa/web-app", 44, "DEMO-3 Übergabe an das Team vorbereiten", "OPEN", 5, {
        isDraft: true,
        commits: { nodes: [{ commit: { statusCheckRollup: { state: "PENDING" } } }] },
      }),
    ],
    MERGED: [
      scmGraphPullRequest("qa/web-app", 37, "DEMO-1 Filter in der Seitenleiste", "MERGED", 50),
      scmGraphPullRequest("qa/web-app", 35, "Abhängigkeiten aktualisieren", "MERGED", 120),
    ],
    CLOSED: [scmGraphPullRequest("qa/web-app", 33, "Experiment: neue Navigation", "CLOSED", 200)],
    totalOpen: 40,
  },
  "qa/design-system": {
    OPEN: [
      scmGraphPullRequest("qa/design-system", 12, "Tooltip-Abstände vereinheitlichen", "OPEN", 8, {
        reviewRequests: { nodes: [{ requestedReviewer: scmPerson("qa-jo") }] },
      }),
    ],
    MERGED: [scmGraphPullRequest("qa/design-system", 10, "Farbtokens für Dark Mode", "MERGED", 72)],
    CLOSED: [],
  },
};
const scmCloud = {
  OPEN: [
    {
      id: 7,
      title: "DEMO-2 Schnittstelle für Kommentare",
      state: "OPEN",
      draft: false,
      updated_on: scmHoursAgo(3),
      author: { display_name: "QA Kim", links: { avatar: { href: "/logo.svg" } } },
      source: { branch: { name: "feature/DEMO-2-kommentare" }, commit: { hash: "abc123" } },
      destination: { branch: { name: "main" } },
      links: { html: { href: "https://bitbucket.org/qa-team/api/pull-requests/7" } },
      participants: [{ user: { display_name: "QA Alex", links: {} }, role: "REVIEWER", approved: true, state: "approved" }],
    },
  ],
  MERGED: [],
  DECLINED: [],
  SUPERSEDED: [],
};
const scmRespond = async ({ url, body }) => {
  const qa = window.__qaScm;
  qa.requests.push(url);
  if (qa.delayMs) await new Promise((resolve) => setTimeout(resolve, qa.delayMs));
  const json = (value, status = 200) => ({ status, body: JSON.stringify(value) });
  if (url.startsWith("https://api.github.com/graphql")) {
    const { query, variables } = JSON.parse(body);
    const repo = `${variables.owner}/${variables.name}`;
    if (qa.failRepos.includes(repo)) return json({ message: "Test: GitHub vorübergehend nicht erreichbar" }, 502);
    if (query.includes("search(")) return json({ data: { search: { nodes: [] }, repository: { refs: { nodes: [] } } } });
    const data = scmGithub[repo];
    if (!data) return json({ data: { repository: null }, errors: [{ message: `Test: ${repo} nicht gefunden` }] });
    const nodes = variables.states.flatMap((state) => data[state] ?? []);
    const totalCount = variables.states.includes("OPEN") && data.totalOpen ? data.totalOpen : nodes.length;
    return json({ data: { repository: { pullRequests: { totalCount, nodes } } } });
  }
  if (url.startsWith("https://api.bitbucket.org/2.0/repositories/qa-team/api/pullrequests")) {
    if (qa.failRepos.includes("qa-team/api")) return json({ error: { message: "Test: Bitbucket antwortet nicht" } }, 503);
    if (url.includes("/statuses")) return json({ values: [{ state: "INPROGRESS" }] });
    const states = new URL(url).searchParams.getAll("state");
    return json({ values: states.flatMap((state) => scmCloud[state] ?? []) });
  }
  return json({ message: `Keine Testantwort für ${url}` }, 404);
};
if (scmScenario) {
  window.__qaScm = {
    failRepos: scmScenario === "scm-partial" ? ["qa-team/api"] : [],
    delayMs: scmScenario === "scm-slow" ? 1200 : 0,
    requests: [],
    opened: [],
    hosts: scmScenario === "scm-empty" ? { hosts: {} } : { hosts: { "github.com": [{ state: "success", active: true, host: "github.com", login: "qa-user" }] } },
  };
  const cloudConnection = {
    id: "qa-cloud-connection",
    kind: "bitbucket-cloud",
    label: "Bitbucket Cloud",
    baseUrl: "https://bitbucket.org",
    account: "QA Kim",
    auth: { kind: "token", id: "qa-cloud-connection", username: "qa-kim" },
  };
  const links = [
    { connectionId: "gh:github.com", repo: "qa/web-app" },
    { connectionId: "gh:github.com", repo: "qa/design-system" },
    { connectionId: cloudConnection.id, repo: "qa-team/api" },
    ...(scmScenario === "scm-partial" ? [{ connectionId: "gh:git.example.test", repo: "qa/archiv" }] : []),
  ];
  localStorage.setItem(
    "betterjira-scm",
    JSON.stringify({
      state: scmScenario === "scm-empty" ? { connections: [], repoLinks: {} } : { connections: [cloudConnection], repoLinks: { DEMO: links, OPS: links.slice(0, 1) } },
      version: 0,
    }),
  );
}
if (scenario === "workspace") {
  const stored = JSON.parse(localStorage.getItem("betterjira-workspaces") || '{"state":{"workspaces":{}},"version":0}');
  const own = JSON.stringify(["qa-cloud", "qa-user"]);
  const remembered = (index) => ({ key: issues[index].key, summary: issues[index].fields.summary });
  const context = (index, extra = {}) => ({
    summary: issues[index].fields.summary,
    note: "",
    scrollTop: 0,
    visitedAt: Date.now() - (index + 1) * 7 * 60000,
    statusName: "In Arbeit",
    statusColor: "yellow",
    ...extra,
  });
  stored.state.workspaces[own] ??= {
    recent: issues.slice(0, 10).map((_, index) => remembered(index)),
    pinned: [remembered(1), remembered(4)],
    drafts: { "DEMO-3": "QA-Entwurf: Rückfrage zur Übergabe noch offen" },
    newestFirst: false,
    contexts: {
      ...Object.fromEntries(issues.slice(0, 10).map((issue, index) => [issue.key, context(index)])),
      "DEMO-1": context(0, { scrollTop: 640 }),
      "DEMO-4": context(3, { note: "QA-Notiz: vor Freigabe mit Team abstimmen" }),
    },
  };
  stored.state.workspaces[JSON.stringify(["qa-cloud", "qa-colleague"])] ??= {
    recent: [remembered(11)],
    pinned: [],
    drafts: { "DEMO-12": "QA-Entwurf eines anderen Kontos" },
    newestFirst: false,
    contexts: { "DEMO-12": context(11, { note: "QA-Notiz eines anderen Kontos" }) },
  };
  localStorage.setItem("betterjira-workspaces", JSON.stringify(stored));
  if (!localStorage.getItem("betterjira-field-drafts")) {
    const draft = (key) => JSON.stringify(["qa-cloud", "qa-user", key, "description"]);
    localStorage.setItem(
      "betterjira-field-drafts",
      JSON.stringify({
        state: {
          drafts: {
            [draft("DEMO-2")]: { text: "QA-Feldentwurf Beschreibung", revision: "qa-1" },
            [draft("OPS-7")]: { text: "QA-Feldentwurf ohne bekannte Details", revision: "qa-2" },
          },
        },
        version: 0,
      }),
    );
  }
}
const callbacks = new Map();
const listeners = new Map();
let listenerId = 0;
let callbackId = 0;
const requests = new Map();
let nextId = 0;
window.__qa = { writes: [], failNextWrite: false, delayMs: 0, issues, wiki, briefing, briefingFailure: false, searches: [], searchDelayMs: 0, failSearch: false, emptySearch: false, sessionFailure: scenario === "session-error", sessionDelayMs: scenario === "session-slow" ? 1500 : 0 };
window.__qa.outlook = {
  calls: [],
  failNext: false,
  account: { id: "ABC123", displayName: "Lokaler Outlook-Testkalender", email: "outlook@example.com" },
  events: [{ id: "AAAA", title: "Externer Outlook-Termin", start: "2026-11-06T10:00:00.000Z", end: "2026-11-06T11:00:00.000Z", webLink: "", isAllDay: false }],
};
const respond = async (request) => {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^.*\/rest\/(?:api\/[23]|agile\/1\.0)/, "");
  if (request.method !== "GET") {
    if (path.endsWith("approximate-count")) return { body: { count: issues.length } };
    if (path.startsWith("/jql/parse")) return { body: { queries: [{ errors: [] }] } };
    if (window.__qa.delayMs) await new Promise((resolve) => setTimeout(resolve, window.__qa.delayMs));
    if (window.__qa.failNextWrite) {
      window.__qa.failNextWrite = false;
      return {
        status: 503,
        body: { errorMessages: ["Test: Jira vorübergehend nicht erreichbar"] },
      };
    }
    const input = request.data ? JSON.parse(new TextDecoder().decode(new Uint8Array(request.data))) : {};
    window.__qa.writes.push({ path, method: request.method, input });
    const issue = issues.find((issue) => path.startsWith(`/issue/${issue.key}/`) || path === `/issue/${issue.key}`);
    if (path.endsWith("/comment") && issue)
      issue.fields.comment.comments.push({
        id: `new-${nextId}`,
        author,
        created: new Date().toISOString(),
        body: paragraph(input.body),
      });
    if (path.endsWith("/worklog") && issue) {
      issue.fields.worklog.worklogs.push({
        id: `work-${nextId}`,
        author,
        timeSpent: input.timeSpent,
        started: input.started,
      });
      issue.fields.worklog.total++;
    }
    if (path.endsWith("/transitions") && issue)
      issue.fields.status = transitions.find((entry) => entry.id === input.transition.id).to;
    if (request.method === "PUT" && issue && input.fields) {
      Object.assign(issue.fields, input.fields);
      if (typeof input.fields.description === "string") {
        wiki[issue.key] = input.fields.description;
        issue.fields.description = paragraph(input.fields.description);
      }
    }
    return { status: 204 };
  }
  if (path === "/myself") return { body: { ...author, accountId } };
  if (path.startsWith("/project/search")) return { body: { isLast: true, values: [project] } };
  if (path.startsWith("/filter/my")) return { body: [] };
  if (path === "/field")
    return {
      body: ["summary", "status", "assignee", "priority", "updated", "issuetype"].map((id) => ({
        id,
        name: {
          summary: "Zusammenfassung",
          status: "Status",
          assignee: "Bearbeiter",
          priority: "Priorität",
          updated: "Aktualisiert",
          issuetype: "Typ",
        }[id],
        orderable: true,
        clauseNames: [id],
      })),
    };
  if (path.startsWith("/search/jql")) {
    const qa = window.__qa;
    qa.searches.push(url.searchParams.get("jql"));
    const rule = window.__qaSearchRule?.(url.searchParams.get("jql") ?? "", url.searchParams.get("nextPageToken")) ?? {};
    const delayMs = rule.delayMs ?? qa.searchDelayMs;
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    if (rule.status) return { status: rule.status, body: { errorMessages: [`Test: Jira antwortet mit ${rule.status}`] } };
    if (qa.failSearch) return { status: 400, body: { errorMessages: ["Test: Abfrage nicht möglich"] } };
    const found = rule.keys ? issues.filter((issue) => rule.keys.includes(issue.key)) : issues;
    return { body: { issues: qa.emptySearch ? [] : found, isLast: !rule.nextPageToken, nextPageToken: rule.nextPageToken } };
  }
  if (scenario === "board" && /^\/board\/\d+\/configuration/.test(path))
    return {
      body: {
        filter: { id: "100" },
        estimation: { field: { fieldId: "customfield_10016" } },
        columnConfig: {
          columns: boardStatuses.map((entry) => ({ name: entry.name, statuses: [{ id: entry.id }] })),
        },
      },
    };
  if (scenario === "board" && path.startsWith("/board"))
    return { body: { values: [{ id: 1, name: "Team-Board", type: "kanban", location: { projectKey: "DEMO" } }] } };
  if (path.startsWith("/board")) return { body: { values: [] } };
  if (path.endsWith("/transitions")) return { body: { transitions } };
  const worklogPath = path.match(/^\/issue\/([^/]+)\/worklog$/);
  if (worklogPath) {
    const target = issues.find((issue) => issue.id === worklogPath[1] || issue.key === worklogPath[1]);
    const rule = window.__qaWorklogRule?.(target?.key ?? worklogPath[1]) ?? {};
    if (rule.delayMs) await new Promise((resolve) => setTimeout(resolve, rule.delayMs));
    if (rule.status) return { status: rule.status, body: { errorMessages: [`Test: Jira antwortet mit ${rule.status}`] } };
    const instant = (value) => Date.parse(value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
    const seconds = (value = "") => [...value.matchAll(/(\d+)\s*([wdhm])/g)].reduce((total, [, amount, unit]) => total + Number(amount) * { w: 144000, d: 28800, h: 3600, m: 60 }[unit], 0);
    const after = Number(url.searchParams.get("startedAfter") ?? -Infinity);
    const before = Number(url.searchParams.get("startedBefore") ?? Infinity);
    const startAt = Number(url.searchParams.get("startAt") ?? 0);
    const maxResults = Math.min(rule.pageSize ?? Infinity, Number(url.searchParams.get("maxResults") ?? 5000));
    const all = (target?.fields.worklog.worklogs ?? [])
      .filter((entry) => instant(entry.started) >= after && instant(entry.started) < before)
      .map((entry) => ({ ...entry, timeSpentSeconds: entry.timeSpentSeconds ?? seconds(entry.timeSpent) }));
    return { body: { startAt, maxResults, total: all.length, worklogs: all.slice(startAt, startAt + maxResults) } };
  }
  const issue = issues.find((issue) => path === `/issue/${issue.key}`);
  if (issue && url.pathname.includes("/api/2/") && url.searchParams.get("fields") === "description")
    return { body: { fields: { description: wiki[issue.key] } } };
  if (issue) return { body: issue };
  return {
    status: 404,
    body: { errorMessages: [`Keine Testantwort für ${path}`] },
  };
};
window.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
  unregisterListener: (event, id) => {
    const listener = listeners.get(id);
    if (listener?.event === event) {
      callbacks.delete(listener.handler);
      listeners.delete(id);
    }
  },
};
window.__TAURI_INTERNALS__ = {
  metadata: {
    currentWindow: { label: "main" },
    currentWebview: { label: "main" },
  },
  transformCallback: (callback) => {
    const id = ++callbackId;
    callbacks.set(id, callback);
    return id;
  },
  unregisterCallback: () => {},
  invoke: async (command, args = {}) => {
    if (command === "session_get" && scenario === "scm-offline") return null;
    if (command === "scm_gh_hosts" && scmScenario) return JSON.stringify(window.__qaScm.hosts);
    if (command === "scm_request" && scmScenario) return scmRespond(args);
    if (command === "plugin:opener|open_url" && scmScenario) {
      window.__qaScm.opened.push(args.url);
      return null;
    }
    if (command === "outlook_request") {
      const outlook = window.__qa.outlook;
      const input = args.request;
      outlook.calls.push(input);
      if (outlook.failNext) {
        outlook.failNext = false;
        const message = outlook.failureMessage ?? "Test: Outlook vorübergehend nicht erreichbar";
        outlook.failureMessage = null;
        throw message;
      }
      if (input.action === "account") return outlook.account;
      if (input.accountId !== outlook.account.id) throw "Test: Outlook-Profil wurde gewechselt";
      if (input.action === "list") return outlook.events.filter((event) => event.start < input.end && event.end > input.start);
      if (input.action === "upsert") {
        const rollout = input.rollout;
        const existing = outlook.events.find((event) => event.rolloutId === rollout.id);
        const event = { id: existing?.id ?? `BEEF${outlook.events.length}`, rolloutId: rollout.id, title: rollout.title, start: rollout.start, end: rollout.end, webLink: "", isAllDay: false };
        outlook.events = [...outlook.events.filter((entry) => entry.id !== event.id), event];
        return { id: event.id, accountId: outlook.account.id };
      }
      if (input.action === "delete") {
        outlook.events = outlook.events.filter((event) => event.id !== input.eventId);
        return null;
      }
      if (input.action === "open") return null;
      throw "Test: Unbekannte Outlook-Aktion";
    }
    if (command === "session_get" && window.__qa.sessionDelayMs)
      await new Promise((resolve) => setTimeout(resolve, window.__qa.sessionDelayMs));
    if (command === "session_get" && (scenario === "calendar-offline" || window.__qa.signedOut)) return null;
    if (command === "session_delete") {
      window.__qa.signedOut = true;
      return null;
    }
    if (command === "session_get" && window.__qa.sessionFailure) throw "Test: Schlüsselbund gesperrt";
    if (command === "session_get")
      return JSON.stringify({
        accessToken: "local-test",
        refreshToken: "local-test",
        expiresAt: Date.now() + 3600000,
        cloudId: "qa-cloud",
        siteUrl: "https://example.atlassian.net",
        siteName: "Lokale UI-Testdaten",
      });
    if (command === "oauth_login") throw "Test: Anmeldung abgebrochen";
    if (command === "oauth_cancel") return null;
    if (command === "scm_gh_hosts") return JSON.stringify([]);
    if (command === "attention_read") return scenario === "ai" ? JSON.stringify(window.__qa.briefing) : null;
    if (command === "attention_serve") return 8743;
    if (command === "attention_trigger") {
      if (window.__qa.briefingFailure) throw new Error("Test: Agent vorübergehend nicht erreichbar");
      window.__qa.attentionRequest = JSON.parse(args.body);
      const request = window.__qa.attentionRequest;
      setTimeout(() => {
        window.__qa.briefing = {
          ...briefing,
          runId: request.runId,
          generatedAt: new Date().toISOString(),
          summary: "Neuer Stand: Kläre zuerst die Rückfrage und prüfe danach die Übergabe.",
        };
        for (const listener of listeners.values()) {
          if (listener.event === "attention-updated")
            callbacks.get(listener.handler)?.({ event: listener.event, payload: null });
        }
      }, 1000);
      return;
    }
    if (command === "plugin:event|listen") {
      const id = ++listenerId;
      listeners.set(id, args);
      return id;
    }
    if (command === "plugin:window|is_focused") return true;
    if (command === "plugin:http|fetch") {
      const id = ++nextId;
      requests.set(id, { request: args.clientConfig, sent: false });
      return id;
    }
    if (command === "plugin:http|fetch_send") {
      const entry = requests.get(args.rid);
      const result = await respond(entry.request);
      entry.result = result;
      return {
        status: result.status ?? 200,
        statusText: "Test",
        url: entry.request.url,
        headers: [["content-type", "application/json"]],
        rid: args.rid,
      };
    }
    if (command === "plugin:http|fetch_read_body") {
      const entry = requests.get(args.rid);
      if (entry.sent) {
        requests.delete(args.rid);
        return [1];
      }
      entry.sent = true;
      return [...new TextEncoder().encode(JSON.stringify(entry.result.body ?? {})), 0];
    }
    if (command.startsWith("plugin:http|fetch_cancel")) {
      requests.delete(args.rid);
      return;
    }
    if (command.startsWith("plugin:event|")) return;
    if (command === "plugin:notification|is_permission_granted") return false;
    throw new Error(`Nicht simuliertes Tauri-Kommando: ${command}`);
  },
};
