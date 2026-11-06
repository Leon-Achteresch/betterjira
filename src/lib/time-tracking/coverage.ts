export type IssueLoadState = { key: string; status: "pending" | "error" | "success"; truncated: boolean };

export type TimeCoverage = {
  issuesTruncated: boolean;
  pendingCount: number;
  failedKeys: string[];
  truncatedKeys: string[];
  complete: boolean;
};

export const timeCoverage = (issuesTruncated: boolean, states: readonly IssueLoadState[]): TimeCoverage => {
  const failedKeys = states.filter((state) => state.status === "error").map((state) => state.key);
  const truncatedKeys = states.filter((state) => state.status === "success" && state.truncated).map((state) => state.key);
  const pendingCount = states.filter((state) => state.status === "pending").length;
  return {
    issuesTruncated,
    pendingCount,
    failedKeys,
    truncatedKeys,
    complete: !issuesTruncated && pendingCount === 0 && failedKeys.length === 0 && truncatedKeys.length === 0,
  };
};
