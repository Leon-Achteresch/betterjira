const parseUrl = (value: string) => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

export const jiraCommentUrl = (siteUrl: string | undefined, issueKey: string, commentId: string) => {
  const site = siteUrl ? parseUrl(siteUrl.trim()) : null;
  if (!site || site.protocol !== "https:" || !site.hostname || site.username || site.password) return null;
  if (!issueKey.trim() || !commentId.trim()) return null;
  const contextPath = site.pathname.replace(/\/+$/, "");
  const url = new URL(`${site.origin}${contextPath}/browse/${encodeURIComponent(issueKey)}`);
  url.searchParams.set("focusedCommentId", commentId);
  url.hash = `comment-${encodeURIComponent(commentId)}`;
  return url.href;
};
