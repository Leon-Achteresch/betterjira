import { Data, Effect, Schema } from "effect";
import { descriptionBasis, sameDescription, type DescriptionBasis, type DescriptionFormat } from "../description-comparison";
import type { FieldDraft } from "../field-draft";
import { jira, jiraSend, type JiraRequestScope } from "./client";
import { encode } from "./field-values";

const DescriptionResponse = Schema.Struct({ fields: Schema.Struct({ description: Schema.Json }) });

export class DescriptionSaveError extends Data.TaggedError("DescriptionSaveError")<{ message: string }> {}

export type DescriptionSaveInput = { draft: FieldDraft; format: DescriptionFormat; reviewed?: DescriptionBasis };
export type DescriptionSaveResult =
  | { status: "conflict" | "unbased"; remote: DescriptionBasis; submitted: FieldDraft }
  | { status: "saved"; basis: DescriptionBasis };

export const readDescription = (key: string, format: DescriptionFormat, scope?: JiraRequestScope) =>
  jira(`/issue/${encodeURIComponent(key)}?fields=description`, DescriptionResponse, { scope, cache: "no-store" }, format === "wiki" ? "api/2" : "api/3").pipe(
    Effect.flatMap(({ fields }) => {
      const basis = descriptionBasis(format, fields.description);
      return basis ? Effect.succeed(basis) : Effect.fail(new DescriptionSaveError({ message: "Die Serverbeschreibung lässt sich nicht originalgetreu vergleichen. Dein Entwurf bleibt erhalten." }));
    }),
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
  key: string,
  input: DescriptionSaveInput,
  scope?: JiraRequestScope,
  prepare?: (value: Schema.Json) => Effect.Effect<unknown, unknown>,
) => Effect.gen(function* () {
  const local = yield* submittedDescription(input);
  const expected = input.reviewed ?? input.draft.basis;
  const remote = yield* readDescription(key, input.format, scope);
  if (!expected || expected.format !== input.format) return { status: "unbased", remote, submitted: input.draft } satisfies DescriptionSaveResult;
  if (!sameDescription(expected, remote)) return { status: "conflict", remote, submitted: input.draft } satisfies DescriptionSaveResult;
  const value = prepare ? yield* prepare(local.value) : local.value;
  const prepared = descriptionBasis(input.format, value);
  if (!prepared) return yield* new DescriptionSaveError({ message: "Die Beschreibung konnte nicht vorbereitet werden. Dein Entwurf bleibt erhalten." });
  if (prepare) {
    const latest = yield* readDescription(key, input.format, scope);
    if (!sameDescription(remote, latest)) return { status: "conflict", remote: latest, submitted: input.draft } satisfies DescriptionSaveResult;
  }
  const encoded: unknown = input.format === "wiki" ? prepared.value : encode(input.format === "adf" ? "richtext" : "text", prepared.value);
  const basis = descriptionBasis(input.format, encoded);
  if (!basis) return yield* new DescriptionSaveError({ message: "Die Beschreibung konnte nicht zum Speichern vorbereitet werden." });
  yield* jiraSend(`/issue/${encodeURIComponent(key)}`, {
    method: "PUT", body: JSON.stringify({ fields: { description: basis.value } }), scope,
  }, input.format === "wiki" ? "api/2" : "api/3");
  return { status: "saved", basis } satisfies DescriptionSaveResult;
});
