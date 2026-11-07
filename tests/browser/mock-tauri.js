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
const cloudId = new URLSearchParams(location.search).get("cloud") || "qa-cloud";
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
const projects =
  scenario === "projects"
    ? [
        ["1", "DEMO", "Produktentwicklung"],
        ["2", "OPS", "Betrieb"],
        ["3", "OLD", "Archiv 2024"],
        ["4", "MOB", "Mobile App"],
        ["5", "WEB", "Webauftritt"],
        ["6", "SEC", "Sicherheit"],
        ["7", "DATA", "Datenplattform"],
      ].map(([id, key, name]) => ({ ...project, id, key, name }))
    : [project];
if (scenario === "projects" && !localStorage.getItem("betterjira-favorites"))
  localStorage.setItem("betterjira-favorites", JSON.stringify({ state: { scopes: { [JSON.stringify([cloudId, accountId])]: { favoriteIds: ["2"], hiddenIds: ["3"] } }, legacy: null }, version: 0 }));
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
const issues = Array.from({ length: scenario === "busy" ? 35 : scenario === "workspace" || scenario === "subtasks" ? 12 : scenario === "ai" ? 8 : 3 }, (_, index) => ({
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
if (scenario === "comment-links")
  issues[0].fields.comment.comments = [
    { id: "10001", author, created: "2026-11-02T10:00:00Z", body: paragraph("Erster QA-Kommentar mit numerischer ID.") },
    {
      id: "10002",
      author: { ...author, accountId: "qa-long-name", displayName: "Maximiliane Alexandra Beispielhaft-Langnamige von und zu Testdorf (Qualitätssicherung Nord)" },
      created: "2026-11-04T10:00:00Z",
      body: paragraph("Zweiter QA-Kommentar mit sehr langem Autorennamen."),
    },
  ];
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
if (window.__qaDescriptions)
  for (const issue of issues) if (issue.key in window.__qaDescriptions) issue.fields.description = window.__qaDescriptions[issue.key];
if (scenario === "subtasks") {
  const subtaskStatuses = [
    { id: "11", name: "Zu erledigen", statusCategory: { key: "new", colorName: "blue-gray" } },
    { id: "3", name: "In Arbeit", statusCategory: { key: "indeterminate", colorName: "yellow" } },
    { id: "4", name: "Erledigt", statusCategory: { key: "done", colorName: "green" } },
    { id: "99", name: "Erledigt (Import)", statusCategory: { key: "undefined", colorName: "medium-gray" } },
  ];
  const subtaskOf = (issue, statusIndex) => {
    issue.fields.status = subtaskStatuses[statusIndex];
    return { id: issue.id, key: issue.key, fields: { summary: issue.fields.summary, status: issue.fields.status } };
  };
  issues.slice(2, 11).forEach((issue, index) => {
    issue.fields.summary = `Teilschritt ${index + 3} umsetzen`;
  });
  issues[0].fields.subtasks = [1, 2, 0, 2, 3, 1, 2, 0, 2, 2].map((statusIndex, index) => subtaskOf(issues[index + 1], statusIndex));
  issues[1].fields.subtasks = [subtaskOf(issues[11], 2)];
}
if (scenario === "comments") {
  const person = (accountId, displayName) => ({ accountId, displayName, avatarUrls: author.avatarUrls });
  const sam = person("qa-sam", "Sam Muster");
  const kim = person("qa-kim", "Kim Probe");
  issues[0].fields.comment.comments.push(
    {
      id: "c3",
      author: sam,
      created: "2026-11-03T08:30:00Z",
      body: {
        type: "doc",
        version: 1,
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Rückfrage zum Rollout:" }, { type: "hardBreak" }, { type: "text", text: "Staging ist freigegeben." }] },
          { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "Preis (netto) + 19 % [offen]" }] }] }] },
        ],
      },
    },
    {
      id: "c4",
      author: kim,
      created: "2026-11-05T14:00:00Z",
      body: paragraph("Sieht gut aus, ich übernehme die Dokumentation."),
    },
    {
      id: "c5",
      author: sam,
      created: "2026-11-05T16:45:00Z",
      body: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: "Danke " }, { type: "mention", attrs: { id: "qa-kim", text: "@Kim Probe" } }, { type: "text", text: "!" }] }] },
    },
  );
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
if (scenario === "attachments") {
  const attachment = (id, filename, mimeType, size) => ({ id, filename, mimeType, size, created: "2026-11-03T09:00:00Z", author });
  issues[0].fields.attachment = window.__qaAttachments ?? [
    attachment("att-1", "Screenshot Übergabe.png", "image/png", 245_000),
    attachment("att-2", "Angebot (final) [v2].pdf", "application/pdf", 1_840_000),
    attachment("att-3", "Protokoll_Abstimmung_Team_mit_sehr_langem_Dateinamen_der_umbrechen_muss_2026-11-03.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 38_000),
    attachment("att-4", "export.csv", "text/csv", 2_100),
    attachment("att-5", "archiv.zip", "application/zip", 5_300_000),
    attachment("att-6", "", "", 512),
    attachment("att-7", "bericht.pdf", "application/octet-stream", 92_000),
  ];
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
if (scenario === "comment-pages") {
  for (let index = 3; index <= 7; index++)
    issues[0].fields.comment.comments.push({
      id: `c${index}`,
      author,
      created: `2026-11-05T1${index}:00:00Z`,
      body: paragraph(`Verlaufseintrag ${index}: nachgeladener Testkommentar.`),
    });
}
const sortedComments = (issue) =>
  [...issue.fields.comment.comments].sort((a, b) => Date.parse(a.created) - Date.parse(b.created));
const commentWindow = (issue) => {
  const all = sortedComments(issue);
  const limit = window.__qa.commentDetailLimit;
  return { startAt: 0, maxResults: limit, total: all.length, comments: all.slice(0, limit) };
};
const attachmentSortFixture = (id, filename, mimeType, size, created) => ({ id, filename, mimeType, size, created, author });
if (scenario === "attachment-sort") {
  issues[0].fields.attachment = [
    attachmentSortFixture("qa-att-1", "Bericht 10.pdf", "application/pdf", 2400000, "2026-11-03T08:00:00.000+0000"),
    attachmentSortFixture("qa-att-2", "bericht 2.pdf", "application/pdf", 512, "2026-11-05T10:00:00.000+0100"),
    attachmentSortFixture("qa-att-3", "Screenshot.png", "image/png", 48000, "kein-datum"),
    attachmentSortFixture("qa-att-4", "", "text/plain", 2048, "2026-11-01T09:00:00.000+0000"),
    attachmentSortFixture("qa-att-5", "Anhang.txt", "text/plain", 2048, "2026-11-05T09:00:00.000+0000"),
  ];
  issues[1].fields.attachment = [
    attachmentSortFixture("qa-att-6", "zeta.txt", "text/plain", 1, "2026-11-02T09:00:00.000+0000"),
    attachmentSortFixture("qa-att-7", "alpha.txt", "text/plain", 5, "2026-11-04T09:00:00.000+0000"),
  ];
}
const attachmentSortPixel = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="),
  (char) => char.charCodeAt(0),
);
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
    localStorage.setItem("betterjira-issue-tabs", JSON.stringify({ state: { workspaces: { [id]: { keys, pinned: [keys[1]] } } }, version: 0 }));
  }
}
if (scenario === "tabs-legacy" && !localStorage.getItem("betterjira-issue-tabs"))
  localStorage.setItem("betterjira-issue-tabs", JSON.stringify({ state: { keys: ["DEMO-3", "DEMO-1", "DEMO-2"], pinned: ["DEMO-1"] }, version: 0 }));
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
if (scmScenario === "scm-checks")
  scmGithub["qa/design-system"].OPEN.push(
    scmGraphPullRequest("qa/design-system", 14, "Icons ohne Prüfdaten", "OPEN", 12, {
      commits: { nodes: [{ commit: { statusCheckRollup: null } }] },
    }),
    scmGraphPullRequest("qa/design-system", 15, "Fokusrahmen schärfen", "OPEN", 30, {
      commits: { nodes: [{ commit: { statusCheckRollup: { state: "QA_UNBEKANNT" } } }] },
    }),
    scmGraphPullRequest("qa/design-system", 16, "Changelog ergänzen", "OPEN", 40, { commits: { nodes: [] } }),
  );
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
const createProjects = [
  project,
  { ...project, id: "2", key: "OPS", name: "Betrieb" },
  { ...project, id: "3", key: "LOCK", name: "Archiv ohne Rechte" },
];
const metaField = (fieldId, name, schema, extra = {}) => ({ fieldId, key: fieldId, name, required: true, schema, operations: ["set"], ...extra });
const baseFields = [
  metaField("summary", "Zusammenfassung", { type: "string", system: "summary" }),
  metaField("issuetype", "Vorgangstyp", { type: "issuetype", system: "issuetype" }),
  metaField("project", "Projekt", { type: "project", system: "project" }),
  metaField("reporter", "Melder", { type: "user", system: "reporter" }, { hasDefaultValue: true }),
];
const createMeta = {
  1: {
    types: [
      { id: "10001", name: "Aufgabe", subtask: false, iconUrl: "/logo.svg" },
      { id: "10002", name: "Fehler", subtask: false, iconUrl: "/logo.svg" },
      { id: "10003", name: "Unteraufgabe", subtask: true, iconUrl: "/logo.svg" },
    ],
    fields: {
      10001: [
        ...baseFields,
        metaField("description", "Beschreibung", { type: "string", system: "description" }, { required: false }),
        metaField("priority", "Priorität", { type: "priority", system: "priority" }, {
          allowedValues: [{ id: "2", name: "Hoch" }, { id: "3", name: "Mittel" }],
        }),
        metaField("customfield_kunde", "Kunde", { type: "string", custom: "com.atlassian.jira.plugin.system.customfieldtypes:textfield" }),
      ],
      10002: [
        ...baseFields,
        metaField("description", "Beschreibung", { type: "string", system: "description" }, { required: false }),
        metaField("customfield_umgebung", "Umgebung", { type: "option", custom: "com.atlassian.jira.plugin.system.customfieldtypes:select" }, {
          allowedValues: [{ id: "e1", value: "Produktion" }, { id: "e2", value: "Test" }],
        }),
      ],
    },
  },
  2: {
    types: [{ id: "20001", name: "Störung", subtask: false, iconUrl: "/logo.svg" }],
    fields: {
      20001: [
        ...baseFields,
        metaField("customfield_team", "Team", { type: "team", custom: "com.atlassian.teams:rm-teams-custom-field-team" }),
      ],
    },
  },
};
const qaFilter = (id, name, owner, favourite, account = "qa-user") => ({
  id,
  name,
  jql: "project = DEMO ORDER BY updated DESC",
  favourite,
  owner: { accountId: owner, displayName: owner },
  account,
});
const qaFilters =
  scenario === "filters"
    ? [
        qaFilter("101", "Offene Bugs Team", "qa-user", true),
        qaFilter("102", "Sprint-Review Vorbereitung", "qa-user", false),
        qaFilter("103", "Rollouts diese Woche", "qa-user", true),
        qaFilter("104", "Support-Eskalationen", "qa-colleague", true),
        qaFilter("105", "Meine Rückfragen", "qa-user", false),
        qaFilter("106", "Release 2026.11 Abnahme", "qa-user", false),
        qaFilter("107", "Kundenfeedback Q4", "qa-user", false),
        qaFilter("201", "Backlog des Kollegen", "qa-colleague", true, "qa-colleague"),
      ]
    : [];
