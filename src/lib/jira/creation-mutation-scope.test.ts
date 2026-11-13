import { beforeEach, expect, it, vi } from "vitest";
import { Effect } from "effect";
import { createIssue } from "./create-issue";
import { createIssueLink, deleteIssueLink } from "./issue-link-actions";

const { http, invoke } = vi.hoisted(() => ({ http: vi.fn(), invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: http }));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

beforeEach(() => {
  http.mockReset();
  invoke.mockReset();
  invoke.mockResolvedValue(JSON.stringify({ accessToken: "qa", refreshToken: "qa", expiresAt: 9e12, cloudId: "test", siteUrl: "https://jira.test", siteName: "Test" }));
});

it("sendet Erstellung, Verknüpfung und Entfernen nicht unter einem gewechselten Konto", async () => {
  const scope = { cloudId: "test", isCurrent: () => false };
  await expect(Effect.runPromise(createIssue({ fields: { summary: "Nicht senden" } }, scope))).rejects.toMatchObject({ _tag: "JiraRequestScopeChanged" });
  await expect(Effect.runPromise(createIssueLink({ source: "DEMO-1", target: "DEMO-2", typeId: "1", direction: "outward" }, scope))).rejects.toMatchObject({ _tag: "JiraRequestScopeChanged" });
  await expect(Effect.runPromise(deleteIssueLink("link-1", scope))).rejects.toMatchObject({ _tag: "JiraRequestScopeChanged" });
  expect(http).not.toHaveBeenCalled();
});

it("sendet keine Mutation an eine andere Jira-Instanz", async () => {
  await expect(Effect.runPromise(createIssue({ fields: { summary: "Nicht senden" } }, { cloudId: "other", isCurrent: () => true }))).rejects.toMatchObject({ _tag: "JiraRequestScopeChanged" });
  expect(http).not.toHaveBeenCalled();
});
