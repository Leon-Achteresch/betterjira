import { describe, expect, it } from "vitest";
import { boardScopes, otherScopes } from "./board-filters";

describe("board scopes", () => {
  const record = { "1": "a", "1:Done": "b", "12": "c", "12:Done": "d" };

  it("picks only the board and its columns", () => {
    expect(boardScopes(record, "1")).toEqual({ "1": "a", "1:Done": "b" });
  });

  it("keeps the other boards", () => {
    expect(otherScopes(record, "1")).toEqual({ "12": "c", "12:Done": "d" });
  });
});
