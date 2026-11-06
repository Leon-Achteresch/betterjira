import { Option, Schema } from "effect";

export const JiraPerson = Schema.Struct({
  accountId: Schema.optional(Schema.String),
  accountType: Schema.optional(Schema.String),
  active: Schema.optional(Schema.Boolean),
  displayName: Schema.String,
  avatarUrls: Schema.Struct({ "48x48": Schema.String }),
});

export type JiraPerson = typeof JiraPerson.Type;

export type MentionCandidate = { accountId: string; displayName: string; avatarUrls: { "48x48": string } };

export const MENTION_SUGGESTION_LIMIT = 8;

const UNMENTIONABLE_ACCOUNT_TYPES = new Set(["app", "customer", "unknown"]);

const decodePerson = Schema.decodeUnknownOption(JiraPerson);

export const toPerson = (value: unknown): JiraPerson | undefined => Option.getOrUndefined(decodePerson(value));

export const toPeople = (values: readonly unknown[]): JiraPerson[] =>
  values.flatMap((value) => {
    const person = toPerson(value);
    return person ? [person] : [];
  });

export const isMentionable = (person: JiraPerson): person is JiraPerson & { accountId: string } =>
  !!person.accountId && person.active !== false && !UNMENTIONABLE_ACCOUNT_TYPES.has(person.accountType ?? "");

const toMentionCandidate = (person: JiraPerson): MentionCandidate | undefined =>
  isMentionable(person)
    ? { accountId: person.accountId, displayName: person.displayName, avatarUrls: { "48x48": person.avatarUrls["48x48"] } }
    : undefined;

const mentionable = (people: readonly (JiraPerson | undefined)[]): MentionCandidate[] => {
  const seen = new Set<string>();
  return people.flatMap((person) => {
    const candidate = person && toMentionCandidate(person);
    if (!candidate || seen.has(candidate.accountId)) return [];
    seen.add(candidate.accountId);
    return [candidate];
  });
};

export const issueParticipants = (
  fields: Readonly<Record<string, unknown>>,
  comments: readonly { readonly author?: JiraPerson }[],
): MentionCandidate[] =>
  mentionable([toPerson(fields.assignee), toPerson(fields.reporter), ...[...comments].reverse().map((comment) => comment.author)]);

export const rankMentionCandidates = (
  query: string,
  participants: readonly MentionCandidate[],
  found: readonly JiraPerson[],
): MentionCandidate[] => {
  const normalized = query.trim().toLocaleLowerCase("de");
  const matching = participants.filter((candidate) => candidate.displayName.toLocaleLowerCase("de").includes(normalized));
  const known = new Set(matching.map((candidate) => candidate.accountId));
  const extra = normalized ? mentionable(found).filter((candidate) => !known.has(candidate.accountId)) : [];
  return [...matching, ...extra].slice(0, MENTION_SUGGESTION_LIMIT);
};
