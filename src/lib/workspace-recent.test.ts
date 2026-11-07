import { describe, expect, it } from "vitest";
import {
  EMPTY_WORKSPACE,
  RECENT_ISSUE_LIMIT,
  rememberIssue,
  setCommentDraft,
  setIssueContext,
  togglePinnedIssue,
  type Workspace,
} from "./workspace";
import { filterWorkspaceEntries, workspaceEntries, workspaceFilterCounts } from "./workspace-page";
import { removeRecentIssue, restoreRecentIssue } from "./workspace-recent";

const issue = (key: string) => ({ key, summary: `Titel ${key}` });

const opened = (...keys: string[]): Workspace =>
  keys.reduceRight<Workspace>(
    (workspace, key, index) => rememberIssue(workspace, issue(key), { visitedAt: 100 - index, scrollTop: 200 }),
    EMPTY_WORKSPACE,
  );

const recentKeys = (workspace: Workspace) => workspace.recent.map(({ key }) => key);

describe("Aus Zuletzt entfernen", () => {
  it("ändert nur den Verlauf und lässt Notizen, Entwürfe, Pins und Lesestellen unangetastet", () => {
    let workspace = opened("A-1", "A-2", "A-3");
    workspace = togglePinnedIssue(workspace, issue("A-2"));
    workspace = setCommentDraft(workspace, "A-2", "Entwurf");
    workspace = setIssueContext(workspace, "A-2", { note: "Notiz" });
    const { workspace: next, removed } = removeRecentIssue(workspace, "A-2");
    expect(recentKeys(next)).toEqual(["A-1", "A-3"]);
    expect({ ...next, recent: workspace.recent }).toEqual(workspace);
    expect(next.contexts?.["A-2"]).toEqual(workspace.contexts?.["A-2"]);
    expect(removed).toEqual({ issue: issue("A-2"), following: ["A-3"], context: workspace.contexts?.["A-2"] });
  });

  it("ignoriert Tickets außerhalb des Verlaufs", () => {
    const workspace = togglePinnedIssue(opened("A-1"), issue("P-1"));
    const result = removeRecentIssue(workspace, "P-1");
    expect(result.workspace).toBe(workspace);
    expect(result.removed).toBeUndefined();
  });

  it("hält Kontexte mit Notiz, Pin oder Entwurf in den anderen Kategorien", () => {
    let workspace = opened("N-1", "P-1", "D-1", "R-1");
    workspace = setIssueContext(workspace, "N-1", { note: "Notiz" });
    workspace = togglePinnedIssue(workspace, issue("P-1"));
    workspace = setCommentDraft(workspace, "D-1", "Entwurf");
    for (const key of ["N-1", "P-1", "D-1", "R-1", "F-1"]) workspace = removeRecentIssue(workspace, key).workspace;
    const entries = workspaceEntries(workspace, ["F-1"]);
    expect(entries.map(({ key }) => key).sort()).toEqual(["D-1", "F-1", "N-1", "P-1"]);
    expect(workspaceFilterCounts(entries)).toMatchObject({ zuletzt: 0, notizen: 1, angeheftet: 1, entwuerfe: 2 });
    expect(filterWorkspaceEntries(entries, "zuletzt", "")).toEqual([]);
  });

  it("stellt den Eintrag an seiner Stelle wieder her", () => {
    const workspace = opened("A-1", "A-2", "A-3");
    const { workspace: next, removed } = removeRecentIssue(workspace, "A-2");
    expect(removed && restoreRecentIssue(next, removed)).toEqual(workspace);
  });

  it("behält inzwischen geöffnete Tickets vorn und dupliziert keinen Schlüssel", () => {
    const { workspace: removedFrom, removed } = removeRecentIssue(opened("A-1", "A-2", "A-3", "A-4"), "A-3");
    if (!removed) throw new Error("A-3 fehlt im Verlauf");
    let later = rememberIssue(removedFrom, issue("N-1"));
    later = rememberIssue(later, issue("A-4"));
    expect(recentKeys(restoreRecentIssue(later, removed))).toEqual(["A-4", "N-1", "A-1", "A-2", "A-3"]);

    const reopened = rememberIssue(removedFrom, issue("A-3"), { scrollTop: 900 });
    const restored = restoreRecentIssue(reopened, removed);
    expect(restored).toBe(reopened);
    expect(restored.contexts?.["A-3"]?.scrollTop).toBe(900);
  });

  it("respektiert das Verlaufslimit", () => {
    const keys = Array.from({ length: RECENT_ISSUE_LIMIT }, (_, index) => `L-${index + 1}`);
    const { workspace: removedFrom, removed } = removeRecentIssue(opened(...keys), "L-10");
    if (!removed) throw new Error("L-10 fehlt im Verlauf");
    const full = rememberIssue(removedFrom, issue("N-1"));
    const restored = restoreRecentIssue(full, removed);
    expect(restored.recent).toHaveLength(RECENT_ISSUE_LIMIT);
    expect(recentKeys(restored).slice(0, 12)).toEqual(["N-1", ...keys.slice(0, 11)]);
    expect(recentKeys(restored)).not.toContain(keys.at(-1));

    const { workspace: tailRemoved, removed: tail } = removeRecentIssue(opened(...keys), "L-50");
    if (!tail) throw new Error("L-50 fehlt im Verlauf");
    const refilled = rememberIssue(tailRemoved, issue("N-2"));
    expect(restoreRecentIssue(refilled, tail)).toBe(refilled);
  });

  it("behält entfernte Lesestellen auch beim nächsten Öffnen und überschreibt keine neuere", () => {
    const { workspace: next, removed } = removeRecentIssue(opened("A-1", "A-2"), "A-2");
    if (!removed) throw new Error("A-2 fehlt im Verlauf");
    const pruned = rememberIssue(next, issue("N-1"));
    expect(pruned.contexts?.["A-2"]).toEqual(removed.context);
    const restored = restoreRecentIssue(pruned, removed);
    expect(restored.contexts?.["A-2"]).toEqual(removed.context);
    expect(restored.contexts?.["N-1"]).toEqual(pruned.contexts?.["N-1"]);
  });
});
