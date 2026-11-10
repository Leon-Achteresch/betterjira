import { describe, expect, it } from "vitest";
import { jiraSessionStatus } from "./session-status";

describe("jira session status", () => {
  it("waits while the session is read", () => {
    expect(jiraSessionStatus({ hasSite: false, isError: false, isPending: true })).toBe("pending");
  });

  it("treats a missing session as signed out", () => {
    expect(jiraSessionStatus({ hasSite: false, isError: false, isPending: false })).toBe("unconnected");
  });

  it("treats a read failure as an error, not as signed out", () => {
    expect(jiraSessionStatus({ hasSite: false, isError: true, isPending: false })).toBe("error");
  });

  it("keeps a cached session when a refetch fails", () => {
    expect(jiraSessionStatus({ hasSite: true, isError: true, isPending: false })).toBe("connected");
  });
});
