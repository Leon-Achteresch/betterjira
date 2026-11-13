import { describe, expect, it } from "vitest";
import { Effect } from "effect";
import { createIssueLink, linkChoices, linkInputError, linkPayload } from "./issue-link-actions";
import { summarizeIssueLinks } from "./issue-links";
import { createPayload, planFields } from "./create-issue-form";
import { createRouteSearch } from "./create-issue-parent";

const blocks = { id: "1", name: "Blocks", inward: "is blocked by", outward: "blocks" };
const relates = { id: "2", name: "Relates", inward: "relates to", outward: "relates to" };

describe("Beziehungen bearbeiten", () => {
  it("bietet beide Richtungen und symmetrische Beziehungen nur einmal", () => {
    expect(linkChoices([blocks, relates]).map(({ label }) => label)).toEqual(["blocks", "is blocked by", "relates to"]);
  });

  it("übersetzt die Perspektive des aktuellen Tickets in Jira inward/outward", () => {
    expect(linkPayload({ source: "A-1", target: "B-2", typeId: "1", direction: "outward" })).toEqual({ type: { id: "1" }, inwardIssue: { key: "A-1" }, outwardIssue: { key: "B-2" } });
    expect(linkPayload({ source: "A-1", target: "B-2", typeId: "1", direction: "inward" })).toEqual({ type: { id: "1" }, inwardIssue: { key: "B-2" }, outwardIssue: { key: "A-1" } });
  });

  it("verhindert Selbstbezug und vorhandene Beziehungen vor einem Schreibzugriff", async () => {
    const choices = linkChoices([blocks, relates]);
    const summary = summarizeIssueLinks([{ id: "l1", type: blocks, outwardIssue: { key: "B-2" } }, { id: "l2", type: relates, inwardIssue: { key: "B-3" } }]);
    expect(linkInputError("A-1", "A-1", choices[0], summary)).toMatch(/selbst/);
    expect(linkInputError("A-1", "B-2", choices[0], summary)).toMatch(/bereits/);
    expect(linkInputError("A-1", "B-2", choices[1], summary)).toBeUndefined();
    expect(linkInputError("A-1", "B-3", choices[2], summary)).toMatch(/bereits/);
    await expect(Effect.runPromise(createIssueLink({ source: "A-1", target: "A-1", typeId: "1", direction: "outward" }))).rejects.toMatchObject({ _tag: "InvalidIssueLink" });
  });
});

describe("Unteraufgaben erstellen", () => {
  it("akzeptiert nur Ticket-Schlüssel im Parent-Parameter", () => {
    expect(createRouteSearch({ parent: " demo-1 " })).toEqual({ parent: "DEMO-1" });
    for (const parent of ["https://evil.example/A-1", "../A-1", {}, "A-1?foo=bar"]) expect(createRouteSearch({ parent })).toEqual({});
  });

  it("behandelt Parent nur im Unteraufgabenkontext automatisch", () => {
    const fields = [{ fieldId: "parent", name: "Übergeordnet", required: true, schema: { type: "issuelink" } }];
    expect(planFields(fields).blocked).toHaveLength(1);
    const plan = planFields(fields, "A-1");
    expect(plan.blocked).toEqual([]);
    expect(createPayload("1", "2", { summary: "Kind", description: null, values: {} }, plan, "A-1").fields).toEqual({ project: { id: "1" }, issuetype: { id: "2" }, summary: "Kind", parent: { key: "A-1" } });
  });
});
