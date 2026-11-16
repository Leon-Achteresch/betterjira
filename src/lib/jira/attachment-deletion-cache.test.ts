import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";
import fixture from "../../../tests/jira/fixtures/attachment-selection.json";
import { acknowledgeAttachmentDeletion } from "./attachment-deletion-cache";
import { jiraKeys } from "./keys";

const client = new QueryClient();
const scope = { cloudId: "site", accountId: "me" };
const issue = { fields: { attachment: fixture.attachments }, retained: "unchanged" };
afterEach(() => client.clear());

describe("bestaetigte Anhangloeschung im Cache", () => {
  it("entfernt ausschliesslich bestaetigte IDs im urspruenglichen Konto und Ticket", () => {
    const key = jiraKeys.issueDetail("DEMO-1", scope);
    const other = jiraKeys.issueDetail("DEMO-1", { ...scope, accountId: "other" });
    const nextIssue = jiraKeys.issueDetail("DEMO-2", scope);
    for (const target of [key, other, nextIssue]) client.setQueryData(target, issue);
    acknowledgeAttachmentDeletion(client, "DEMO-1", scope, { attachment: fixture.attachments[0], status: "deleted", message: "ok" });
    expect(client.getQueryData(key)).toEqual({ ...issue, fields: { attachment: fixture.attachments.slice(1) } });
    expect(client.getQueryData(other)).toBe(issue);
    expect(client.getQueryData(nextIssue)).toBe(issue);
  });

  it.each(["failed", "uncertain", "not-attempted"] as const)("versteckt bei %s keine Datei", (status) => {
    const key = jiraKeys.issueDetail("DEMO-1", scope);
    client.setQueryData(key, issue);
    acknowledgeAttachmentDeletion(client, "DEMO-1", scope, { attachment: fixture.attachments[0], status, message: "not confirmed" });
    expect(client.getQueryData(key)).toBe(issue);
  });
});
