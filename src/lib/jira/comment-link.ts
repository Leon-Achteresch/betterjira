export const jiraCommentUrl = (siteUrl: string | undefined, issueKey: string, commentId: string) => {
  if (!siteUrl || !issueKey.trim() || !commentId.trim() || issueKey === "." || issueKey === "..") return null;
  try {
    const site = new URL(siteUrl.trim());
    if (site.protocol !== "https:" || !site.hostname || site.username || site.password) return null;
    const contextPath = site.pathname.replace(/\/+$/, "");
    const url = new URL(`${site.origin}${contextPath}/browse/${encodeURIComponent(issueKey)}`);
    url.searchParams.set("focusedCommentId", commentId);
    url.hash = `comment-${encodeURIComponent(commentId)}`;
    return url.href;
  } catch {
    return null;
  }
};
