import { describe, expect, it } from "vitest";
import { isRetryableRead, retryAfterMs } from "./request-policy";

describe("Jira Retry-After", () => {
  it("accepts seconds and HTTP dates, and ignores invalid or expired hints", () => {
    const now = Date.parse("2026-11-09T10:00:00Z");
    expect(retryAfterMs("2.5", now)).toBe(2500);
    expect(retryAfterMs("Mon, 09 Nov 2026 10:00:03 GMT", now)).toBe(3000);
    expect(retryAfterMs("-1", now)).toBe(0);
    expect(retryAfterMs("garbage", now)).toBe(0);
    expect(retryAfterMs(null, now)).toBe(0);
  });
  it("only retries safe reads including the read-only POST count endpoint", () => {
    expect(isRetryableRead("api/3/search/jql")).toBe(true);
    expect(isRetryableRead("api/3/search/approximate-count", "POST")).toBe(true);
    expect(isRetryableRead("api/3/issue/X-1", "PUT")).toBe(false);
    expect(isRetryableRead("api/3/issue/X-1/transitions", "POST")).toBe(false);
  });
});
