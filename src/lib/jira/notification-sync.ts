import { jiraErrors } from "./field-values";
import { JiraApiError } from "./client";

export type NotificationSyncPhase = "unavailable" | "offline" | "checking" | "ready";

type SyncQuery = { status: "pending" | "error" | "success"; fetchStatus: "fetching" | "paused" | "idle" };

export const notificationSyncPhase = (query: SyncQuery | undefined, active: boolean, online: boolean): NotificationSyncPhase => {
  if (!query || !active || (query.status === "pending" && query.fetchStatus === "idle")) return "unavailable";
  if (!online || query.fetchStatus === "paused") return "offline";
  return query.fetchStatus === "fetching" ? "checking" : "ready";
};

export const notificationSyncError = (error: unknown) =>
  jiraErrors(error).messages.join(" ") || (error instanceof JiraApiError ? `Jira antwortet mit ${error.status}.` : "");
