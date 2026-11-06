import { describe, expect, it } from "vitest";
import { issueLinkKeys, summarizeIssueLinks } from "./issue-links";

const blocks = { name: "Blocks", inward: "is blocked by", outward: "blocks" };
const duplicate = { name: "Duplicate", inward: "is duplicated by", outward: "duplicates" };
const relates = { name: "Relates", inward: "relates to", outward: "relates to" };
const status = { name: "In Arbeit", statusCategory: { key: "indeterminate", colorName: "yellow" } };
const issue = (key: string, summary = `Titel ${key}`) => ({
  id: key,
  key,
  fields: { summary, status, issuetype: { name: "Aufgabe", iconUrl: "https://example.test/task.svg" } },
});

describe("summarizeIssueLinks", () => {
  it("benennt inwardIssue mit type.inward und outwardIssue mit type.outward", () => {
    const result = summarizeIssueLinks([
      { id: "1", type: blocks, outwardIssue: issue("A-2") },
      { id: "2", type: blocks, inwardIssue: issue("A-3") },
      { id: "3", type: duplicate, inwardIssue: issue("A-4") },
    ]);
    expect(result.groups.map(({ label, issues }) => [label, issues.map(({ key }) => key)])).toEqual([
      ["blocks", ["A-2"]],
      ["is blocked by", ["A-3"]],
      ["is duplicated by", ["A-4"]],
    ]);
    expect(result.total).toBe(3);
    expect(result.unreadable).toBe(0);
  });

  it("übernimmt Titel, Status und Typ des verknüpften Tickets", () => {
    const [row] = summarizeIssueLinks([{ type: blocks, outwardIssue: issue("A-2", "Login reparieren") }]).groups[0]!.issues;
    expect(row).toEqual({
      key: "A-2",
      summary: "Login reparieren",
      status: { name: "In Arbeit", statusCategory: { key: "indeterminate", colorName: "yellow" } },
      issuetype: { name: "Aufgabe", iconUrl: "https://example.test/task.svg" },
    });
  });

  it("dedupliziert gleiche Beziehung zum selben Ticket, behält aber beide Richtungen", () => {
    const result = summarizeIssueLinks([
      { id: "1", type: blocks, outwardIssue: issue("A-2") },
      { id: "1", type: blocks, outwardIssue: issue("A-2") },
      { id: "2", type: blocks, inwardIssue: issue("A-2") },
      { id: "3", type: relates, outwardIssue: issue("A-5") },
      { id: "4", type: relates, inwardIssue: issue("A-5") },
    ]);
    expect(result.groups.map(({ label, issues }) => [label, issues.map(({ key }) => key)])).toEqual([
      ["blocks", ["A-2"]],
      ["is blocked by", ["A-2"]],
      ["relates to", ["A-5"]],
    ]);
    expect(result.total).toBe(3);
  });

  it("zeigt fehlende Felder ehrlich als nur Schlüssel", () => {
    const result = summarizeIssueLinks([
      { type: blocks, outwardIssue: { key: "OPS-7" } },
      { type: blocks, outwardIssue: { key: "OPS-8", fields: null } },
      { type: blocks, outwardIssue: { key: "OPS-9", fields: { summary: "  ", status: { name: "Kaputt" }, issuetype: 5 } } },
    ]);
    expect(result.groups[0]!.issues).toEqual([{ key: "OPS-7" }, { key: "OPS-8" }, { key: "OPS-9" }]);
  });

  it("erfindet keine Richtung, wenn der Typ keine Bezeichnung liefert", () => {
    const result = summarizeIssueLinks([
      { type: { name: "Blocks" }, inwardIssue: issue("A-2") },
      { type: { name: "Blocks", inward: "" }, outwardIssue: issue("A-3") },
      { inwardIssue: issue("A-4") },
    ]);
    expect(result.groups.map(({ label, issues }) => [label, issues.map(({ key }) => key)])).toEqual([
      ["Verknüpft (Blocks)", ["A-2", "A-3"]],
      ["Verknüpft", ["A-4"]],
    ]);
  });

  it("zählt unlesbare oder nicht zugängliche Verknüpfungen, statt sie zu benennen", () => {
    const result = summarizeIssueLinks([
      null,
      "kaputt",
      { type: blocks },
      { type: blocks, outwardIssue: { key: "" } },
      { type: blocks, outwardIssue: { id: "77" } },
      { type: blocks, inwardIssue: issue("A-2"), outwardIssue: issue("A-3") },
      { type: blocks, outwardIssue: issue("A-9") },
    ]);
    expect(result.unreadable).toBe(6);
    expect(result.total).toBe(1);
    expect(result.groups).toHaveLength(1);
  });

  it("liefert ohne Verknüpfungen keine leeren Gruppen", () => {
    expect(summarizeIssueLinks([])).toEqual({ groups: [], total: 0, unreadable: 0 });
  });
});

describe("issueLinkKeys", () => {
  it("trennt Cache je Instanz, Konto und Ticket unter dem Jira-Präfix", () => {
    expect(issueLinkKeys.issue("cloud-a", "user-1", "A-1")).toEqual(["jira", "issue-links", "cloud-a", "user-1", "A-1"]);
    expect(issueLinkKeys.issue("cloud-a", "user-2", "A-1")).not.toEqual(issueLinkKeys.issue("cloud-a", "user-1", "A-1"));
  });
});
