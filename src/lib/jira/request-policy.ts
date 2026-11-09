export const JIRA_READ_CONCURRENCY = 6;
export const JIRA_WRITE_CONCURRENCY = 2;
export const JIRA_READ_RETRIES = 2;

export const retryAfterMs = (value: string | null, now = Date.now()) => {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : 0;
};

export const isRetryableRead = (path: string, method = "GET") =>
  method === "GET" || (method === "POST" && path.endsWith("/search/approximate-count"));

export const isTransientStatus = (status: number) => [429, 502, 503, 504].includes(status);
