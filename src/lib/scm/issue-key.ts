const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const mentionsIssue = (text: string, issueKey: string) =>
  new RegExp(`(^|[^a-z0-9])${escape(issueKey)}(?![0-9])`, "i").test(text);

const slug = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40)
    .replace(/^-+|-+$/g, "");

export const branchNameFor = (issueKey: string, summary: string) =>
  ["feature/" + issueKey, slug(summary)].filter(Boolean).join("-");

export const checkoutCommand = (branch: string) => `git fetch origin && git switch ${branch}`;
