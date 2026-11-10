import { Effect, Option, Schema } from "effect";
import { jira } from "./client";
import { jiraKeys } from "./queries";
import { openableUrl } from "../external-links/client";

export { openableUrl } from "../external-links/client";

const Text = Schema.optional(Schema.NullOr(Schema.String));

const RemoteObject = Schema.Struct({
  url: Text,
  title: Text,
  summary: Text,
  status: Schema.optional(Schema.NullOr(Schema.Struct({ resolved: Schema.optional(Schema.NullOr(Schema.Boolean)) }))),
});

const RemoteIssueLink = Schema.Struct({
  id: Schema.optional(Schema.NullOr(Schema.Number)),
  relationship: Text,
  application: Schema.optional(Schema.NullOr(Schema.Struct({ name: Text }))),
  object: RemoteObject,
});

const RemoteLinksResponse = Schema.Array(Schema.Unknown);

export type RemoteLinkRow = {
  id: string;
  title?: string;
  summary?: string;
  relationship?: string;
  application?: string;
  href?: string;
  host?: string;
  resolved: boolean;
};

export type RemoteLinkSummary = {
  links: RemoteLinkRow[];
  unreadable: number;
};

const decodeLink = Schema.decodeUnknownOption(RemoteIssueLink);

const textOf = (value: string | null | undefined) => {
  const text = value?.trim();
  return text ? text : undefined;
};

const rowOf = (link: typeof RemoteIssueLink.Type, index: number): RemoteLinkRow => {
  const target = openableUrl(link.object.url);
  return {
    id: link.id == null ? `index-${index}` : String(link.id),
    title: textOf(link.object.title),
    summary: textOf(link.object.summary),
    relationship: textOf(link.relationship),
    application: textOf(link.application?.name),
    href: target?.href,
    host: target?.host,
    resolved: link.object.status?.resolved === true,
  };
};

export const summarizeRemoteLinks = (raw: readonly unknown[]): RemoteLinkSummary => {
  const links: RemoteLinkRow[] = [];
  raw.forEach((item, index) => {
    const link = Option.getOrUndefined(decodeLink(item));
    const row = link && rowOf(link, index);
    if (row && (row.title || row.href)) links.push(row);
  });
  return { links, unreadable: raw.length - links.length };
};

export const remoteLinkKeys = {
  issue: (key: string, cloudId: string, accountId: string) =>
    [...jiraKeys.issue(key), "remote-links", cloudId, accountId] as const,
};

export const fetchRemoteLinks = (key: string) =>
  jira(`/issue/${encodeURIComponent(key)}/remotelink`, RemoteLinksResponse).pipe(Effect.map(summarizeRemoteLinks));
