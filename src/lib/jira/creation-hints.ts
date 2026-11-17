import { Data, Effect, Option, Schema } from "effect";
import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { quoteJql } from "./jql";
import { jiraKeys } from "./keys";
import { jiraRequestScope, withJiraQueryScope, type JiraQueryScope } from "./query-scope";
import { searchIssues, type SearchPage } from "./search";
import { JiraApiError } from "./client";

export const CREATION_HINT_LIMITS = { results: 10, title: 255, words: 5, wordLength: 40 } as const;
const FIELDS = ["summary", "project", "status", "issuetype"];
export type HintProject = { id: string; key: string; name?: string };
export class CreationHintsUnavailable extends Data.TaggedError("CreationHintsUnavailable")<{}> {}

export function creationHintRequest(project: HintProject | undefined, summary: string) {
  if (!project?.id.trim() || !project.key.trim() || summary.length > CREATION_HINT_LIMITS.title) return undefined;
  const words = summary.normalize("NFC").match(/[\p{L}\p{N}]{3,}/gu) ?? [];
  const terms = [...new Map(words.filter((word) => word.length <= CREATION_HINT_LIMITS.wordLength).map((word) => [word.toLowerCase(), word])).values()].slice(0, CREATION_HINT_LIMITS.words);
  if (!terms.length) return undefined;
  const clause = terms.map((term) => `summary ~ ${quoteJql(`${term}*`)}`).join(" OR ");
  return { project, terms, jql: `project = ${quoteJql(project.id)} AND (${clause}) ORDER BY updated DESC` };
}

export const creationHintsQuery = (client: QueryClient, scope: JiraQueryScope | undefined, request: ReturnType<typeof creationHintRequest>, owner: string, generation: number) => queryOptions({
  queryKey: jiraKeys.creationHints(owner, generation, request?.jql ?? "", scope),
  queryFn: ({ signal }) => Effect.runPromise(withJiraQueryScope(client, scope, Effect.gen(function* () {
    if (!request) return yield* new CreationHintsUnavailable();
    const page = yield* searchIssues(request.jql, FIELDS, undefined, CREATION_HINT_LIMITS.results, [], scope ? jiraRequestScope(client, scope) : undefined);
    if (page.issues.length > CREATION_HINT_LIMITS.results) return yield* new JiraApiError({ status: 502, body: "Jira hat mehr Hinweise als angefordert geliefert." });
    return page;
  })), { signal }),
  enabled: false, gcTime: 0, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false,
});

const HintFields = Schema.Struct({
  summary: Schema.String,
  project: Schema.Struct({ id: Schema.String, key: Schema.optional(Schema.String) }),
  status: Schema.optional(Schema.Unknown), issuetype: Schema.optional(Schema.Unknown),
});
const Named = Schema.Struct({ name: Schema.String });
const nameOf = (value: unknown) => Option.getOrUndefined(Schema.decodeUnknownOption(Named)(value))?.name;

export function creationHintRows(page: SearchPage, project: HintProject) {
  const ids = new Set<string>(); const keys = new Set<string>();
  let omitted = 0; let duplicates = 0;
  const rows = page.issues.slice(0, CREATION_HINT_LIMITS.results).flatMap((issue) => {
    if (ids.has(issue.id) || keys.has(issue.key)) { duplicates++; return []; }
    ids.add(issue.id); keys.add(issue.key);
    const fields = Option.getOrUndefined(Schema.decodeUnknownOption(HintFields)(issue.fields));
    if (!issue.id || !issue.key.toUpperCase().startsWith(`${project.key.toUpperCase()}-`) || !fields?.summary.trim() || fields.project.id !== project.id || (fields.project.key !== undefined && fields.project.key.toUpperCase() !== project.key.toUpperCase())) { omitted++; return []; }
    return [{ key: issue.key, summary: fields.summary, status: nameOf(fields.status) ?? "Status nicht geliefert", issueType: nameOf(fields.issuetype) ?? "Typ nicht geliefert" }];
  });
  return { rows, omitted, duplicates, returned: page.issues.length, coverage: page.isLast === true ? "page-end" as const : page.nextPageToken || page.isLast === false ? "limited" as const : "unknown" as const };
}
