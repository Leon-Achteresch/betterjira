import type { QueryClient } from "@tanstack/react-query";
import { jiraKeys } from "./keys";
import { scheduleBoardReconcile } from "./board-cache";

export const invalidateIssueChange = (client: QueryClient, key: string, affectsLists: boolean) => {
  void client.invalidateQueries({ queryKey: jiraKeys.issue(key), exact: true });
  void client.invalidateQueries({ queryKey: jiraKeys.transitions(key), exact: true });
  if (!affectsLists) return;
  void client.invalidateQueries({ queryKey: jiraKeys.myWork, refetchType: "none" });
  void client.invalidateQueries({ queryKey: jiraKeys.allIssues, refetchType: "none" });
  void client.invalidateQueries({ queryKey: jiraKeys.allBoards, refetchType: "none" });
  scheduleBoardReconcile(client, key);
};
