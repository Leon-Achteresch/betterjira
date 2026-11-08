import { describe, expect, it } from "vitest";
import { areaContent, areaJql, areaSubtitle, parseAreaSearch } from "./area-page";

describe("area search", () => {
  it("keeps existing board and sprint links", () => {
    expect(parseAreaSearch({ board: 12, sprint: 34 })).toEqual({ board: 12, sprint: 34 });
    expect(parseAreaSearch({ board: 12, sprint: "backlog" })).toEqual({ board: 12, sprint: "backlog" });
    expect(parseAreaSearch({ board: "12", sprint: "34" })).toEqual({ board: 12, sprint: 34 });
  });

  it("always returns both keys, so raw values cannot survive", () => {
    expect(parseAreaSearch({})).toStrictEqual({ board: undefined, sprint: undefined });
    expect(parseAreaSearch({ board: "x", sprint: 3 })).toStrictEqual({ board: undefined, sprint: undefined });
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "1e3", "12 OR 1=1", "", null, true, [1], { id: 1 }])(
    "rejects %j as board id",
    (board) => {
      expect(parseAreaSearch({ board }).board).toBeUndefined();
    },
  );

  it("drops unknown sprint values but keeps the board", () => {
    expect(parseAreaSearch({ board: 7, sprint: "openSprints()" })).toStrictEqual({ board: 7, sprint: undefined });
    expect(parseAreaSearch({ board: 7, sprint: "Backlog" })).toStrictEqual({ board: 7, sprint: undefined });
  });
});

describe("area jql", () => {
  it("quotes the project key", () => {
    expect(areaJql("DEMO")).toBe('project = "DEMO" ORDER BY updated DESC');
    expect(areaJql('A" OR project = "B')).toBe('project = "A\\" OR project = \\"B" ORDER BY updated DESC');
  });
});

describe("area content", () => {
  const boards = [{ id: 1 }, { id: 2 }];

  it("shows all issues without a board", () => {
    expect(areaContent({ boards: undefined, failed: true })).toEqual({ kind: "all" });
  });

  it("separates loading, initial failure and a board missing from the loaded list", () => {
    expect(areaContent({ boardId: 1, failed: false })).toEqual({ kind: "loading" });
    expect(areaContent({ boardId: 1, failed: true })).toEqual({ kind: "error" });
    expect(areaContent({ boardId: 9, boards, failed: false })).toEqual({ kind: "missing" });
  });

  it("keeps a loaded board when a refresh fails", () => {
    expect(areaContent({ boardId: 2, boards, failed: true })).toEqual({ kind: "board", board: { id: 2 } });
  });
});

describe("area subtitle", () => {
  it("names the board, or its id while the name is unknown", () => {
    expect(areaSubtitle("DEMO")).toBe("DEMO · Alle Vorgänge");
    expect(areaSubtitle("DEMO", 3, "Team-Board")).toBe("DEMO · Team-Board");
    expect(areaSubtitle("DEMO", 3)).toBe("DEMO · Board 3");
  });
});