const visibleQaFilters = () =>
  window.__qa.filters.filter((filter) => (filter.account ?? accountId) === accountId && (filter.owner.accountId === accountId || filter.favourite));
const callbacks = new Map();
const linkTypes = {
  blocks: { id: "10000", name: "Blocks", inward: "is blocked by", outward: "blocks" },
  relates: { id: "10003", name: "Relates", inward: "relates to", outward: "relates to" },
};
const linkedRef = (key) => {
  const target = issues.find((entry) => entry.key === key);
  return {
    id: target?.id ?? key,
    key,
    fields: target && { summary: target.fields.summary, status: target.fields.status, issuetype: target.fields.issuetype },
  };
};
const issueLinks = {
  get "DEMO-1"() {
    return [
      { id: "l1", type: linkTypes.blocks, outwardIssue: linkedRef("DEMO-2") },
      { id: "l1", type: linkTypes.blocks, outwardIssue: linkedRef("DEMO-2") },
      { id: "l2", type: linkTypes.blocks, inwardIssue: linkedRef("DEMO-3") },
      { id: "l3", type: linkTypes.relates, inwardIssue: linkedRef("DEMO-3") },
      { id: "l4", type: linkTypes.relates, outwardIssue: { id: "900", key: "OPS-7" } },
      { id: "l5", type: linkTypes.relates },
    ];
  },
  get "DEMO-2"() {
    return [{ id: "l1", type: linkTypes.blocks, inwardIssue: linkedRef("DEMO-1") }];
  },
  get "DEMO-3"() {
    return [
      { id: "l2", type: linkTypes.blocks, outwardIssue: linkedRef("DEMO-1") },
      { id: "l3", type: linkTypes.relates, outwardIssue: linkedRef("DEMO-1") },
    ];
  },
};
const remoteLinks = {
  "DEMO-1": [
    {
      id: 10000,
      globalId: "appId=qa&pageId=1",
      application: { type: "com.atlassian.confluence", name: "Confluence" },
      relationship: "Wiki-Seite",
      object: {
        url: "https://example.atlassian.net/wiki/spaces/QA/pages/1",
        title: "Übergabe-Checkliste für das Release",
        summary: "Lokale Testseite: Ablauf, Verantwortliche und Rückfallplan.",
        icon: { url16x16: "https://example.atlassian.net/wiki/icon.png" },
      },
    },
    {
      id: 10001,
      relationship: "Spezifikation",
      object: {
        url: "https://specs.example.test/editor/tastatur-und-fokusfuehrung-im-mehrzeiligen-editor-mit-sehr-langem-pfad",
        title: "Tastaturbedienung im Editor: vollständige Spezifikation mit allen Sonderfällen für Fokus, Auswahl und Rückgängig",
        summary: "Sehr lange Beschreibung zum Testen des Umbruchs: <b>kein HTML</b> wird ausgeführt, Inhalte erscheinen als Text.",
        status: { resolved: true },
      },
    },
    { id: 10002, relationship: "Skript", object: { url: "javascript:alert(1)", title: "Ungültiges Protokoll" } },
    { id: 10003, object: { title: "Ziel fehlt" } },
    { id: 10004, object: { url: "https://qa:geheim@intranet.example.test/doc", title: "Ziel mit Zugangsdaten" } },
    { id: 10005 },
  ],
};
const listeners = new Map();
let listenerId = 0;
let callbackId = 0;
const requests = new Map();
let nextId = 0;
if (scenario === "rollout-search" && localStorage.getItem("betterjira:calendar:rollouts:v1") === null) {
  const rollout = (index, title, start, end, notes, keys) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    title,
    start,
    end,
    notes,
    issues: keys.map((key) => ({ key, summary: `QA-Testticket ${key}` })),
    siteUrl: "https://example.atlassian.net",
    reminderMinutes: 15,
    outlookEventId: null,
    outlookAccountId: null,
    outlookWebLink: null,
  });
  const hotfixes = Array.from({ length: 10 }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return rollout(index + 10, `Hotfix-Release 1.0.${index + 1}`, `2026-10-${day}T08:00:00.000Z`, `2026-10-${day}T09:00:00.000Z`, "", []);
  });
  localStorage.setItem(
    "betterjira:calendar:rollouts:v1",
    JSON.stringify([
      rollout(1, "Produktion Release 2.4", "2026-11-06T13:00:00.000Z", "2026-11-06T14:00:00.000Z", "Monitoring (Grafana) beobachten", ["DEMO-1"]),
      rollout(2, "Datenbank Migration", "2026-12-03T08:00:00.000Z", "2026-12-03T09:00:00.000Z", "Backup vorher prüfen", ["OPS-7"]),
      rollout(3, "Wartungsfenster [intern] 50%", "2026-11-20T08:00:00.000Z", "2026-11-20T09:00:00.000Z", "", []),
      ...hotfixes,
    ]),
  );
}
if (scenario === "rollout-duplicate" && localStorage.getItem("betterjira:calendar:rollouts:v1") === null) {
  localStorage.setItem("betterjira:calendar:outlook:v1", "ABC123");
  localStorage.setItem(
    "betterjira:calendar:rollouts:v1",
    JSON.stringify([
      {
        id: "00000000-0000-4000-8000-000000000101",
        title: "Produktion Release 2.4",
        start: "2026-11-06T13:00:00.000Z",
        end: "2026-11-06T14:30:00.000Z",
        notes: "Monitoring beobachten\nRollback vorbereiten",
        issues: [{ key: "DEMO-1", summary: "QA-Testticket DEMO-1" }],
        siteUrl: "https://example.atlassian.net",
        reminderMinutes: 60,
        outlookEventId: "DUP-OUTLOOK-1",
        outlookAccountId: "ABC123",
        outlookWebLink: "https://outlook.example.invalid/DUP-OUTLOOK-1",
      },
      {
        id: "00000000-0000-4000-8000-000000000102",
        title: "Partner-Rollout",
        start: "2026-11-06T15:00:00.000Z",
        end: "2026-11-06T16:00:00.000Z",
        notes: "Freigabe beim Partner einholen",
        issues: [{ key: "EXT-4", summary: "QA-Testticket der fremden Site" }],
        siteUrl: "https://andere-firma.example.atlassian.net",
        reminderMinutes: 1440,
        outlookEventId: null,
        outlookAccountId: null,
        outlookWebLink: null,
      },
    ]),
  );
}
window.__qa = { reads: [], writes: [], issueReads: [], failNextWrite: false, delayMs: 0, issues, wiki, briefing, briefingFailure: false, searches: [], searchDelayMs: 0, failSearch: false, emptySearch: false, sessionFailure: scenario === "session-error", sessionDelayMs: scenario === "session-slow" ? 1500 : 0, filters: qaFilters, filterRequests: 0, failFilters: new URLSearchParams(location.search).get("fail") === "filters", commands: [], metaDelay: {}, createFailure: null, opened: [], myselfDelayMs: window.__qaMyselfDelayMs ?? 0, failMyself: window.__qaFailMyself ?? false, myselfCalls: 0 };
window.__qa.filters = /^\/filter\/(100|200)/.test(new URLSearchParams(location.search).get("route") ?? "") ? [
  { id: "100", name: "Offene Testtickets", jql: "project = DEMO AND statusCategory != Done ORDER BY updated DESC", favourite: true, owner: author },
  { id: "200", name: "Team-Rückstand", jql: "project = DEMO ORDER BY created DESC", favourite: false, owner: author },
] : qaFilters;
window.__qa.filterReads = [];
window.__qa.commentPageReads = [];
window.__qa.commentDetailLimit = scenario === "comment-pages" ? 2 : undefined;
window.__qa.notification = { permission: "denied", answer: "granted", checkDelayMs: 0, failCheck: false, requestDelayMs: 0, failRequest: false, checks: 0, requests: 0, sent: [], ...window.__qaNotificationInit };
window.Notification = class QaNotification {
  static get permission() {
    return "default";
  }
  static async requestPermission() {
    const state = window.__qa.notification;
    state.requests++;
    if (state.requestDelayMs) await new Promise((resolve) => setTimeout(resolve, state.requestDelayMs));
    if (state.failRequest) throw new Error("Test: Systemdialog nicht verfügbar");
    state.permission = state.answer;
    return state.answer;
  }
  constructor(title, options = {}) {
    window.__qa.notification.sent.push({ title, body: options.body });
  }
};
window.__qa.outlook = {
  calls: [],
  failNext: false,
  account: { id: "ABC123", displayName: "Lokaler Outlook-Testkalender", email: "outlook@example.com" },
  events: [{ id: "AAAA", title: "Externer Outlook-Termin", start: "2026-11-06T10:00:00.000Z", end: "2026-11-06T11:00:00.000Z", webLink: "", isAllDay: false }],
};
if (scenario === "rollout-duplicate")
  window.__qa.outlook.events.push({ id: "DUP-OUTLOOK-1", rolloutId: "00000000-0000-4000-8000-000000000101", title: "Produktion Release 2.4", start: "2026-11-06T13:00:00.000Z", end: "2026-11-06T14:30:00.000Z", webLink: "", isAllDay: false });
