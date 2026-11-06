export type JiraSessionStatus = "pending" | "unconnected" | "connected" | "error";

export const jiraSessionStatus = ({
  hasSite,
  isError,
  isPending,
}: {
  hasSite: boolean;
  isError: boolean;
  isPending: boolean;
}): JiraSessionStatus => (hasSite ? "connected" : isError ? "error" : isPending ? "pending" : "unconnected");
