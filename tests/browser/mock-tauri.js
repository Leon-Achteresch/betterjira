if (new URLSearchParams(location.search).get("reduce") === "1") {
  const originalMatchMedia = window.matchMedia.bind(window);
  window.matchMedia = (query) => {
    const result = originalMatchMedia(query);
    if (query.includes("prefers-reduced-motion")) Object.defineProperty(result, "matches", { value: true });
    return result;
  };
}
const scenario = new URLSearchParams(location.search).get("scenario");
const scheme = matchMedia("(prefers-color-scheme: dark)");
const applyScheme = () => document.documentElement.classList.toggle("dark", scheme.matches);
applyScheme();
scheme.addEventListener("change", applyScheme);
const author = {
  accountId: "qa-user",
  displayName: "Alex Beispiel",
  avatarUrls: { "48x48": "/logo.svg" },
};
const person = (accountId, displayName, extra = {}) => ({
  accountId,
  accountType: "atlassian",
  active: true,
  displayName,
  avatarUrls: { "48x48": "/logo.svg" },
  ...extra,
});
const lea = person("qa-lea", "Lea Muster");
const automation = person("qa-app", "Automation für Jira", { accountType: "app" });
const former = person("qa-former", "Ehemalige Kollegin", { active: false });
const kim = person("qa-kim", "Kim Extern");
const people = [author, lea, automation, former, kim];
const status = {
  id: "3",
  name: "In Arbeit",
  statusCategory: { key: "indeterminate", colorName: "yellow" },
};
const project = {
  id: "1",
  key: "DEMO",
  name: "Produktentwicklung",
  projectTypeKey: scenario === "jsm" ? "service_desk" : "software",
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
const issues = Array.from({ length: scenario === "busy" ? 35 : scenario === "ai" ? 8 : 3 }, (_, index) => ({
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
    reporter: index === 0 ? former : author,
    priority: { name: "Mittel" },
    issuetype: { name: "Aufgabe" },
    created: "2026-11-01T09:00:00Z",
    updated: "2026-11-04T10:00:00Z",
    description: paragraph(
      "Wir möchten die täglichen Abläufe mit weniger Kontextwechseln erledigen und die Zusammenarbeit im Team vereinfachen.",
    ),
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
const entry = (id, who, created, text, parentId) => ({
  id,
  author: who,
  created,
  body: paragraph(text),
  ...(parentId === undefined ? {} : { parentId }),
});
const comments = Object.fromEntries(
  issues.map((issue, index) => [
    issue.key,
    index === 0
      ? [
          entry("10001", author, "2026-11-02T10:00:00Z", "Die erste Fassung ist bereit. Bitte besonders den Wechsel zwischen Vorgängen prüfen."),
          entry("10002", lea, "2026-11-03T09:00:00Z", "Ich habe eine Rückfrage zur Reihenfolge der Schritte."),
          entry("10003", author, "2026-11-03T11:00:00Z", "Die Reihenfolge folgt dem Ablauf im Team.", 10002),
          entry("10004", automation, "2026-11-03T12:00:00Z", "Automatischer Hinweis: Fälligkeit in drei Tagen."),
          entry("10005", lea, "2026-11-04T08:00:00Z", "Danke, dann passt es so.", "10002"),
          entry("10006", lea, "2026-11-04T09:00:00Z", "Antwort auf einen Kommentar, der nicht mehr existiert.", 99999),
          entry("10007", author, "2026-11-04T10:00:00Z", "Der aktuelle Stand ist mit dem Team abgestimmt."),
        ]
      : [
          entry(String(20001 + index * 10), author, "2026-11-02T10:00:00Z", "Die erste Fassung ist bereit. Bitte besonders den Wechsel zwischen Vorgängen prüfen."),
          entry(String(20002 + index * 10), author, "2026-11-04T10:00:00Z", "Der aktuelle Stand ist mit dem Team abgestimmt."),
        ],
  ]),
);
let nextCommentId = 30000;
const withEmbeddedComments = (issue) => {
  const list = comments[issue.key] ?? [];
  return {
    ...issue,
    fields: {
      ...issue.fields,
      comment: { total: list.length, maxResults: 20, startAt: 0, comments: list.slice(0, 20).map(({ parentId, ...rest }) => rest) },
    },
  };
};
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
}
const callbacks = new Map();
const listeners = new Map();
let listenerId = 0;
let callbackId = 0;
const requests = new Map();
let nextId = 0;
window.__qa = {
  writes: [],
  failNextWrite: false,
  delayMs: 0,
  issues,
  wiki,
  briefing,
  briefingFailure: false,
  comments,
  people,
  commentPageSize: 2,
  readDelayMs: 0,
  failCommentList: false,
  failUserSearch: false,
  rejectParentId: false,
  ignoreParentId: false,
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
    const issue = issues.find((issue) => path.startsWith(`/issue/${issue.key}/`) || path === `/issue/${issue.key}`);
    if (path.endsWith("/comment") && issue && request.method === "POST") {
      if (input.parentId !== undefined && window.__qa.rejectParentId)
        return { status: 400, body: { errorMessages: ["Test: Jira lehnt parentId ab"] } };
      window.__qa.writes.push({ path, method: request.method, input });
      const created = {
        id: String(++nextCommentId),
        author,
        created: new Date().toISOString(),
        body: typeof input.body === "string" ? paragraph(input.body) : input.body,
        ...(input.parentId !== undefined && !window.__qa.ignoreParentId ? { parentId: input.parentId } : {}),
      };
      comments[issue.key].push(created);
      return { status: 201, body: created };
    }
    window.__qa.writes.push({ path, method: request.method, input });
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
  if (path === "/myself") return { body: author };
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
  if (path.startsWith("/search/jql")) return { body: { issues: issues.map(withEmbeddedComments), isLast: true } };
  if (path.startsWith("/board")) return { body: { values: [] } };
  if (path.endsWith("/transitions")) return { body: { transitions } };
  const commentPath = path.match(/^\/issue\/([^/]+)\/comment$/);
  if (commentPath) {
    if (window.__qa.readDelayMs) await new Promise((resolve) => setTimeout(resolve, window.__qa.readDelayMs));
    if (window.__qa.failCommentList)
      return { status: 503, body: { errorMessages: ["Test: Kommentare vorübergehend nicht abrufbar"] } };
    const list = comments[decodeURIComponent(commentPath[1])] ?? [];
    const startAt = Number(url.searchParams.get("startAt") ?? 0);
    const size = Math.min(Number(url.searchParams.get("maxResults") ?? 100), window.__qa.commentPageSize);
    return { body: { startAt, maxResults: size, total: list.length, comments: list.slice(startAt, startAt + size) } };
  }
  if (path.startsWith("/user/viewissue/search")) {
    if (window.__qa.failUserSearch) return { status: 503, body: { errorMessages: ["Test: Personensuche nicht erreichbar"] } };
    const query = (url.searchParams.get("query") ?? "").toLocaleLowerCase("de");
    return { body: people.filter((candidate) => candidate.displayName.toLocaleLowerCase("de").includes(query)) };
  }
  const issue = issues.find((issue) => path === `/issue/${issue.key}`);
  if (issue && url.pathname.includes("/api/2/") && url.searchParams.get("fields") === "description")
    return { body: { fields: { description: wiki[issue.key] } } };
  if (issue) return { body: withEmbeddedComments(issue) };
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
    if (command === "session_get")
      return JSON.stringify({
        accessToken: "local-test",
        refreshToken: "local-test",
        expiresAt: Date.now() + 3600000,
        cloudId: "qa-cloud",
        siteUrl: "https://example.atlassian.net",
        siteName: "Lokale UI-Testdaten",
      });
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
