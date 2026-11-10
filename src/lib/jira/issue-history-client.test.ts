import { beforeEach, describe, expect, it, vi } from "vitest";
import { Effect, Schema } from "effect";

const { response, requests } = vi.hoisted(() => ({
  response: { total: 48, cap: 20, emptyAt: -1, wrongAt: -1 },
  requests: [] as { startAt: number; maxResults: number }[],
}));

vi.mock("./client", async () => {
  const actual = await vi.importActual<typeof import("./client")>("./client");
  return {
    ...actual,
    jira: (path: string, schema: Schema.Decoder<unknown>) => Effect.suspend(() => {
      const params = new URL(path, "https://jira.example").searchParams;
      const startAt = Number(params.get("startAt"));
      const maxResults = Number(params.get("maxResults"));
      requests.push({ startAt, maxResults });
      const count = startAt === response.emptyAt ? 0 : Math.max(0, Math.min(maxResults, response.cap, response.total - startAt));
      return Schema.decodeUnknownEffect(schema)({
        startAt: startAt === response.wrongAt ? startAt + 1 : startAt,
        total: response.total,
        values: Array.from({ length: count }, (_, offset) => ({ id: String(startAt + offset), items: [] })),
      });
    }),
  };
});

const { fetchIssueHistory, olderPageParam } = await import("./issue-history");

beforeEach(() => {
  Object.assign(response, { total: 48, cap: 20, emptyAt: -1, wrongAt: -1 });
  requests.length = 0;
});

describe("fetchIssueHistory", () => {
  it("füllt das neueste Fenster lückenlos bei kleineren Jira-Seiten", async () => {
    response.cap = 5;
    const page = await Effect.runPromise(fetchIssueHistory("DEMO-1", null));
    expect(page.entries.map((entry) => entry.id)).toEqual(Array.from({ length: 20 }, (_, index) => String(index + 28)));
    expect(requests.map((request) => request.startAt)).toEqual([0, 28, 33, 38, 43]);
    expect(olderPageParam([page])).toEqual({ startAt: 8, maxResults: 20 });
  });

  it("liest auch einen kleinen gesamten Verlauf vollständig", async () => {
    response.total = 13;
    response.cap = 4;
    const page = await Effect.runPromise(fetchIssueHistory("DEMO-1", null));
    expect(page.entries.map((entry) => entry.id)).toEqual(Array.from({ length: 13 }, (_, index) => String(index)));
    expect(requests.map((request) => request.startAt)).toEqual([0, 4, 8, 12]);
    expect(olderPageParam([page])).toBeUndefined();
  });

  it("füllt ältere Fenster bis zu ihrer oberen Grenze", async () => {
    response.cap = 3;
    const page = await Effect.runPromise(fetchIssueHistory("DEMO-1", { startAt: 8, maxResults: 20 }));
    expect(page.entries.map((entry) => entry.id)).toEqual(Array.from({ length: 20 }, (_, index) => String(index + 8)));
    expect(requests.map((request) => request.startAt)).toEqual([8, 11, 14, 17, 20, 23, 26]);
    expect(requests.at(-1)?.maxResults).toBe(2);
  });

  it("bleibt bei vollständigen kleinen Seiten bei einem Abruf", async () => {
    response.total = 13;
    expect((await Effect.runPromise(fetchIssueHistory("DEMO-1", null))).entries).toHaveLength(13);
    expect(requests).toHaveLength(1);
  });

  it.each(["emptyAt", "wrongAt"] as const)("bricht bei %s ab, statt eine Lücke als geladen zu behandeln", async (field) => {
    response.cap = 5;
    response[field] = 33;
    const failure = await Effect.runPromise(Effect.flip(fetchIssueHistory("DEMO-1", null)));
    expect(failure._tag).toBe("HistoryPagingError");
    expect(requests.map((request) => request.startAt)).toEqual([0, 28, 33]);
  });
});
