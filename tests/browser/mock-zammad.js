const scenario = new URLSearchParams(location.search).get("scenario") ?? "";
const enabled = scenario.startsWith("zammad");
const ticket = (id, number, title) => ({
  id,
  number,
  title,
  group_id: 1,
  state_id: 2,
  priority_id: 2,
  owner_id: 3,
  customer_id: 7,
  organization_id: 1,
  state: "open",
  priority: "2 normal",
  group: "Service Desk",
  owner: "alex@example.com",
  customer: "sam@example.com",
  organization: "common solutions",
  created_at: "2026-11-01T09:00:00Z",
  updated_at: "2026-11-09T09:00:00Z",
  pending_time: null,
  escalation_at: "2026-11-12T12:00:00Z",
  note: "",
  article_count: 2,
});
const state = (window.__qaZammad = {
  connection:
    enabled && scenario !== "zammad-unconnected"
      ? { baseUrl: "https://helpdesk.example.com" }
      : null,
  tickets: [
    ticket(41, "20043776", "Anmeldung am Kundenportal nicht möglich"),
    ticket(42, "20043777", "Berechtigungen für das Support-Team"),
  ],
  articles: [
    {
      id: 11,
      ticket_id: 41,
      from: "Sam Kunde <sam@example.com>",
      to: "support@example.com",
      subject: "Anmeldung schlägt fehl",
      body: '<p>Seit heute kann ich mich nicht mehr am <b>Kundenportal</b> anmelden.</p><img src="https://tracker.invalid/pixel"><script>parent.__xss=true</script>',
      content_type: "text/html",
      type: "email",
      sender: "Customer",
      created_by_id: 7,
      message_id: "customer-message@example.com",
      internal: false,
      created_at: "2026-11-09T09:00:00Z",
      attachments: [{ id: 6, filename: "fehler.txt", size: 42 }],
    },
    {
      id: 12,
      ticket_id: 41,
      from: "Alex Support",
      body: "Die Anmeldung wird gemeinsam mit dem Entwicklungsteam geprüft.",
      content_type: "text/plain",
      type: "note",
      internal: true,
      created_by_id: 3,
      sender: "Agent",
      created_at: "2026-11-09T09:15:00Z",
      attachments: [],
    },
  ],
  tags: ["kundenportal"],
  time: [
    {
      id: 1,
      ticket_id: 41,
      time_unit: "15.0",
      created_at: "2026-11-09T10:00:00Z",
    },
  ],
  links: [],
  requests: [],
  opened: [],
  denied: [],
  failNext: null,
  delay: 0,
});
const user = {
  id: 3,
  image: "aabbcc03",
  firstname: "Alex",
  lastname: "Support",
  email: "alex@example.com",
  active: true,
};
const customer = {
  id: 7,
  image: "aabbcc07",
  organization: "common solutions",
  firstname: "Sam",
  lastname: "Kunde",
  email: "sam@example.com",
  active: true,
};
const response = (body, status = 200) => ({
  status,
  body: body === null ? "" : JSON.stringify(body),
  data: null,
});
export async function zammadInvoke(command, args) {
  if (command === "zammad_connection_get") return state.connection;
  if (command === "zammad_connect") {
    if (args.token === "invalid") throw "Zammad-Token ist ungültig";
    state.connection = { baseUrl: args.baseUrl };
    return state.connection;
  }
  if (command === "zammad_disconnect") {
    state.connection = null;
    return null;
  }
  if (command !== "zammad_request")
    throw new Error(`Unbekanntes Kommando ${command}`);
  const { path, method } = args;
  const body = args.body ? JSON.parse(args.body) : null;
  state.requests.push({ path, method, body });
  if (state.delay)
    await new Promise((resolve) => setTimeout(resolve, state.delay));
  if (!state.connection) return response({ error: "Not connected" }, 401);
  if (state.failNext) {
    const status = state.failNext;
    state.failNext = null;
    return response({ error: "Mock error" }, status);
  }
  if (state.denied.some((prefix) => path.startsWith(prefix)))
    return response({}, 403);
  const url = new URL(path, "https://helpdesk.example.com");
  const route = url.pathname;
  if (route.startsWith("/users/image/")) {
    const image = await fetch(
      route.endsWith("07")
        ? "/tests/browser/avatars/customer.jpg"
        : "/tests/browser/avatars/agent.jpg",
    );
    return {
      status: 200,
      body: "",
      data: Array.from(new Uint8Array(await image.arrayBuffer())),
      content_type: "image/jpeg",
    };
  }
  if (/^\/users\/\d+$/.test(route))
    return response(route.endsWith("/7") ? customer : user);
  if (route === "/users/me") return response(user);
  if (route === "/users/search") return response([user, customer]);
  if (route === "/ticket_states")
    return response([
      { id: 1, name: "new", active: true },
      { id: 2, name: "open", active: true },
      { id: 4, name: "closed", active: true },
      { id: 6, name: "pending reminder", active: true },
    ]);
  if (route === "/ticket_priorities")
    return response([
      { id: 1, name: "1 low", active: true },
      { id: 2, name: "2 normal", active: true },
      { id: 3, name: "3 high", active: true },
    ]);
  if (route === "/groups")
    return response([
      { id: 1, name: "Service Desk", active: true },
      { id: 2, name: "Development", active: true },
    ]);
  if (route === "/tickets/search") {
    const query = url.searchParams.get("query") ?? "";
    const match = query.match(/number:(\d+)/);
    if (Number(url.searchParams.get("page")) > 1) return response([]);
    return response(
      match
        ? state.tickets.filter((row) => row.number === match[1])
        : state.tickets,
    );
  }
  if (route === "/tickets" && method === "POST") {
    const row = { ...ticket(43, "20043778", body.title), ...body };
    state.tickets.push(row);
    state.articles.push({
      id: 30,
      ticket_id: 43,
      ...body.article,
      content_type: "text/plain",
      from: "Alex Support",
      created_by_id: 3,
      sender: "Agent",
      created_at: "2026-11-09T11:00:00Z",
      attachments: [],
    });
    return response(row, 201);
  }
  const ticketId = route.match(/^\/tickets\/(\d+)$/)?.[1];
  if (ticketId) {
    const row = state.tickets.find((item) => item.id === Number(ticketId));
    if (!row) return response({}, 404);
    if (method === "PUT") {
      Object.assign(row, body);
      row.state = row.state_id === 4 ? "closed" : "open";
      row.priority = row.priority_id === 3 ? "3 high" : "2 normal";
      row.group = row.group_id === 2 ? "Development" : "Service Desk";
    }
    return response(row);
  }
  const articleTicketId = route.match(
    /^\/ticket_articles\/by_ticket\/(\d+)$/,
  )?.[1];
  if (articleTicketId)
    return response(
      state.articles.filter(
        (article) => article.ticket_id === Number(articleTicketId),
      ),
    );
  if (route === "/ticket_articles" && method === "POST") {
    const article = {
      ...body,
      id: state.articles.length + 100,
      from: "Alex Support",
      created_at: "2026-11-09T12:00:00Z",
      attachments: [],
    };
    state.articles.push(article);
    return response(article, 201);
  }
  if (route === "/tags") return response({ tags: state.tags });
  if (route === "/tags/add" && method === "POST") {
    state.tags = [...new Set([...state.tags, body.item])];
    return response(true, 201);
  }
  if (route === "/tags/remove" && method === "DELETE") {
    state.tags = state.tags.filter((tag) => tag !== body.item);
    return response(true, 201);
  }
  if (/\/time_accountings$/.test(route)) {
    if (method === "POST") {
      const entry = {
        id: state.time.length + 1,
        ticket_id: Number(route.split("/")[2]),
        ...body,
        created_at: "2026-11-09T12:00:00Z",
      };
      state.time.push(entry);
      return response(entry, 201);
    }
    return response(state.time);
  }
  if (route === "/links")
    return response({
      links: state.links,
      assets: {
        Ticket: Object.fromEntries(state.tickets.map((row) => [row.id, row])),
      },
    });
  if (route === "/links/add" && method === "POST") {
    const target = state.tickets.find(
      (row) => row.number === body.link_object_source_number,
    );
    if (!target) return response({}, 404);
    state.links.push({
      link_type: body.link_type,
      link_object: "Ticket",
      link_object_value: target.id,
    });
    return response({ id: 1 }, 201);
  }
  if (route === "/links/remove" && method === "DELETE") {
    state.links = [];
    return response({}, 201);
  }
  if (route.startsWith("/ticket_attachment/") && args.binary)
    return { status: 200, body: "", data: [72, 101, 108, 108, 111] };
  throw new Error(`Nicht gemockter Zammad-Endpunkt: ${method} ${path}`);
}
