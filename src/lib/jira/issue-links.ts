import { Effect, Option, Schema } from "effect";
import { jira } from "./client";
import { jiraKeys } from "./queries";

const LinkType = Schema.Struct({
  id: Schema.optional(Schema.String),
  name: Schema.optional(Schema.NullOr(Schema.String)),
  inward: Schema.optional(Schema.NullOr(Schema.String)),
  outward: Schema.optional(Schema.NullOr(Schema.String)),
});

const LinkedIssue = Schema.Struct({
  key: Schema.String,
  fields: Schema.optional(Schema.NullOr(Schema.Record(Schema.String, Schema.Unknown))),
});

const IssueLink = Schema.Struct({
  id: Schema.optional(Schema.String),
  type: Schema.optional(Schema.NullOr(LinkType)),
  inwardIssue: Schema.optional(Schema.NullOr(LinkedIssue)),
  outwardIssue: Schema.optional(Schema.NullOr(LinkedIssue)),
});

const LinkedStatus = Schema.Struct({
  name: Schema.String,
  statusCategory: Schema.Struct({ colorName: Schema.String }),
});

const LinkedIssueType = Schema.Struct({
  name: Schema.String,
  iconUrl: Schema.optional(Schema.String),
});

const IssueLinksResponse = Schema.Struct({
  fields: Schema.Struct({
    issuelinks: Schema.optional(Schema.NullOr(Schema.Array(Schema.Unknown))),
  }),
});

export type IssueLinkDirection = "inward" | "outward";

export type IssueLinkReference = { id: string; typeId: string; typeName: string; direction: IssueLinkDirection };

export type LinkedIssueRow = {
  key: string;
  link?: IssueLinkReference;
  summary?: string;
  status?: typeof LinkedStatus.Type;
  issuetype?: typeof LinkedIssueType.Type;
};

export type IssueLinkGroup = {
  label: string;
  issues: LinkedIssueRow[];
};

export type IssueLinkSummary = {
  groups: IssueLinkGroup[];
  total: number;
  unreadable: number;
};

const decodeLink = Schema.decodeUnknownOption(IssueLink);
const isStatus = Schema.is(LinkedStatus);
const isIssueType = Schema.is(LinkedIssueType);

const relationLabel = (direction: IssueLinkDirection, type: typeof LinkType.Type | null | undefined) => {
  const label = (direction === "inward" ? type?.inward : type?.outward)?.trim();
  if (label) return label;
  const name = type?.name?.trim();
  return name ? `Verknüpft (${name})` : "Verknüpft";
};

const rowOf = (issue: typeof LinkedIssue.Type): LinkedIssueRow => {
  const fields = issue.fields ?? {};
  const summary = typeof fields.summary === "string" && fields.summary.trim() ? fields.summary : undefined;
  return {
    key: issue.key.trim(),
    summary,
    status: isStatus(fields.status) ? fields.status : undefined,
    issuetype: isIssueType(fields.issuetype) ? fields.issuetype : undefined,
  };
};

const sideOf = (link: typeof IssueLink.Type) => {
  const { inwardIssue, outwardIssue } = link;
  if (inwardIssue && outwardIssue) return undefined;
  if (inwardIssue) return { direction: "inward" as const, issue: inwardIssue };
  if (outwardIssue) return { direction: "outward" as const, issue: outwardIssue };
  return undefined;
};

export const summarizeIssueLinks = (links: readonly unknown[]): IssueLinkSummary => {
  const groups = new Map<string, IssueLinkGroup>();
  let unreadable = 0;
  for (const raw of links) {
    const link = Option.getOrUndefined(decodeLink(raw));
    const side = link && sideOf(link);
    if (!link || !side || !side.issue.key.trim()) {
      unreadable++;
      continue;
    }
    const label = relationLabel(side.direction, link.type);
    const groupKey = label.toLocaleLowerCase("de");
    const group = groups.get(groupKey) ?? { label, issues: [] };
    const row = rowOf(side.issue);
    if (link.id && link.type?.id && link.type.name) row.link = { id: link.id, typeId: link.type.id, typeName: link.type.name, direction: side.direction };
    if (!group.issues.some((issue) => issue.key === row.key)) group.issues.push(row);
    groups.set(groupKey, group);
  }
  const list = [...groups.values()];
  return { groups: list, total: list.reduce((sum, group) => sum + group.issues.length, 0), unreadable };
};

export const issueLinkKeys = {
  issue: (cloudId: string, accountId: string, key: string) =>
    [...jiraKeys.all, "issue-links", cloudId, accountId, key] as const,
};

export const fetchIssueLinks = (key: string) =>
  jira(`/issue/${encodeURIComponent(key)}?fields=issuelinks`, IssueLinksResponse).pipe(
    Effect.map(({ fields }) => summarizeIssueLinks(fields.issuelinks ?? [])),
  );
