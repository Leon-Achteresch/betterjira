import { Effect, Option, Schema } from "effect";
import { jira, type JiraRequestScope } from "./client";
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
  key: Schema.optional(Schema.String),
  fields: Schema.Struct({
    issuelinks: Schema.optional(Schema.NullOr(Schema.Array(Schema.Unknown))),
  }),
});

export type IssueLinkDirection = "inward" | "outward";

type DirectedLabels = Record<IssueLinkDirection, string>;

export type IssueLinkReference = {
  id: string;
  typeId: string;
  typeName: string;
  direction: IssueLinkDirection;
  duplicate?: true;
  directed?: DirectedLabels;
};

export const oppositeLinkDirection = (direction: IssueLinkDirection): IssueLinkDirection =>
  direction === "outward" ? "inward" : "outward";

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

const duplicateType = (type: typeof LinkType.Type | null | undefined) => {
  const inward = type?.inward?.trim().toLowerCase();
  return type?.name?.trim().toLowerCase() === "duplicate" &&
    type.outward?.trim().toLowerCase() === "duplicates" &&
    (inward === "is duplicated by" || inward === "duplicated by");
};

const normalizedLabel = (label: string) => label.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();

const directedLabels = (type: typeof LinkType.Type | null | undefined) => {
  const inward = type?.inward?.trim();
  const outward = type?.outward?.trim();
  if (inward && outward && normalizedLabel(inward) !== normalizedLabel(outward)) return { inward, outward };
};

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

export function readIssueLink(raw: unknown) {
  const link = Option.getOrUndefined(decodeLink(raw));
  const side = link && sideOf(link);
  return side && link ? { key: side.issue.key.trim(), direction: side.direction, typeId: link.type?.id } : undefined;
}

const LinkIdentity = Schema.Struct({ id: Schema.String });
const hasLinkIdentity = Schema.is(LinkIdentity);

function confirmedLinkType(links: readonly unknown[], target: string, reference: IssueLinkReference) {
  const matches = links.filter((raw) => hasLinkIdentity(raw) && raw.id === reference.id);
  if (matches.length !== 1) return undefined;
  const entry = Option.getOrUndefined(decodeLink(matches[0]));
  const side = entry && sideOf(entry);
  if (side?.issue.key.trim().toUpperCase() === target &&
    side.direction === reference.direction && entry?.type?.id === reference.typeId) return entry.type;
}

export function confirmsDuplicateLink(links: readonly unknown[], target: string, reference: IssueLinkReference) {
  return duplicateType(confirmedLinkType(links, target, reference));
}

export function confirmsDirectedLink(links: readonly unknown[], target: string, reference: IssueLinkReference) {
  if (!reference.id.trim() || !reference.typeId.trim()) return false;
  const type = confirmedLinkType(links, target, reference);
  const labels = directedLabels(type);
  if (!labels || !reference.directed || type?.name?.trim() !== reference.typeName.trim() ||
    labels.inward !== reference.directed.inward || labels.outward !== reference.directed.outward) return false;
  return links.filter((raw) => {
    const link = Option.getOrUndefined(decodeLink(raw));
    return link?.type?.id === reference.typeId && [link.inwardIssue, link.outwardIssue]
      .some((issue) => issue?.key.trim().toUpperCase() === target);
  }).length === 1;
}

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
    if (link.id && link.type?.id && link.type.name) row.link = {
      id: link.id, typeId: link.type.id, typeName: link.type.name, direction: side.direction,
      ...(duplicateType(link.type) && { duplicate: true }),
      directed: link.id.trim() && link.type.id.trim() && link.type.name.trim() ? directedLabels(link.type) : undefined,
    };
    const existing = group.issues.find((issue) => issue.key === row.key);
    if (!existing) group.issues.push(row);
    else if (existing.link) existing.link.directed = undefined;
    groups.set(groupKey, group);
  }
  const list = [...groups.values()];
  return { groups: list, total: list.reduce((sum, group) => sum + group.issues.length, 0), unreadable };
};

export const issueLinkKeys = {
  issue: (cloudId: string, accountId: string, key: string) =>
    [...jiraKeys.all, "issue-links", cloudId, accountId, key] as const,
};

export const fetchIssueLinkData = (key: string, scope?: JiraRequestScope) =>
  jira(`/issue/${encodeURIComponent(key)}?fields=issuelinks`, IssueLinksResponse,
    scope ? { scope, cache: "no-store", retry: false } : undefined);

export const fetchIssueLinks = (key: string) =>
  fetchIssueLinkData(key).pipe(
    Effect.map(({ fields }) => summarizeIssueLinks(fields.issuelinks ?? [])),
  );

export const hasIssueLink = (links: readonly unknown[], target: string, typeId: string, direction: IssueLinkDirection, symmetric: boolean) => links.some((raw) => {
  const link = Option.getOrUndefined(decodeLink(raw));
  const side = link && sideOf(link);
  return !!side && link?.type?.id === typeId && side.issue.key.toUpperCase() === target && (symmetric || side.direction === direction);
});
