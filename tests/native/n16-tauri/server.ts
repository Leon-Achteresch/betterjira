type Credential = "A" | "B";
type HeldRead = { label: string; path: string; credential: Credential };

const firstPath = "/api/v1/ticket_articles/by_ticket/41?expand=true";
const otherPath = "/api/v1/ticket_articles/by_ticket/42?expand=true";
const identity = "/api/v1/users/me";
const holdPaths = { identity, ticket: firstPath, account: firstPath };

export const otherTitle = "Zweites Zammad-Ticket";

export function sourceCcFixture(
  ticket: Record<string, unknown>,
  source: Record<string, unknown>,
  author: Record<string, unknown>,
) {
  const good = {
    ...source,
    bcc: "hidden@example.test",
    cc: '"Team, Nord" <TEAM@example.test>, Keep@Example.test, keep@example.test, invalid, skip@example.test, manual-to@example.test',
  };
  const rows = [
    good,
    ...[
      { id: 12, name: "Ohne CC" },
      { id: 13, name: "Unklare CC", cc: ["array@example.test"] },
      { id: 14, name: "Ungültige CC", cc: "bad, invalid@@example.test" },
      {
        id: 15,
        name: "Interne Quelle",
        type: "note",
        internal: true,
        cc: "internal@example.test",
      },
    ].map(({ name, ...article }) => ({
      ...source,
      ...article,
      created_by_id: undefined,
      content_type: "text/plain",
      subject: name,
      from: `${name} <source-${article.id}@example.test>`,
      to: "unrelated@example.test",
      body: `${name} mit body-only@example.test im Artikel.`,
      message_id: `${article.id}@example.test`,
      attachments: [],
    })),
  ];
  const other = { ...ticket, id: 42, number: "20043777", title: otherTitle };
  const otherRows = [
    {
      ...source,
      id: 21,
      ticket_id: 42,
      cc: "other@example.test",
      subject: otherTitle,
      message_id: "21@example.test",
    },
  ];
  const requests: {
    method: string;
    path: string;
    credential: Credential | null;
  }[] = [];
  const sourceReads: {
    path: string;
    credential: Credential;
    status: number;
  }[] = [];
  const released: HeldRead[] = [];
  let armed: keyof typeof holdPaths | null = null;
  let held: (HeldRead & { release: () => void }) | null = null;
  let denySource = false;

  const state = () => ({
    requests,
    sourceReads,
    released,
    held: held && {
      label: held.label,
      path: held.path,
      credential: held.credential,
    },
    armed,
    denySource,
    writes: requests.filter(({ method }) => method !== "GET"),
  });

  const control = (operation: string, method: string) => {
    if (method !== "POST") return;
    if (
      operation === "hold/identity" ||
      operation === "hold/ticket" ||
      operation === "hold/account"
    ) {
      if (armed || held || denySource) return;
      armed =
        operation === "hold/identity"
          ? "identity"
          : operation === "hold/ticket"
            ? "ticket"
            : "account";
    } else if (operation === "release" && held) {
      held.release();
    } else if (operation === "deny-source" && !denySource && !armed && !held) {
      denySource = true;
    } else return;
    return new Response(null, { status: 204 });
  };

  const read = async (path: string, credential: Credential) => {
    let response: unknown;
    if (path === identity)
      response =
        credential === "A"
          ? author
          : { ...author, id: 8, firstname: "Anderes Konto" };
    else if (
      path === "/api/v1/users/8?expand=true" ||
      path === "/api/v1/users/8"
    )
      response = { ...author, id: 8, firstname: "Anderes Konto" };
    else if (path === "/api/v1/tickets/42?expand=true") response = other;
    else if (path === "/api/v1/tickets/42/time_accountings") response = [];
    else if (path === firstPath || path === otherPath) {
      const denied = denySource && path === firstPath;
      sourceReads.push({ path, credential, status: denied ? 403 : 200 });
      if (denied) {
        denySource = false;
        return Response.json({}, { status: 403 });
      }
      response = path === firstPath ? rows : otherRows;
    } else return;

    if (armed && holdPaths[armed] === path) {
      const event = { label: armed, path, credential };
      armed = null;
      await new Promise<void>((release) => {
        held = { ...event, release };
      });
      held = null;
      released.push(event);
      if (event.label !== "identity")
        response = [{ ...good, cc: `late-${event.label}@example.test` }];
    }
    return Response.json(response);
  };

  return { state, control, read, requests };
}
