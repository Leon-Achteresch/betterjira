import { Schema } from "effect";
import type { RememberedIssue, Workspace } from "./workspace";

export const PlanEntry = Schema.Struct({ key: Schema.String, summary: Schema.String, bucket: Schema.Literals(["today", "later"]) });
export type PlanEntry = typeof PlanEntry.Type;
export type PlanBucket = PlanEntry["bucket"];

export const planIssue = (workspace: Workspace, issue: RememberedIssue, bucket: PlanBucket | null): Workspace => {
  const existing = workspace.plan ?? [];
  const previous = existing.find((entry) => entry.key === issue.key);
  if (previous?.bucket === bucket || (!previous && bucket === null)) return workspace;
  return { ...workspace, plan: [...existing.filter((entry) => entry.key !== issue.key), ...(bucket ? [{ ...issue, bucket }] : [])] };
};

export const movePlannedIssue = (workspace: Workspace, key: string, direction: -1 | 1): Workspace => {
  const plan = [...(workspace.plan ?? [])];
  const index = plan.findIndex((entry) => entry.key === key);
  if (index === -1) return workspace;
  const entry = plan[index]!;
  let target = index + direction;
  while (target >= 0 && target < plan.length && plan[target]!.bucket !== entry.bucket) target += direction;
  if (target < 0 || target >= plan.length) return workspace;
  const neighbor = plan[target]!;
  plan[index] = neighbor;
  plan[target] = entry;
  return { ...workspace, plan };
};

export const restorePlannedIssue = (workspace: Workspace, key: string, expected: PlanBucket | null, previous: readonly PlanEntry[]): Workspace => {
  if ((workspace.plan?.find((entry) => entry.key === key)?.bucket ?? null) !== expected) return workspace;
  const former = previous.find((entry) => entry.key === key);
  const plan = [...(workspace.plan ?? []).filter((entry) => entry.key !== key)];
  if (former) {
    const following = previous.slice(previous.indexOf(former) + 1).find((entry) => plan.some((current) => current.key === entry.key));
    const index = following ? plan.findIndex((entry) => entry.key === following.key) : plan.length;
    plan.splice(index, 0, former);
  }
  return { ...workspace, plan };
};

export const sanitizePlan = (value: unknown): PlanEntry[] => {
  if (!Array.isArray(value)) return [];
  const valid = value.filter(Schema.is(PlanEntry));
  return [...new Map(valid.filter((entry) => entry.key.trim()).map((entry) => [entry.key, entry])).values()];
};
