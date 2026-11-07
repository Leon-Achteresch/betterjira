const ISSUE_KEY = /^[a-z][a-z0-9_]*-\d+$/i;
const HAS_SCHEME = /^[a-z][a-z0-9+-]*:/i;
const LINK_LIKE =
  /^(?:[a-z][a-z0-9+-]*:\/\/|(?:https?|ftp|file|javascript|data|vbscript|blob):|[/\\]{2}|[a-z0-9-]+(?:\.[a-z0-9-]+)+(?::\d+)?[/\\])/i;

export type TicketLinkProblem = "offline" | "invalid" | "protocol" | "credentials" | "host" | "path";

export type TicketReference =
  | { kind: "text" }
  | { kind: "key"; key: string }
  | { kind: "link"; key: string }
  | { kind: "rejected"; problem: TicketLinkProblem };

export const looksLikeLink = (input: string) => {
  const value = input.trim();
  return LINK_LIKE.test(value);
};

const parseUrl = (value: string) => {
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const absolute = (value: string) =>
  HAS_SCHEME.test(value) ? value : /^[/\\]{2}/.test(value) ? `https:${value}` : `https://${value}`;

export function parseTicketReference(input: string, siteUrl?: string): TicketReference {
  const value = input.trim();
  if (ISSUE_KEY.test(value)) return { kind: "key", key: value.toUpperCase() };
  if (!looksLikeLink(value)) return { kind: "text" };
  if (/\s/.test(value)) return { kind: "rejected", problem: "invalid" };
  const site = siteUrl ? parseUrl(siteUrl) : null;
  if (!site) return { kind: "rejected", problem: "offline" };
  const url = parseUrl(absolute(value));
  if (!url) return { kind: "rejected", problem: "invalid" };
  if (url.protocol !== "https:") return { kind: "rejected", problem: "protocol" };
  if (url.username || url.password) return { kind: "rejected", problem: "credentials" };
  if (url.origin !== site.origin) return { kind: "rejected", problem: "host" };
  const prefix = `${site.pathname.replace(/\/$/, "")}/browse/`;
  const key = url.pathname.startsWith(prefix) ? url.pathname.slice(prefix.length).replace(/\/$/, "") : "";
  return ISSUE_KEY.test(key) ? { kind: "link", key: key.toUpperCase() } : { kind: "rejected", problem: "path" };
}
