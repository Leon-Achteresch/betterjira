import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { issueQuery, jiraKeys } from "./queries";
import { withJiraQueryScope } from "./query-scope";

vi.mock("./client", async (original) => {
  const client = await original<typeof import("./client")>();
  const { Effect } = await import("effect");
  return { ...client, currentSite: Effect.succeed({ cloudId: "qa-cloud" }) };
});

const accountA = { cloudId: "qa-cloud", accountId: "account-a" };
const accountB = { cloudId: "qa-cloud", accountId: "account-b" };

describe("Ticketdetail-Scope", () => {
  it("übernimmt gecachte Daten desselben Schlüssels nicht für ein anderes Konto oder eine andere Instanz", () => {
    const client = new QueryClient();
    const own = issueQuery("DEMO-1", accountA, client).queryKey;
    client.setQueryData(own, { summary: "Nur Konto A" });
    expect(client.getQueryData(issueQuery("DEMO-1", accountB, client).queryKey)).toBeUndefined();
    expect(client.getQueryData(issueQuery("DEMO-1", { ...accountA, cloudId: "other-cloud" }, client).queryKey)).toBeUndefined();
    expect(client.getQueryData(own)).toEqual({ summary: "Nur Konto A" });
    client.clear();
  });

  it("erreicht alle Konto-Varianten weiter über die bestehende Ticket-Invalidierung", async () => {
    const client = new QueryClient();
    const keys = [accountA, accountB].map((scope) => issueQuery("DEMO-1", scope, client).queryKey);
    for (const key of keys) client.setQueryData(key, { summary: "Geladen" });
    await client.invalidateQueries({ queryKey: jiraKeys.issue("DEMO-1") });
    expect(keys.map((key) => client.getQueryState(key)?.isInvalidated)).toEqual([true, true]);
    client.clear();
  });

  it("verwirft Antworten, wenn sich das Konto während der Anfrage ändert", async () => {
    const client = new QueryClient();
    client.setQueryData(jiraKeys.site, { cloudId: accountA.cloudId });
    client.setQueryData(jiraKeys.myself, { accountId: accountA.accountId });
    const program = Effect.sync(() => {
      client.setQueryData(jiraKeys.myself, { accountId: accountB.accountId });
      return "Ticket von A";
    });
    await expect(Effect.runPromise(withJiraQueryScope(client, accountA, program))).rejects.toMatchObject({ _tag: "JiraQueryScopeChanged" });
    client.clear();
  });
});
