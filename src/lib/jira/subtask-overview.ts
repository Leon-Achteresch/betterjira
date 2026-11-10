export type SubtaskState = "done" | "open" | "unknown";
export type SubtaskFilter = "all" | "open";

export type WithStatusCategory = { fields: { status: { statusCategory: { key: string } } } };

export type SubtaskOverview<T> = {
  total: number;
  done: number;
  open: number;
  unknown: number;
  visible: T[];
  hiddenUnknown: number;
};

const OPEN_CATEGORIES = new Set(["new", "indeterminate"]);

export const subtaskState = (subtask: WithStatusCategory): SubtaskState => {
  const key = subtask.fields.status.statusCategory.key;
  if (key === "done") return "done";
  return OPEN_CATEGORIES.has(key) ? "open" : "unknown";
};

export function summarizeSubtasks<T extends WithStatusCategory>(subtasks: readonly T[], filter: SubtaskFilter): SubtaskOverview<T> {
  const counts = { done: 0, open: 0, unknown: 0 };
  const open: T[] = [];
  for (const subtask of subtasks) {
    const state = subtaskState(subtask);
    counts[state] += 1;
    if (state === "open") open.push(subtask);
  }
  return {
    total: subtasks.length,
    ...counts,
    visible: filter === "open" ? open : [...subtasks],
    hiddenUnknown: filter === "open" ? counts.unknown : 0,
  };
}
