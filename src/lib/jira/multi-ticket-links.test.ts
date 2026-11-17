import { beforeEach, describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
const { http, invoke } = vi.hoisted(() => ({ http: vi.fn(), invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: http }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: vi.fn() }));
const blocks = {
  id: "1",
  name: "Blocks",
  inward: "is blocked by",
  outward: "blocks",
};
const session = {
  accessToken: "synthetic",
  refreshToken: "synthetic-refresh",
  expiresAt: 9e12,
  cloudId: "cloud",
  siteUrl: "https://example.atlassian.net",
  siteName: "Fixture",
};
let types = [blocks];
let links: unknown[] = [];
let alive = true;
let denied = "";
let changedId = "";
let writeRule: (target: string) => Promise<Response>;
let writes: {
  type: { id: string };
  inwardIssue: { key: string };
  outwardIssue: { key: string };
}[];
const scope = { cloudId: "cloud", isCurrent: () => alive };
const choice = (direction: "inward" | "outward" = "outward") => ({
  id: `1:${direction}`,
  type: blocks,
  direction,
  label: blocks[direction],
});
beforeEach(() => {
  vi.resetModules();
  http.mockReset();
  invoke.mockReset();
  types = [blocks];
  links = [];
  alive = true;
  denied = "";
  changedId = "";
  writes = [];
  writeRule = async () => new Response(null, { status: 201 });
  invoke.mockImplementation(async (command: string) =>
    command === "session_get" ? JSON.stringify(session) : null,
  );
  http.mockImplementation(async (raw: string, init: RequestInit) => {
    const url = new URL(raw);
    const path = url.pathname.split("/rest/api/3")[1];
    if (path === "/issueLinkType")
      return Response.json({ issueLinkTypes: types });
    if (path === "/mypermissions")
      return Response.json({
        permissions: {
          LINK_ISSUES: {
            havePermission: url.searchParams.get("issueKey") !== denied,
          },
        },
      });
    if (path.startsWith("/issue/")) {
      const key = path.split("/").at(-1)!;
      return Response.json({
        id: `${changedId === key ? "changed" : "id"}-${key}`,
        key,
        fields: {
          summary: `Titel ${key}`,
          issuelinks: key === "DEMO-1" ? links : [],
        },
      });
    }
    if (path === "/issueLink" && init.method === "POST") {
      const input = JSON.parse(String(init.body));
      writes.push(input);
      return writeRule(
        input.outwardIssue.key === "DEMO-1"
          ? input.inwardIssue.key
          : input.outwardIssue.key,
      );
    }
    throw new Error(`Unexpected synthetic route ${path}`);
  });
});

