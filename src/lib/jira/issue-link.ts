export type IssueLink = { issueKey: string; commentId?: string };

const ISSUE_KEY = /^[A-Z][A-Z0-9_]*-\d+$/;
const COMMENT_ID = /^\d+$/;

const toUrl = (value: string) => {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
};

const decodeKey = (value: string) => {
  try {
    return decodeURIComponent(value).toUpperCase();
  } catch {
    return undefined;
  }
};

export const parseIssueLink = (href: string, siteUrl: string): IssueLink | undefined => {
  const url = toUrl(href);
  const site = toUrl(siteUrl);
  if (!url || !site || url.origin !== site.origin) return undefined;
  const key = /^\/browse\/([^/]+)\/?$/.exec(url.pathname)?.[1];
  const issueKey = key ? decodeKey(key) : undefined;
  if (!issueKey || !ISSUE_KEY.test(issueKey)) return undefined;
  const commentId = url.searchParams.get("focusedCommentId") ?? /^#comment-(\d+)$/.exec(url.hash)?.[1];
  return commentId && COMMENT_ID.test(commentId) ? { issueKey, commentId } : { issueKey };
};

export const appLinkTarget = (href: string, siteUrl: string | undefined): IssueLink | undefined =>
  siteUrl ? parseIssueLink(href, siteUrl) : undefined;

export const parseCommentSearch = (search: Record<string, unknown>): { comment?: string } => {
  const value = typeof search.comment === "number" ? String(search.comment) : search.comment;
  return typeof value === "string" && COMMENT_ID.test(value) ? { comment: value } : {};
};

export const issueSearch = (commentId: string | undefined): { comment?: string } => (commentId ? { comment: commentId } : {});

export type IssueRouteSearch = { bereich?: "zeit"; comment?: string };

export const issueRouteSearch = (search: Record<string, unknown>): IssueRouteSearch => ({
  ...(search.bereich === "zeit" && { bereich: "zeit" as const }),
  ...parseCommentSearch(search),
});

export const withoutCommentSearch = ({ bereich }: IssueRouteSearch): IssueRouteSearch => (bereich ? { bereich } : {});
