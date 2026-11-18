import { Data, Effect, Schema } from "effect";
import { acceptanceCriteria, type AcceptanceCriterion } from "./acceptance-criteria";
import { JiraApiError, JiraRequestScopeChanged, NotAuthenticated, jira, type JiraRequestScope } from "./client";
import { isExactIssueKey } from "./issue-link";
import { confirmsDirectedLink, oppositeLinkDirection, type IssueLinkReference, type IssueLinkSummary } from "./issue-links";
import { readJiraAccount } from "./query-scope";

const Text = Schema.Trim.pipe(Schema.check(Schema.isMinLength(1)));
const Ticket = Schema.Struct({
  id: Text,
  key: Schema.String,
  fields: Schema.Struct({
    description: Schema.optional(Schema.Unknown),
    issuetype: Schema.optional(Schema.Unknown),
    summary: Schema.optional(Schema.Unknown),
    issuelinks: Schema.optional(Schema.NullOr(Schema.Array(Schema.Unknown))),
  }),
});
const isIssueType = Schema.is(Schema.Struct({ id: Text, name: Schema.String }));
const validKey = (key: string) => key.length <= 255 && isExactIssueKey(key);
const normalize = (text: string) => text.trim().toLowerCase();

export type TestLinkCandidate = { key: string; reference: IssueLinkReference };

const isTestLink = ({ id, typeId, typeName, direction, directed }: IssueLinkReference) =>
  !!id.trim() && !!typeId.trim() && direction === "inward" && normalize(typeName) === "tests" && !!directed &&
  normalize(directed.outward) === "tests" && ["tested by", "is tested by"].includes(normalize(directed.inward));

export function testLinkCandidates(source: string, summary?: IssueLinkSummary): TestLinkCandidate[] {
  if (!summary) return [];
  const links = summary.groups.flatMap(({ issues }) => issues);
  const counts = new Map<string, number>();
  for (const { link } of links) if (link) counts.set(link.id, (counts.get(link.id) ?? 0) + 1);
  const candidates = links.flatMap(({ key, link }) => link && counts.get(link.id) === 1 && validKey(key) && key !== source && isTestLink(link)
    ? [{ key, reference: link }]
    : []);
  const targets = new Map<string, number>();
  for (const { key } of candidates) targets.set(key, (targets.get(key) ?? 0) + 1);
  return candidates.filter(({ key }) => targets.get(key) === 1);
}

const readTicket = (key: string, fields: string, scope: JiraRequestScope) =>
  jira(`/issue/${encodeURIComponent(key)}?fields=${fields}`, Ticket, { scope, cache: "no-store", retry: false });

class CriteriaTestUnconfirmed extends Data.TaggedError("CriteriaTestUnconfirmed")<{
  subject: "criterion" | "link" | "test";
}> {}

export const readCriteriaTestReview = (
  source: { key: string; id: string },
  criterion: AcceptanceCriterion,
  target: TestLinkCandidate,
  accountId: string,
  scope: JiraRequestScope,
) => Effect.gen(function* () {
  const { key, reference } = target;
  if (!validKey(source.key) || !validKey(key) || source.key === key || !isTestLink(reference))
    return yield* new CriteriaTestUnconfirmed({ subject: "link" });

  const checkAccount = Effect.gen(function* () {
    const account = yield* readJiraAccount(scope, false);
    if (account.accountId !== accountId || !scope.isCurrent()) return yield* new JiraRequestScopeChanged();
  });
  yield* checkAccount;
  const origin = yield* readTicket(source.key, "description,issuelinks", scope);
  const fresh = acceptanceCriteria(origin.fields.description);
  if (origin.id !== source.id || origin.key !== source.key || !fresh.rows.some(({ line, text }) => line === criterion.line && text === criterion.text))
    return yield* new CriteriaTestUnconfirmed({ subject: "criterion" });
  if (!confirmsDirectedLink(origin.fields.issuelinks ?? [], key, reference))
    return yield* new CriteriaTestUnconfirmed({ subject: "link" });

  const linked = yield* readTicket(key, "summary,issuetype,issuelinks", scope);
  const type = linked.fields.issuetype;
  if (linked.key !== key || linked.id === origin.id || !isIssueType(type) || normalize(type.name) !== "test")
    return yield* new CriteriaTestUnconfirmed({ subject: "test" });
  if (!confirmsDirectedLink(linked.fields.issuelinks ?? [], source.key, { ...reference, direction: oppositeLinkDirection(reference.direction) }))
    return yield* new CriteriaTestUnconfirmed({ subject: "link" });

  yield* checkAccount;
  const summary = typeof linked.fields.summary === "string" ? linked.fields.summary.trim() : undefined;
  return { criterion, source: origin.key, test: { key: linked.key, type: type.name.trim(), summary }, relation: reference.directed?.inward };
});

export function criteriaTestReviewError(error: unknown) {
  if (error instanceof JiraRequestScopeChanged) return "Der Ticket- oder Kontokontext hat sich geändert.";
  if (error instanceof CriteriaTestUnconfirmed) {
    if (error.subject === "criterion") return "Das ausgewählte Kriterium ist in der aktuellen Beschreibung nicht mehr eindeutig.";
    if (error.subject === "test") return "Jira bestätigt das Ziel nicht als Ticket vom Typ „Test“.";
    return "Die ausgewählte Testverknüpfung ist auf beiden Tickets nicht eindeutig bestätigt.";
  }
  if (error instanceof NotAuthenticated || (error instanceof JiraApiError && [401, 403, 404].includes(error.status)))
    return "Mindestens ein Ticket ist für dieses Konto nicht lesbar.";
  return "Die Auswahl konnte in Jira nicht geprüft werden.";
}
