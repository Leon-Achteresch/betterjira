import { describe, expect, it } from "vitest";
import { EMPTY_WORKSPACE, rememberIssue, restoreWorkspaces, type Workspace } from "./workspace";
import { movePlannedIssue, planIssue, restorePlannedIssue, sanitizePlan } from "./workspace-plan";
import { visibleWorkspaceEntries, workspaceEntries, workspaceFilterCounts } from "./workspace-page";

const first = { key: "DEMO-1", summary: "First" };
const second = { key: "DEMO-2", summary: "Second" };
const third = { key: "DEMO-3", summary: "Third" };
const seeded = (): Workspace => planIssue(planIssue(planIssue(EMPTY_WORKSPACE, first, "today"), second, "later"), third, "today");

describe("personal plan", () => {
  it("keeps a single entry, changes buckets and preserves pins, drafts and contexts", () => {
    const existing = { ...EMPTY_WORKSPACE, pinned: [first], drafts: { "DEMO-2": "unsent" } };
    const planned = planIssue(existing, first, "today");
    expect(planIssue(planned, first, "today")).toBe(planned);
    const later = planIssue(planned, first, "later");
    expect(later.plan).toEqual([{ ...first, bucket: "later" }]);
    expect(later.pinned).toBe(existing.pinned);
    expect(later.drafts).toBe(existing.drafts);
    expect(planIssue(later, first, null).plan).toEqual([]);
  });

  it("moves within one bucket and leaves boundary actions unchanged", () => {
    const current = seeded();
    expect(movePlannedIssue(current, first.key, -1)).toBe(current);
    expect(movePlannedIssue(current, third.key, 1)).toBe(current);
    expect(movePlannedIssue(current, "MISSING-1", 1)).toBe(current);
    const moved = movePlannedIssue(current, third.key, -1);
    expect(moved.plan?.map((entry) => entry.key)).toEqual([third.key, second.key, first.key]);
    expect(visibleWorkspaceEntries(workspaceEntries(moved, []), "heute", "", "standard").map((entry) => entry.key)).toEqual([third.key, first.key]);
  });

  it("restores membership and original position without reverting unrelated changes", () => {
    const previous = seeded();
    let changed = planIssue(previous, first, "later");
    changed = planIssue(changed, { key: "NEW-1", summary: "New" }, "today");
    const restored = restorePlannedIssue(changed, first.key, "later", previous.plan ?? []);
    expect(restored.plan?.map((entry) => entry.key)).toEqual([first.key, second.key, third.key, "NEW-1"]);
    const superseded = planIssue(changed, first, null);
    expect(restorePlannedIssue(superseded, first.key, "later", previous.plan ?? [])).toBe(superseded);
  });

  it("includes planned-only tickets and counts plans independently from pins", () => {
    const entries = workspaceEntries(seeded(), []);
    expect(entries).toHaveLength(3);
    expect(workspaceFilterCounts(entries)).toMatchObject({ heute: 2, spaeter: 1, angeheftet: 0, zuletzt: 0 });
    expect(visibleWorkspaceEntries(entries, "spaeter", "second", "standard")[0].key).toBe(second.key);
  });

  it("retains context when planned tickets drop out of the recent-history limit", () => {
    let workspace = planIssue(rememberIssue(EMPTY_WORKSPACE, first, { statusName: "Fertig" }), first, "today");
    for (let index = 0; index < 55; index++) workspace = rememberIssue(workspace, { key: `MORE-${index}`, summary: "Other" });
    expect(workspace.contexts?.[first.key]?.statusName).toBe("Fertig");
    expect(workspaceEntries(workspace, []).find((entry) => entry.key === first.key)?.planBucket).toBe("today");
  });

  it("repairs stored plans per account without discarding other workspace data", () => {
    const malformed = [{ ...first, bucket: "today" }, null, { key: "bad" }, { ...first, bucket: "later" }, { key: "", summary: "", bucket: "today" }];
    expect(sanitizePlan(malformed)).toEqual([{ ...first, bucket: "later" }]);
    const restored = restoreWorkspaces({ one: { ...EMPTY_WORKSPACE, plan: malformed }, two: EMPTY_WORKSPACE });
    expect(restored.one.plan).toEqual([{ ...first, bucket: "later" }]);
    expect(restored.two.plan).toBeUndefined();
    expect(restoreWorkspaces({ one: { ...EMPTY_WORKSPACE, plan: "broken" } }).one.plan).toEqual([]);
  });
});
