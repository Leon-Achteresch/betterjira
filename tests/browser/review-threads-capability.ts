import type { ReviewThreadsCapability } from "@/lib/scm/review-threads-capability";

declare global {
  interface Window {
    __qaReviewThreads?: () => boolean;
  }
}

export const reviewThreadsAllowed: ReviewThreadsCapability = (connection) =>
  window.location.protocol === "http:" &&
  window.location.hostname === "127.0.0.1" &&
  window.__qaReviewThreads?.() === true &&
  ((connection.kind === "github" &&
    connection.id === "gh:github.com" &&
    connection.baseUrl === "https://github.com" &&
    connection.auth.kind === "gh" &&
    connection.auth.host === "github.com" &&
    (connection.account === "qa-user" ||
      connection.account === "qa-n23-other")) ||
    (connection.kind === "bitbucket-cloud" &&
      connection.id === "qa-cloud-connection" &&
      connection.baseUrl === "https://bitbucket.org" &&
      connection.auth.kind === "token" &&
      connection.auth.id === connection.id));
