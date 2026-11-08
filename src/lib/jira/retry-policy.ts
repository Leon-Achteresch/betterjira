import { JiraApiError, NotAuthenticated } from "./client";

const MAX_QUERY_RETRIES = 2;

const isPermanent = (error: unknown) =>
  error instanceof NotAuthenticated ||
  (error instanceof JiraApiError && error.status >= 400 && error.status < 500 && error.status !== 408);

export const shouldRetryQuery = (failureCount: number, error: unknown) =>
  failureCount < MAX_QUERY_RETRIES && !isPermanent(error);