window.__qaUpdates = {
  installed: [],
  restarts: 0,
  releases: [
    { tag_name: "v0.7.0", published_at: "2026-11-06T18:14:30Z", draft: false, prerelease: false },
    { tag_name: "v0.6.0", published_at: "2026-11-06T17:18:31Z", draft: false, prerelease: false },
    { tag_name: "v0.5.0", published_at: "2026-11-06T12:49:31Z", draft: false, prerelease: false },
  ],
};
const historyPeople = {
  alex: author,
  sam: { accountId: "qa-sam", displayName: "Sam Muster", avatarUrls: author.avatarUrls },
  former: { accountId: "qa-former", displayName: "Ehemaliger Nutzer", active: false },
};
const historyDay = (index) => new Date(Date.UTC(2026, 8, 1 + index, 8 + (index % 9), 15)).toISOString();
const historyItem = (field, fromString, toString, extra = {}) => ({ field, fieldtype: "jira", fromString, toString, ...extra });
const historyFor = (count) =>
  Array.from({ length: count }, (_, index) => ({
    id: String(10001 + index),
    created: historyDay(index),
    author: index % 3 === 0 ? historyPeople.sam : historyPeople.alex,
    items: [
      index % 2 === 0
        ? historyItem("status", index % 4 === 0 ? "Zu erledigen" : "In Arbeit", index % 4 === 0 ? "In Arbeit" : "Review", { from: "1", to: "3" })
        : historyItem("priority", "Mittel", "Hoch", { from: "3", to: "2" }),
    ],
  }));
