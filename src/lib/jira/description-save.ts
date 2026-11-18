import { Data, Effect, Schema } from "effect";
import { descriptionBasis, sameDescription, type DescriptionBasis, type DescriptionFormat } from "../description-comparison";
import type { FieldDraft } from "../field-draft";
import { JiraRequestScopeChanged, jira, jiraSend, type JiraRequestScope } from "./client";
import { encode } from "./field-values";

const DescriptionResponse = Schema.Struct({ id: Schema.String, key: Schema.String, fields: Schema.Struct({ description: Schema.Json }) });

export class DescriptionSaveError extends Data.TaggedError("DescriptionSaveError")<{ message: string }> {}

export type DescriptionSaveInput = { draft: FieldDraft; format: DescriptionFormat; reviewed?: DescriptionBasis };
export type DescriptionSaveTarget = { key: string; id: string };
export type DescriptionSaveResult =
  | { status: "conflict" | "unbased"; remote: DescriptionBasis; submitted: FieldDraft }
  | { status: "saved"; basis: DescriptionBasis };

export const readDescription = (target: DescriptionSaveTarget, format: DescriptionFormat, scope?: JiraRequestScope) =>
  jira(`/issue/${encodeURIComponent(target.key)}?fields=description`, DescriptionResponse, { scope, cache: "no-store", retry: false }, format === "wiki" ? "api/2" : "api/3").pipe(
    Effect.flatMap(({ id, key, fields }) => Effect.gen(function* () {
      if (scope && !scope.isCurrent()) return yield* new JiraRequestScopeChanged();
      if (!target.id || id !== target.id || key !== target.key)
        return yield* new DescriptionSaveError({ message: "Jira bestätigt das geöffnete Ticket nicht mehr. Dein Entwurf bleibt erhalten." });
      const basis = descriptionBasis(format, fields.description);
      if (!basis) return yield* new DescriptionSaveError({ message: "Die Serverbeschreibung lässt sich nicht originalgetreu vergleichen. Dein Entwurf bleibt erhalten." });
      return basis;
    })),
  );

const submittedDescription = ({ draft, format }: DescriptionSaveInput) => Effect.try({
  try: () => {
    const value: unknown = format === "adf" ? JSON.parse(draft.text) : draft.text;
    const basis = descriptionBasis(format, value);
    if (!basis) throw new Error("invalid description");
    return basis;
  },
  catch: () => new DescriptionSaveError({ message: "Der Beschreibungsentwurf lässt sich nicht lesen. Er wurde nicht gespeichert." }),
});

export const saveDescription = (
  target: DescriptionSaveTarget,
  input: DescriptionSaveInput,
  scope?: JiraRequestScope,
  prepare?: (value: Schema.Json) => Effect.Effect<unknown, unknown>,
) => Effect.gen(function* () {
  const local = yield* submittedDescription(input);
  const expected = input.reviewed ?? input.draft.basis;
  const remote = yield* readDescription(target, input.format, scope);
  if (!expected || expected.format !== input.format) return { status: "unbased", remote, submitted: input.draft } satisfies DescriptionSaveResult;
  if (!sameDescription(expected, remote)) return { status: "conflict", remote, submitted: input.draft } satisfies DescriptionSaveResult;
  const value = prepare ? yield* prepare(local.value) : local.value;
  const prepared = descriptionBasis(input.format, value);
  if (!prepared) return yield* new DescriptionSaveError({ message: "Die Beschreibung konnte nicht vorbereitet werden. Dein Entwurf bleibt erhalten." });
  const encoded: unknown = input.format === "wiki" ? prepared.value : encode(input.format === "adf" ? "richtext" : "text", prepared.value);
  const basis = descriptionBasis(input.format, encoded);
  if (!basis) return yield* new DescriptionSaveError({ message: "Die Beschreibung konnte nicht zum Speichern vorbereitet werden." });
  const body = JSON.stringify({ fields: { description: basis.value } });
  if (prepare) {
    const latest = yield* readDescription(target, input.format, scope);
    if (!sameDescription(remote, latest)) return { status: "conflict", remote: latest, submitted: input.draft } satisfies DescriptionSaveResult;
  }
  if (scope && !scope.isCurrent()) return yield* new JiraRequestScopeChanged();
  const sent = yield* jiraSend(`/issue/${encodeURIComponent(target.id)}`, {
    method: "PUT", body, scope, retry: false, maxRedirections: 0,
  }, input.format === "wiki" ? "api/2" : "api/3").pipe(
    Effect.as(true),
    Effect.catchTag("JiraApiError", (error) => error.status === 409 ? Effect.succeed(false) : Effect.fail(error)),
  );
  if (!sent) {
    const latest = yield* readDescription(target, input.format, scope);
    if (!sameDescription(remote, latest)) return { status: "conflict", remote: latest, submitted: input.draft } satisfies DescriptionSaveResult;
    return yield* new DescriptionSaveError({ message: "Jira meldet einen Schreibkonflikt. Die gelesene Beschreibung entspricht der geprüften Fassung. Dein Entwurf bleibt erhalten." });
  }
  return { status: "saved", basis } satisfies DescriptionSaveResult;
});