describe("explicit multi-ticket links through the real client", () => {
  it("normalizes a bounded explicit set and rejects duplicates, self, URLs and invalid keys before reads", async () => {
    const { parseMultiLinkTargets, previewMultiTicketLinks } =
      await import("./multi-ticket-links");
    expect(
      parseMultiLinkTargets("DEMO-1", " demo-3; DEMO-2\nOPS_1-20 "),
    ).toEqual({ targets: ["DEMO-2", "DEMO-3", "OPS_1-20"], error: null });
    for (const input of [
      "DEMO-1",
      "demo-2 DEMO-2",
      "https://example.atlassian.net/browse/DEMO-2",
      "A?-2",
      "ß-2",
      "A".repeat(256) + "-1",
      "X".repeat(6001),
      Array.from({ length: 21 }, (_, i) => `DEMO-${i + 2}`).join(","),
    ]) {
      expect(parseMultiLinkTargets("DEMO-1", input).error).toBeTruthy();
      await expect(
        Effect.runPromise(
          previewMultiTicketLinks("DEMO-1", input, choice(), scope),
        ),
      ).rejects.toMatchObject({ _tag: "InvalidMultiLink" });
    }
    expect(http).not.toHaveBeenCalled();
  });

  it.each(["outward", "inward"] as const)(
    "previews without writes and sends one actual %s payload per key",
    async (direction) => {
      const { previewMultiTicketLinks, applyMultiTicketLinks } =
        await import("./multi-ticket-links");
      const preview = await Effect.runPromise(
        previewMultiTicketLinks("DEMO-1", "demo-2", choice(direction), scope),
      );
      expect(writes).toEqual([]);
      expect(preview.rows).toEqual([
        {
          key: "DEMO-2",
          id: "id-DEMO-2",
          summary: "Titel DEMO-2",
          reason: undefined,
        },
      ]);
      const result = await Effect.runPromise(
        applyMultiTicketLinks(preview, scope, () => ({})),
      );
      expect(result[0].status).toBe("confirmed");
      expect(writes).toEqual([
        {
          type: { id: "1" },
          inwardIssue: { key: direction === "outward" ? "DEMO-1" : "DEMO-2" },
          outwardIssue: { key: direction === "outward" ? "DEMO-2" : "DEMO-1" },
        },
      ]);
      expect(
        http.mock.calls.every(([url]) => !String(url).includes("search")),
      ).toBe(true);
    },
  );

  it("holds known relations even when equal labels would merge them in the display mapper", async () => {
    links = [
      {
        id: "other",
        type: { ...blocks, id: "2" },
        outwardIssue: { key: "DEMO-2" },
      },
      { id: "actual", type: blocks, outwardIssue: { key: "DEMO-2" } },
    ];
    const { previewMultiTicketLinks, applyMultiTicketLinks } =
      await import("./multi-ticket-links");
    const preview = await Effect.runPromise(
      previewMultiTicketLinks("DEMO-1", "DEMO-2 DEMO-3", choice(), scope),
    );
    expect(preview.rows[0].reason).toContain("bereits");
    await Effect.runPromise(applyMultiTicketLinks(preview, scope, () => ({})));
    expect(writes).toHaveLength(1);
    expect(writes[0].outwardIssue.key).toBe("DEMO-3");
  });

  it("does not submit a target without permission and holds a changed source or type", async () => {
    const { previewMultiTicketLinks, applyMultiTicketLinks } =
      await import("./multi-ticket-links");
    denied = "DEMO-3";
    const preview = await Effect.runPromise(
      previewMultiTicketLinks("DEMO-1", "DEMO-2 DEMO-3", choice(), scope),
    );
    expect(preview.rows[1].reason).toContain("nicht erlaubt");
    changedId = "DEMO-1";
    expect(
      (
        await Effect.runPromise(
          applyMultiTicketLinks(preview, scope, () => ({})),
        )
      ).every((row) => row.status === "not-started"),
    ).toBe(true);
    changedId = "";
    types = [{ ...blocks, outward: "different meaning" }];
    expect(
      (
        await Effect.runPromise(
          applyMultiTicketLinks(preview, scope, () => ({})),
        )
      ).every((row) => row.status === "not-started"),
    ).toBe(true);
    expect(writes).toEqual([]);
  });

  it("rejects absent, empty and ambiguous type metadata", async () => {
    const { previewMultiTicketLinks } = await import("./multi-ticket-links");
    for (const catalog of [
      [],
      [{ ...blocks, id: "" }],
      [{ ...blocks, inward: "" }],
      [blocks, blocks],
    ]) {
      types = catalog;
      await expect(
        Effect.runPromise(
          previewMultiTicketLinks("DEMO-1", "DEMO-2", choice(), scope),
        ),
      ).rejects.toMatchObject({ _tag: "InvalidMultiLink" });
    }
    expect(writes).toEqual([]);
  });

  it("bounds workers at two, distinguishes rejection from uncertainty and never replays HTTP 401/503 or lost responses", async () => {
    const { previewMultiTicketLinks, applyMultiTicketLinks } =
      await import("./multi-ticket-links");
    const preview = await Effect.runPromise(
      previewMultiTicketLinks(
        "DEMO-1",
        "DEMO-2 DEMO-3 DEMO-4 DEMO-5 DEMO-6 DEMO-7",
        choice(),
        scope,
      ),
    );
    let active = 0;
    let peak = 0;
    writeRule = async (key) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active--;
      if (key === "DEMO-5") throw new Error("synthetic response lost");
      return new Response(null, {
        status:
          {
            "DEMO-2": 201,
            "DEMO-3": 403,
            "DEMO-4": 503,
            "DEMO-6": 401,
            "DEMO-7": 408,
          }[key] ?? 500,
      });
    };
    const results = await Effect.runPromise(
      applyMultiTicketLinks(preview, scope, () => ({})),
    );
    expect(peak).toBe(2);
    expect(writes).toHaveLength(6);
    expect(results.map((row) => row.status)).toEqual([
      "confirmed",
      "rejected",
      "uncertain",
      "uncertain",
      "rejected",
      "uncertain",
    ]);
    expect(
      invoke.mock.calls.some(([command]) => command === "session_set"),
    ).toBe(false);
  });

  it("stops later submissions but preserves acknowledgements of the two already dispatched writes", async () => {
    const { previewMultiTicketLinks, applyMultiTicketLinks } =
      await import("./multi-ticket-links");
    const preview = await Effect.runPromise(
      previewMultiTicketLinks(
        "DEMO-1",
        "DEMO-2 DEMO-3 DEMO-4 DEMO-5",
        choice(),
        scope,
      ),
    );
    let started = 0;
    writeRule = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return new Response(null, { status: 201 });
    };
    const results = await Effect.runPromise(
      applyMultiTicketLinks(
        preview,
        scope,
        () => ({}),
        (row) => {
          if (row.status === "sending" && ++started === 2) alive = false;
        },
      ),
    );
    expect(writes).toHaveLength(2);
    expect(results.map((row) => row.status)).toEqual([
      "confirmed",
      "confirmed",
      "not-started",
      "not-started",
    ]);
  });

  it("does not silently resubmit confirmed or uncertain targets even when the fresh server list is empty", async () => {
    const { previewMultiTicketLinks, applyMultiTicketLinks } =
      await import("./multi-ticket-links");
    const ledger = {
      "DEMO-2": "confirmed" as const,
      "DEMO-3": "uncertain" as const,
    };
    const preview = await Effect.runPromise(
      previewMultiTicketLinks(
        "DEMO-1",
        "DEMO-2 DEMO-3 DEMO-4",
        choice(),
        scope,
        ledger,
      ),
    );
    expect(preview.rows[0].reason).toContain("bereits bestätigt");
    expect(preview.rows[1].reason).toContain("unklar");
    const result = await Effect.runPromise(
      applyMultiTicketLinks(preview, scope, () => ledger),
    );
    expect(result.map((row) => row.status)).toEqual([
      "not-started",
      "not-started",
      "confirmed",
    ]);
    expect(writes).toHaveLength(1);
  });
});