const history = { "DEMO-1": historyFor(45), "DEMO-2": [], "DEMO-3": historyFor(3) };
history["DEMO-1"].push(
  {
    id: "10046",
    created: "2026-11-01T09:30:00.000Z",
    items: [historyItem("labels", null, "Barrierefreiheit"), { field: "customfield_10099", fieldtype: "custom", from: "10044", to: "10045" }],
  },
  {
    id: "10047",
    created: "2026-11-02T14:05:00.000Z",
    author: historyPeople.former,
    items: [
      historyItem(
        "description",
        "Erste Fassung der Anforderungen.",
        Array.from({ length: 8 }, (_, line) => `Zeile ${line + 1}: <img src=x onerror="window.__qaHistoryXss=true"> Die Beschreibung wurde umfassend überarbeitet.`).join("\n"),
      ),
      { field: "WorklogId", fieldtype: "jira", to: "20077", toString: "20077" },
    ],
  },
  {
    id: "10048",
    created: "2026-11-04T09:45:00.000Z",
    author: historyPeople.sam,
    items: [
      historyItem("status", "Review", "In Arbeit", { from: "12", to: "3" }),
      historyItem("assignee", "Alex Beispiel", "Sam Muster", { from: "qa-user", to: "qa-sam" }),
      historyItem("priority", "Mittel", "Hoch", { from: "3", to: "2" }),
      historyItem("timeestimate", "14400", "5400"),
    ],
  },
);
window.__qaHistory = { reads: [], history };
const respondHistory = async (key, url) => {
  const startAt = Number(url.searchParams.get("startAt") ?? 0);
  const maxResults = Number(url.searchParams.get("maxResults") ?? 100);
  window.__qaHistory.reads.push({ key, startAt, maxResults, account: accountId });
  const rule = window.__qaHistoryRule?.(key, startAt, accountId) ?? {};
  if (rule.delayMs) await new Promise((resolve) => setTimeout(resolve, rule.delayMs));
  if (rule.status) return { status: rule.status, body: rule.html ? `<html><body>Fehler ${rule.status}</body></html>` : { errorMessages: [`Test: Jira antwortet mit ${rule.status}`] } };
  const all = rule.values ?? (key in history ? history[key] : undefined);
  if (!all) return { status: 404, body: { errorMessages: ["Issue does not exist or you do not have permission to see it."] } };
  const values = all.slice(startAt, startAt + Math.min(maxResults, rule.pageSize ?? maxResults));
  return { body: { startAt, maxResults, total: all.length, isLast: startAt + values.length >= all.length, values } };
};
const respond = async (request) => {
  const url = new URL(request.url);
  if (url.hostname === "api.github.com") return { body: window.__qaUpdates.releases };
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
    const uploadTarget = path.match(/^\/issue\/([^/]+)\/attachments$/);
    if (uploadTarget) {
      const target = issues.find((issue) => issue.key === uploadTarget[1]);
      const text = new TextDecoder().decode(new Uint8Array(request.data ?? []));
      const names = [...text.matchAll(/filename="([^"]*)"/g)].map((match) => match[1]);
      const added = names.map((filename) =>
        attachmentSortFixture(`qa-upload-${++nextId}`, filename, "text/plain", 1, new Date().toISOString()),
      );
      target?.fields.attachment.push(...added);
      window.__qa.writes.push({ path, method: request.method, input: { files: names } });
      return { body: added };
    }
    const input = request.data ? JSON.parse(new TextDecoder().decode(new Uint8Array(request.data))) : {};
    if (path === "/issue" && window.__qa.createFailure) {
      const failure = window.__qa.createFailure;
      window.__qa.createFailure = null;
      window.__qa.writes.push({ path, method: request.method, input, failed: failure.status });
      return failure;
    }
    window.__qa.writes.push({ path, method: request.method, input });
    if (path === "/issue" && request.method === "POST") {
      const target = createProjects.find((entry) => entry.id === input.fields.project.id) ?? project;
      const key = `${target.key}-${issues.length + 1}`;
      const id = String(10000 + issues.length + 1);
      issues.push({
        ...issues[0],
        id,
        key,
        fields: {
          ...issues[0].fields,
          summary: input.fields.summary,
          project: target,
          description: input.fields.description ?? null,
          comment: { total: 0, comments: [] },
          worklog: { total: 0, worklogs: [] },
        },
      });
      return { status: 201, body: { id, key, self: `https://example.atlassian.net/rest/api/3/issue/${id}` } };
    }
    const favourite = qaFilters.find((filter) => path === `/filter/${filter.id}/favourite`);
    if (favourite) favourite.favourite = request.method === "PUT";
    if (scenario === "filters" && /^\/filter(?:\/[^/]+)?$/.test(path) && window.__qaHoldFilterWrite) {
      window.__qaFilterWriteWaiting = true;
      await new Promise((resolve) => {
        window.__qaReleaseFilterWrite = () => {
          window.__qaHoldFilterWrite = false;
          window.__qaFilterWriteWaiting = false;
          window.__qaReleaseFilterWrite = undefined;
          resolve();
        };
      });
    }
    const filter = window.__qa.filters.find((entry) => path === `/filter/${entry.id}`);
    if (scenario === "filters" && path === "/filter" && request.method === "POST") {
      const created = { ...window.__qa.filters[0], ...input, id: String(1000 + nextId++), favourite: false };
      window.__qa.filters.push(created);
      return { body: created };
    }
    if (scenario === "filters" && filter && request.method === "DELETE") {
      window.__qa.filters = window.__qa.filters.filter((entry) => entry.id !== filter.id);
      return { body: {} };
    }
    if (filter && request.method === "PUT") return { body: Object.assign(filter, input) };
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
  window.__qaReads?.push(path);
  window.__qa.reads.push(path);
  if (path === "/myself") {
    if (window.__qaMyselfGate) await window.__qaMyselfGate;
    window.__qa.myselfCalls++;
    if (window.__qa.myselfDelayMs) await new Promise((resolve) => setTimeout(resolve, window.__qa.myselfDelayMs));
    if (window.__qa.failMyself) return { status: 503, body: { errorMessages: ["Test: Jira vorübergehend nicht erreichbar"] } };
    const rule = window.__qaMyselfRule?.() ?? {};
    if (rule.delayMs) await new Promise((resolve) => setTimeout(resolve, rule.delayMs));
    if (rule.status) return { status: rule.status, body: { errorMessages: [`Test: Jira antwortet mit ${rule.status}`] } };
    return { body: { ...author, accountId } };
  }
  if (path.startsWith("/project/search")) {
    if (window.__qaProjectFailure) return { status: 503, body: { errorMessages: ["Test: Projekte konnten nicht geladen werden"] } };
    const rule = window.__qaProjectRule?.() ?? {};
    if (rule.delayMs) await new Promise((resolve) => setTimeout(resolve, rule.delayMs));
    if (rule.status) return { status: rule.status, body: { errorMessages: [`Test: Jira antwortet mit ${rule.status}`] } };
    return { body: { isLast: true, values: rule.values ?? window.__qaProjects ?? (scenario === "create" ? createProjects : projects) } };
  }
  if (path === "/mypermissions") {
    const allowed = url.searchParams.get("projectId") !== "3";
    return { body: { permissions: { CREATE_ISSUES: { key: "CREATE_ISSUES", havePermission: allowed } } } };
  }
  const createMetaPath = /^\/issue\/createmeta\/([^/]+)\/issuetypes(?:\/([^/]+))?$/.exec(path);
  if (createMetaPath) {
    const [, projectId, typeId] = createMetaPath;
    const delay = window.__qa.metaDelay[projectId];
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    const meta = createMeta[projectId] ?? { types: [], fields: {} };
    if (!typeId) return { body: { startAt: 0, maxResults: 100, total: meta.types.length, issueTypes: meta.types } };
    const fields = meta.fields[typeId] ?? [];
    return { body: { startAt: 0, maxResults: 100, total: fields.length, fields } };
  }

  if (path.startsWith("/filter/my")) {
    window.__qa.filterRequests++;
    if (window.__qa.failFilters) return { status: 503, body: { errorMessages: ["Test: Filter vorübergehend nicht erreichbar"] } };
    return { body: visibleQaFilters() };
  }
  const filterId = path.match(/^\/filter\/([^/]+)$/)?.[1];
  if (filterId) {
    window.__qa.filterReads.push(filterId);
    const rule = window.__qaFilterRule?.(filterId) ?? {};
    if (rule.delayMs) await new Promise((resolve) => setTimeout(resolve, rule.delayMs));
    if (rule.status) return { status: rule.status, body: { errorMessages: [`Test: Jira antwortet mit ${rule.status}`] } };
    const filter = window.__qa.filters.find((entry) => entry.id === filterId);
    if (filter) return { body: filter };
  }
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
  const historyMatch = path.match(/^\/issue\/([^/]+)\/changelog$/);
  if (historyMatch) return respondHistory(decodeURIComponent(historyMatch[1]), url);
  if (path.startsWith("/search/jql")) {
    const qa = window.__qa;
    qa.searches.push(url.searchParams.get("jql"));
    const rule = window.__qaSearchRule?.(url.searchParams.get("jql") ?? "", url.searchParams.get("nextPageToken")) ?? {};
    const delayMs = rule.delayMs ?? qa.searchDelayMs;
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    if (rule.status) return { status: rule.status, headers: rule.headers, body: { errorMessages: [`Test: Jira antwortet mit ${rule.status}`] } };
    if (rule.issues) return { body: { issues: rule.issues, isLast: true } };
    if (qa.failSearch) return { status: 400, body: { errorMessages: ["Test: Abfrage nicht möglich"] } };
    const found = rule.keys ? issues.filter((issue) => rule.keys.includes(issue.key)) : issues;
    return { body: { issues: qa.emptySearch ? [] : found, isLast: !rule.nextPageToken, nextPageToken: rule.nextPageToken } };
  }
  if (path.startsWith("/board")) {
    window.__qa.boardReads = [...(window.__qa.boardReads ?? []), path + url.search];
    const rule = window.__qaBoardRule?.(path) ?? {};
    if (rule.delayMs) await new Promise((resolve) => setTimeout(resolve, rule.delayMs));
    if (rule.status) return { status: rule.status, body: { errorMessages: [`Test: Jira antwortet mit ${rule.status}`] } };
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
  if (scenario === "board" && /^\/board\/\d+\/sprint/.test(path))
    return { body: { isLast: true, values: [{ id: 5, name: "Sprint 5", state: "active", boardId: 1 }] } };
  if (scenario === "board" && path.startsWith("/board"))
    return { body: { values: [{ id: 1, name: "Team-Board", type: window.__qaBoardType ?? "kanban", location: { projectKey: "DEMO" } }] } };
  if (path.startsWith("/board")) return { body: { values: [] } };
  if (path.endsWith("/transitions")) return { body: { transitions } };
  if (path.startsWith("/issue/")) window.__qa.issueReads.push(`${path}?fields=${url.searchParams.get("fields") ?? ""}`);

  const remoteLinkPath = path.match(/^\/issue\/([^/]+)\/remotelink$/);
  if (remoteLinkPath) {
    const rule = window.__qaRemoteLinksRule?.(remoteLinkPath[1]) ?? {};
    if (rule.delayMs) await new Promise((resolve) => setTimeout(resolve, rule.delayMs));
    if (rule.status) return { status: rule.status, body: { errorMessages: [`Test: Jira antwortet mit ${rule.status}`] } };
    return { body: rule.links ?? remoteLinks[remoteLinkPath[1]] ?? [] };
  }

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
  const commentPath = path.match(/^\/issue\/([^/]+)\/comment$/);
  if (commentPath) {
    const target = issues.find((issue) => issue.id === commentPath[1] || issue.key === commentPath[1]);
    const key = target?.key ?? commentPath[1];
    const startAt = Number(url.searchParams.get("startAt") ?? 0);
    const maxResults = Number(url.searchParams.get("maxResults") ?? 100);
    window.__qa.commentPageReads.push({ key, startAt, maxResults, orderBy: url.searchParams.get("orderBy") });
    const rule = window.__qaCommentPagesRule?.(key, startAt) ?? {};
    if (rule.delayMs) await new Promise((resolve) => setTimeout(resolve, rule.delayMs));
    if (rule.status) return { status: rule.status, body: { errorMessages: [`Test: Jira antwortet mit ${rule.status}`] } };
    if (!target) return { status: 404, body: { errorMessages: [`Test: ${key} nicht gefunden`] } };
    const all = sortedComments(target);
    const from = rule.startAt ?? startAt;
    const size = Math.min(rule.pageSize ?? maxResults, maxResults);
    const total = rule.total === null ? undefined : (rule.total ?? all.length);
    return { body: { startAt: from, maxResults: rule.maxResults ?? size, total, comments: rule.omitComments ? undefined : (rule.comments ?? all.slice(from, from + size)) } };
  }
  const issue = issues.find((issue) => path === `/issue/${issue.key}`);
  if (issue && url.searchParams.get("fields") === "summary") {
    const stats = (window.__qaTabTitles ??= { calls: [], open: 0, peak: 0 });
    const rule = window.__qaTabTitleRule?.(issue.key) ?? {};
    stats.calls.push(issue.key);
    stats.open++;
    stats.peak = Math.max(stats.peak, stats.open);
    try {
      if (rule.delayMs) await new Promise((resolve) => setTimeout(resolve, rule.delayMs));
      if (rule.status) return { status: rule.status, body: { errorMessages: [`Test: Jira antwortet mit ${rule.status}`] } };
      return { body: { id: issue.id, key: issue.key, fields: { summary: rule.summary ?? issue.fields.summary } } };
    } finally {
      stats.open--;
    }
  }
  if (issue && url.searchParams.get("fields") === "issuelinks") {
    const rule = window.__qaIssueLinksRule?.(issue.key) ?? {};
    if (rule.delayMs) await new Promise((resolve) => setTimeout(resolve, rule.delayMs));
    if (rule.status) return { status: rule.status, body: { errorMessages: [`Test: Jira antwortet mit ${rule.status}`] } };
    return { body: { id: issue.id, key: issue.key, fields: { issuelinks: rule.issuelinks ?? issueLinks[issue.key] ?? [] } } };
  }
  if (issue && url.pathname.includes("/api/2/") && url.searchParams.get("fields") === "description")
    return { body: { fields: { description: wiki[issue.key] } } };
  if (issue && url.searchParams.get("fields") === "*all") {
    const rule = window.__qaIssueRule?.(issue.key) ?? {};
    if (rule.delayMs) await new Promise((resolve) => setTimeout(resolve, rule.delayMs));
    if (rule.status) return { status: rule.status, body: { errorMessages: [`Test: Jira antwortet mit ${rule.status}`] } };
    if (rule.summary) return { body: { ...issue, fields: { ...issue.fields, summary: rule.summary } } };
  }
  if (issue && window.__qa.commentDetailLimit !== undefined)
    return { body: { ...issue, fields: { ...issue.fields, comment: commentWindow(issue) } } };
  if (issue) return { body: issue };
  if (/^\/attachment\/(thumbnail|content)\/qa-att-/.test(path)) return { bytes: attachmentSortPixel, contentType: "image/png" };
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
    window.__qa.commands.push(command);
    if (command === "session_get" && scenario === "scm-offline") return null;
    if (command === "scm_gh_hosts" && scmScenario) return JSON.stringify(window.__qaScm.hosts);
    if (command === "scm_request" && scmScenario) return scmRespond(args);
    if (command === "plugin:opener|open_url" && scenario === "attachments") {
      (window.__qa.opened ??= []).push(args.url);
      return null;
    }
    if (command === "plugin:opener|open_url" && scmScenario) {
      window.__qaScm.opened.push(args.url);
      return null;
    }
    if (command === "plugin:opener|open_url") {
      window.__qa.opened.push(args.url);
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
        cloudId,
        siteUrl: window.__qaSiteUrl ?? "https://example.atlassian.net",
        siteName: "Lokale UI-Testdaten",
      });
    if (command === "oauth_login") throw "Test: Anmeldung abgebrochen";
    if (command === "oauth_cancel") return null;
    if (command === "plugin:opener|open_url") {
      window.__qa.opened.push(args.url);
      return null;
    }
    if (command === "scm_gh_hosts") return JSON.stringify(window.__qaGhHosts ?? []);
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
    if (command === "plugin:app|version") return "0.7.0";
    if (command === "plugin:updater|check") return null;
    if (command === "update_install_version") {
      window.__qaUpdates.installed.push(args.version);
      return null;
    }
    if (command === "plugin:process|restart") {
      window.__qaUpdates.restarts++;
      return null;
    }
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
        headers: [["content-type", result.contentType ?? "application/json"], ...Object.entries(result.headers ?? {})],
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
      return [...(entry.result.bytes ?? new TextEncoder().encode(JSON.stringify(entry.result.body ?? {}))), 0];
    }
    if (command.startsWith("plugin:http|fetch_cancel")) {
      requests.delete(args.rid);
      return;
    }
    if (command.startsWith("plugin:event|")) return;
    if (command === "plugin:notification|is_permission_granted") {
      const state = window.__qa.notification;
      state.checks++;
      if (state.checkDelayMs) await new Promise((resolve) => setTimeout(resolve, state.checkDelayMs));
      if (state.failCheck) throw "Test: Berechtigung nicht lesbar";
      return state.permission === "default" ? null : state.permission === "granted";
    }
    throw new Error(`Nicht simuliertes Tauri-Kommando: ${command}`);
  },
};
