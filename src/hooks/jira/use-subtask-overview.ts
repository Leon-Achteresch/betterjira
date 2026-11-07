import { useMemo, useState } from "react";
import { summarizeSubtasks, type SubtaskFilter, type WithStatusCategory } from "@/lib/jira/subtask-overview";

export function useSubtaskOverview<T extends WithStatusCategory>(subtasks: readonly T[]) {
  const [filter, setFilter] = useState<SubtaskFilter>("all");
  const overview = useMemo(() => summarizeSubtasks(subtasks, filter), [subtasks, filter]);
  return { filter, setFilter, overview };
}
