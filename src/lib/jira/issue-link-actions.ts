import { Data, Effect, Schema } from "effect";
import { jira, jiraSend, type JiraRequestScope } from "./client";
import { quoteJql, textClause } from "./jql";
import type { IssueLinkDirection, IssueLinkSummary } from "./issue-links";
import { jiraKeys } from "./keys";

export const IssueLinkType = Schema.Struct({ id: Schema.String, name: Schema.String, inward: Schema.String, outward: Schema.String });
export type IssueLinkType = typeof IssueLinkType.Type;
const LinkTypes = Schema.Struct({ issueLinkTypes: Schema.Array(IssueLinkType) });
const LinkTarget = Schema.Struct({ key: Schema.String, fields: Schema.Struct({ summary: Schema.String }) });
const LinkTargets = Schema.Struct({ issues: Schema.Array(LinkTarget) });
const Permission = Schema.Struct({ permissions: Schema.Record(Schema.String, Schema.Struct({ havePermission: Schema.Boolean })) });

export type LinkChoice = { id: string; type: IssueLinkType; direction: IssueLinkDirection; label: string };
export type CreateLinkInput = { source: string; target: string; typeId: string; direction: IssueLinkDirection };

export const issueLinkActionKeys = {
  types: (scope: string) => [...jiraKeys.all, "link-types", scope] as const,
  permission: (scope: string, key: string) => [...jiraKeys.all, "link-permission", scope, key] as const,
  search: (scope: string, query: string) => [...jiraKeys.all, "link-search", scope, query] as const,
};

export const linkChoices = (types: readonly IssueLinkType[]): LinkChoice[] => types.flatMap((type) => [
  { id: `${type.id}:outward`, type, direction: "outward" as const, label: type.outward },
  ...(type.inward === type.outward ? [] : [{ id: `${type.id}:inward`, type, direction: "inward" as const, label: type.inward }]),
]);

export const linkInputError = (source: string, target: string, choice: LinkChoice | undefined, summary: IssueLinkSummary | undefined) => {
  if (!target) return "Wähle ein Ticket aus.";
  if (source.toUpperCase() === target.toUpperCase()) return "Ein Ticket kann nicht mit sich selbst verknüpft werden.";
  if (!choice) return "Wähle eine Beziehung aus.";
  if (summary?.groups.some((group) => group.issues.some((issue) => issue.key === target && issue.link?.typeId === choice.type.id &&
    (choice.type.inward === choice.type.outward || issue.link.direction === choice.direction)))) return "Diese Verknüpfung besteht bereits.";
  return undefined;
};

export const linkPayload = ({ source, target, typeId, direction }: CreateLinkInput) => ({
  type: { id: typeId },
  inwardIssue: { key: direction === "outward" ? source : target },
  outwardIssue: { key: direction === "outward" ? target : source },
});

export class InvalidIssueLink extends Data.TaggedError("InvalidIssueLink")<{ message: string }> {}

export const fetchLinkTypes = () => jira("/issueLinkType", LinkTypes).pipe(Effect.map(({ issueLinkTypes }) => issueLinkTypes));
export const fetchLinkPermission = (key: string) => jira(`/mypermissions?${new URLSearchParams({ issueKey: key, permissions: "LINK_ISSUES" })}`, Permission)
  .pipe(Effect.map(({ permissions }) => permissions.LINK_ISSUES?.havePermission === true));

export const searchLinkTargets = (query: string) => {
  const term = query.trim();
  const jql = /^[a-z][a-z0-9_]*-\d+$/i.test(term) ? `key = ${quoteJql(term.toUpperCase())}` : textClause(term);
  return jira(`/search/jql?${new URLSearchParams({ jql, fields: "summary", maxResults: "8" })}`, LinkTargets)
    .pipe(Effect.map(({ issues }) => issues));
};

export const createIssueLink = (input: CreateLinkInput, requestScope?: JiraRequestScope) => Effect.gen(function* () {
  if (input.source === input.target) return yield* new InvalidIssueLink({ message: "Ein Ticket kann nicht mit sich selbst verknüpft werden." });
  return yield* jiraSend("/issueLink", { method: "POST", body: JSON.stringify(linkPayload(input)), scope: requestScope });
});

export const deleteIssueLink = (id: string, requestScope?: JiraRequestScope) => jiraSend(`/issueLink/${encodeURIComponent(id)}`, { method: "DELETE", scope: requestScope });
