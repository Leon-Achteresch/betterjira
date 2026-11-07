import { describe, expect, it } from "vitest";
import { JiraApiError, JiraAuthError, NotAuthenticated } from "./client";
import { shouldRetryQuery } from "./retry-policy";

const api = (status: number) => new JiraApiError({ status, body: "" });

describe("shouldRetryQuery", () => {
  it("wiederholt bei Drosselung nicht automatisch", () => {
    expect(shouldRetryQuery(0, api(429))).toBe(false);
    expect(shouldRetryQuery(0, new JiraApiError({ status: 429, body: "", retryAt: Date.now() + 1000 }))).toBe(false);
  });

  it("wiederholt Zeitüberschreitung, Serverfehler und Netzfehler höchstens zweimal", () => {
    for (const error of [api(408), api(500), api(503), new JiraAuthError({ message: "offline" }), new TypeError("fetch")]) {
      expect(shouldRetryQuery(0, error)).toBe(true);
      expect(shouldRetryQuery(1, error)).toBe(true);
      expect(shouldRetryQuery(2, error)).toBe(false);
    }
  });

  it("wiederholt dauerhafte Fehler und fehlende Anmeldung nicht", () => {
    expect(shouldRetryQuery(0, api(400))).toBe(false);
    expect(shouldRetryQuery(0, api(401))).toBe(false);
    expect(shouldRetryQuery(0, api(404))).toBe(false);
    expect(shouldRetryQuery(0, new NotAuthenticated())).toBe(false);
  });
});
