import DOMPurify from "dompurify";
import type { User } from "./model";

export const userLabel = (user: User) =>
  [user.firstname, user.lastname].filter(Boolean).join(" ") ||
  user.email ||
  user.login ||
  `Benutzer ${user.id}`;
export const ticketDate = (value: string) =>
  new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
export const normalizeBaseUrl = (input: string) => {
  try {
    const url = new URL(input.trim());
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return null;
    return url.href.replace(/\/+$/, "").replace(/\/api\/v1$/, "");
  } catch {
    return null;
  }
};
export const ticketQuery = (text: string, filter: string, userId?: number) => {
  const scope =
    filter === "mine" && userId
      ? `owner_id:${userId} AND (state.type:open OR state.type:new OR state.type:pending*)`
      : filter === "all"
        ? ""
        : "state.type:open OR state.type:new OR state.type:pending*";
  const search = text.trim();
  return (
    [
      scope && `(${scope})`,
      search &&
        (/^#?\d+$/.test(search)
          ? `number:${search.replace(/^#/, "")}`
          : `(${search})`),
    ]
      .filter(Boolean)
      .join(" AND ") || "*"
  );
};
export const safeArticleHtml = (body: string) =>
  `<!doctype html><html><head><meta name="color-scheme" content="light dark"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'none'; base-uri 'none'"><style>body{font:14px/1.65 system-ui;margin:0;overflow-wrap:anywhere;color:light-dark(#202020,#e5e5e5)}img{max-width:100%;height:auto}blockquote{margin:8px 0;padding-left:12px;border-left:2px solid #888}a{color:inherit}pre{white-space:pre-wrap}</style></head><body>${DOMPurify.sanitize(body, { FORBID_TAGS: ["img", "style", "form", "iframe", "video", "audio"], FORBID_ATTR: ["style", "srcset"] })}</body></html>`;
