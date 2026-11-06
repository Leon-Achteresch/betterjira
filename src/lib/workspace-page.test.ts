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
import {
  filterWorkspaceEntries,
  parseWorkspacePageSearch,
  workspaceEmptyState,
  workspaceEntries,
  workspaceFilterCounts,
  workspacePageSearch,
} from "./workspace-page";

const busy = (): Workspace => {
  let workspace = rememberIssue(EMPTY_WORKSPACE, { key: "A-1", summary: "Suche verbessern" }, { visitedAt: 3 });
  workspace = rememberIssue(workspace, { key: "A-2", summary: "Editor prüfen" }, { visitedAt: 4 });
  workspace = togglePinnedIssue(workspace, { key: "A-1", summary: "Suche verbessern" });
  workspace = togglePinnedIssue(workspace, { key: "P-9", summary: "Nur angeheftet" });
  workspace = setCommentDraft(workspace, "A-2", "Bitte Tastatur prüfen");
  workspace = setCommentDraft(workspace, "D-5", "Rückfrage zum Rollout");
  return setIssueContext(workspace, "N-7", { note: "Mit Sam klären" });
};

describe("Arbeitsplatz-Ableitung", () => {
  it("führt Pins, Verlauf, Entwürfe, Feldentwürfe und Notizen ohne Duplikate zusammen", () => {
    const entries = workspaceEntries(busy(), ["A-1", "F-3", "F-3"]);
    expect(entries.map((entry) => entry.key)).toEqual(["A-2", "A-1", "P-9", "D-5", "N-7", "F-3"]);
    expect(new Set(entries.map((entry) => entry.key)).size).toBe(entries.length);
  });

  it("zeigt fehlende Details ehrlich nur als Schlüssel", () => {
    const entries = workspaceEntries(busy(), ["F-3"]);
    expect(entries.find((entry) => entry.key === "F-3")).toMatchObject({ summary: "F-3", known: false });
    expect(entries.find((entry) => entry.key === "N-7")).toMatchObject({ known: false });
    expect(entries.find((entry) => entry.key === "A-1")).toMatchObject({ summary: "Suche verbessern", known: true });
  });

  it("zählt jede Kategorie getrennt", () => {
    expect(workspaceFilterCounts(workspaceEntries(busy(), ["F-3"]))).toEqual({
      alle: 6,
      angeheftet: 2,
      entwuerfe: 3,
      notizen: 1,
      zuletzt: 2,
    });
    expect(workspaceFilterCounts([])).toEqual({ alle: 0, angeheftet: 0, entwuerfe: 0, notizen: 0, zuletzt: 0 });
  });

  it("filtert nach Kategorie und durchsucht Schlüssel, Titel, Notiz und Entwurf", () => {
    const entries = workspaceEntries(busy(), ["F-3"]);
    const keys = (filter: Parameters<typeof filterWorkspaceEntries>[1], query = "") =>
      filterWorkspaceEntries(entries, filter, query).map((entry) => entry.key);
    expect(keys("angeheftet")).toEqual(["A-1", "P-9"]);
    expect(keys("entwuerfe")).toEqual(["A-2", "D-5", "F-3"]);
    expect(keys("notizen")).toEqual(["N-7"]);
    expect(keys("zuletzt")).toEqual(["A-2", "A-1"]);
    expect(keys("alle", "  SAM ")).toEqual(["N-7"]);
    expect(keys("alle", "rollout")).toEqual(["D-5"]);
    expect(keys("entwuerfe", "a-1")).toEqual([]);
  });

  it("ignoriert leere Entwürfe und Notizen", () => {
    const workspace = setIssueContext({ ...busy(), drafts: { ...busy().drafts, "W-1": "   " } }, "W-2", { note: " " });
    const counts = workspaceFilterCounts(workspaceEntries(workspace, []));
    expect(counts.entwuerfe).toBe(2);
    expect(counts.notizen).toBe(1);
  });

  it("bleibt an die Verlaufsgrenze gebunden", () => {
    let workspace = EMPTY_WORKSPACE;
    for (let index = 0; index < RECENT_ISSUE_LIMIT + 5; index++)
      workspace = rememberIssue(workspace, { key: `R-${index}`, summary: "Ticket" });
    expect(workspaceFilterCounts(workspaceEntries(workspace, [])).zuletzt).toBe(RECENT_ISSUE_LIMIT);
  });

  it("liest Filter und Suche aus der URL und fällt bei Unbekanntem auf Alle zurück", () => {
    expect(parseWorkspacePageSearch({ art: "notizen", q: "sam" })).toEqual({ art: "notizen", q: "sam" });
    expect(parseWorkspacePageSearch({ art: "unbekannt", q: 4 })).toEqual({});
    expect(workspacePageSearch("alle", "")).toEqual({});
  });

  it("unterscheidet leere Kategorie und erfolglose Suche", () => {
    expect(workspaceEmptyState("notizen", "").title).toBe("Keine privaten Notizen");
    expect(workspaceEmptyState("notizen", "x").title).toBe("Kein passender Arbeitskontext");
  });
});
