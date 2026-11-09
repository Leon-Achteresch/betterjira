import type { QueryClient } from "@tanstack/react-query";
import { jiraKeys } from "./keys";

export const reconcileIds = (client: QueryClient, keys: readonly string[], issues: readonly { id: string; key: string }[]) => {
  const ids = new Map(issues.map((issue) => [issue.key, issue.id]));
  return keys.flatMap((key) => {
    const id = ids.get(key) ?? client.getQueryData<{ id: string }>(jiraKeys.issue(key))?.id;
    return id && /^\d+$/.test(id) && Number.isSafeInteger(Number(id)) ? [id] : [];
  });
};
