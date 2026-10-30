import { Schema } from "effect";
import { jira, jiraSend } from "./client";

const SearchPage = Schema.Struct({
  issues: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      key: Schema.String,
      fields: Schema.Record(Schema.String, Schema.Unknown),
    }),
  ),
  nextPageToken: Schema.optional(Schema.NullOr(Schema.String)),
  isLast: Schema.optional(Schema.Boolean),
});

export type SearchPage = typeof SearchPage.Type;
export type SearchIssue = SearchPage["issues"][number];

export const PAGE_SIZE = 50;

export const searchIssues = (jql: string, fields: readonly string[], pageToken?: string, maxResults = PAGE_SIZE) => {
  const params = new URLSearchParams({ jql, fields: fields.join(","), maxResults: String(maxResults) });
  if (pageToken) params.set("nextPageToken", pageToken);
  return jira(`/search/jql?${params}`, SearchPage);
};

const IssueCount = Schema.Struct({ count: Schema.Number });

export const countIssues = (jql: string) =>
  jira("/search/approximate-count", IssueCount, { method: "POST", body: JSON.stringify({ jql }) });

const JiraFields = Schema.Array(
  Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    custom: Schema.optional(Schema.Boolean),
    orderable: Schema.optional(Schema.Boolean),
    navigable: Schema.optional(Schema.Boolean),
    clauseNames: Schema.optional(Schema.Array(Schema.String)),
  }),
);

export type JiraFieldInfo = (typeof JiraFields.Type)[number];

export const fetchFields = jira("/field", JiraFields);

const ParsedJql = Schema.Struct({
  queries: Schema.Array(Schema.Struct({ errors: Schema.optional(Schema.Array(Schema.String)) })),
});

export const validateJql = (jql: string) =>
  jira("/jql/parse?validation=strict", ParsedJql, { method: "POST", body: JSON.stringify({ queries: [jql] }) });

const FilterDetail = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  jql: Schema.String,
  description: Schema.optional(Schema.String),
  favourite: Schema.optional(Schema.Boolean),
  owner: Schema.optional(Schema.Struct({ accountId: Schema.String, displayName: Schema.optional(Schema.String) })),
});

export type JiraFilterDetail = typeof FilterDetail.Type;
export type FilterInput = { name: string; jql: string; description?: string };

const filterPath = (id: string) => `/filter/${encodeURIComponent(id)}`;

export const fetchFilter = (id: string) => jira(filterPath(id), FilterDetail);

export const updateFilter = (id: string, input: FilterInput) =>
  jira(filterPath(id), FilterDetail, { method: "PUT", body: JSON.stringify(input) });

export const createFilter = (input: FilterInput) =>
  jira("/filter", FilterDetail, { method: "POST", body: JSON.stringify(input) });

export const deleteFilter = (id: string) => jiraSend(filterPath(id), { method: "DELETE" });

export const setFilterFavourite = (id: string, favourite: boolean) =>
  jiraSend(`${filterPath(id)}/favourite`, { method: favourite ? "PUT" : "DELETE" });
