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
}
const callbacks = new Map();
const listeners = new Map();
let listenerId = 0;
let callbackId = 0;
const requests = new Map();
let nextId = 0;
window.__qa = { writes: [], failNextWrite: false, delayMs: 0, issues, wiki, briefing, briefingFailure: false, searches: [], searchDelayMs: 0, failSearch: false, emptySearch: false, sessionFailure: scenario === "session-error" };
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
    if (command === "session_get" && scenario === "calendar-offline") return null;
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
