import { Data, Effect, Schema } from "effect";
import { jira, jiraSend, type JiraRequestScope } from "./client";
import { jiraErrorText } from "./field-values";

const Priority = Schema.Struct({ id: Schema.String, name: Schema.String });
const BulkTransitions = Schema.Struct({
  transitions: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      to: Schema.Struct({ id: Schema.String, name: Schema.String }),
      fields: Schema.optional(
        Schema.Record(
          Schema.String,
          Schema.Struct({ required: Schema.optional(Schema.Boolean) }),
        ),
      ),
    }),
  ),
});
const EditMetadata = Schema.Struct({
  fields: Schema.Record(
    Schema.String,
    Schema.Struct({
      required: Schema.optional(Schema.Boolean),
      operations: Schema.optional(Schema.Array(Schema.String)),
      allowedValues: Schema.optional(Schema.Array(Schema.Unknown)),
    }),
  ),
});
export type BulkMetadata = typeof EditMetadata.Type & {
  transitions?: typeof BulkTransitions.Type.transitions;
};
export type BulkAction =
  | { kind: "assignee"; accountId: string | null }
  | { kind: "priority"; id: string }
  | { kind: "status"; statusId: string }
  | { kind: "add-labels" | "remove-labels"; labels: readonly string[] };
export type BulkResult = { key: string; error?: string };

const availableTransitions = (key: string) =>
  jira(
    `/issue/${encodeURIComponent(key)}/transitions?expand=transitions.fields`,
    BulkTransitions,
  );
const simpleTransition = (
  transition: (typeof BulkTransitions.Type.transitions)[number],
) => !Object.values(transition.fields ?? {}).some((field) => field.required);
export const bulkEditMetadata = (key: string) =>
  Effect.all({
    metadata: jira(`/issue/${encodeURIComponent(key)}/editmeta`, EditMetadata),
    transitions: availableTransitions(key).pipe(
      Effect.orElseSucceed(() => ({ transitions: [] })),
    ),
  }).pipe(
    Effect.map(({ metadata, transitions }) => ({
      ...metadata,
      transitions: transitions.transitions,
    })),
  );

export const commonBulkOptions = (metadata: readonly BulkMetadata[]) => {
  const supports = (field: string, operation: string) =>
    metadata.length > 0 &&
    metadata.every((meta) =>
      meta.fields[field]?.operations?.includes(operation),
    );
  const priorities = (metadata[0]?.fields.priority?.allowedValues ?? [])
    .filter(Schema.is(Priority))
    .filter((priority) =>
      metadata.every((meta) =>
        meta.fields.priority?.allowedValues?.some(
          (value) => Schema.is(Priority)(value) && value.id === priority.id,
        ),
      ),
    );
  return {
    assign: supports("assignee", "set"),
    unassign:
      supports("assignee", "set") &&
      metadata.every((meta) => !meta.fields.assignee?.required),
    priorities: supports("priority", "set") ? priorities : [],
    statuses: [
      ...new Map(
        (metadata[0]?.transitions ?? [])
          .filter(simpleTransition)
          .filter((transition) =>
            metadata.every((meta) =>
              meta.transitions?.some(
                (candidate) =>
                  candidate.to.id === transition.to.id &&
                  simpleTransition(candidate),
              ),
            ),
          )
          .map(({ to }) => [to.id, to]),
      ).values(),
    ],
    addLabels: supports("labels", "add"),
    removeLabels: supports("labels", "remove"),
  };
};

export const parseBulkLabels = (input: string) => [
  ...new Set(
    input
      .split(",")
      .map((label) => label.trim())
      .filter(Boolean),
  ),
];
export const validBulkLabels = (labels: readonly string[]) =>
  labels.length > 0 &&
  labels.every((label) => !/\s/.test(label) && label.length <= 255);
export const bulkEditBody = (action: BulkAction) => {
  if (action.kind === "status") return {};
  if (action.kind === "assignee")
    return {
      fields: {
        assignee: action.accountId ? { accountId: action.accountId } : null,
      },
    };
  if (action.kind === "priority")
    return { fields: { priority: { id: action.id } } };
  const operation = action.kind === "add-labels" ? "add" : "remove";
  return {
    update: { labels: action.labels.map((label) => ({ [operation]: label })) },
  };
};
class BulkTransitionUnavailable extends Data.TaggedError(
  "BulkTransitionUnavailable",
)<{ message: string }> {}
export const bulkEditIssue = (
  key: string,
  action: BulkAction,
  scope?: JiraRequestScope,
) =>
  Effect.gen(function* () {
    if (action.kind !== "status")
      return yield* jiraSend(`/issue/${encodeURIComponent(key)}`, {
        method: "PUT",
        body: JSON.stringify(bulkEditBody(action)),
        scope,
      });
    const { transitions } = yield* availableTransitions(key);
    const transition = transitions.find(
      (candidate) =>
        candidate.to.id === action.statusId && simpleTransition(candidate),
    );
    if (!transition)
      return yield* new BulkTransitionUnavailable({
        message:
          "Dieser Statuswechsel ist nicht mehr verfügbar oder benötigt weitere Pflichtangaben. Bitte das Ticket einzeln öffnen.",
      });
    return yield* jiraSend(`/issue/${encodeURIComponent(key)}/transitions`, {
      method: "POST",
      body: JSON.stringify({ transition: { id: transition.id } }),
      scope,
    });
  });

export const runBulkEdit = <E>(
  keys: readonly string[],
  run: (key: string) => Effect.Effect<unknown, E>,
  onResult: (result: BulkResult) => void = () => {},
) =>
  Effect.forEach(
    [...new Set(keys)],
    (key) =>
      run(key).pipe(
        Effect.match({
          onSuccess: (): BulkResult => ({ key }),
          onFailure: (error): BulkResult => ({
            key,
            error: jiraErrorText(error) || "Änderung fehlgeschlagen",
          }),
        }),
        Effect.tap((result) => Effect.sync(() => onResult(result))),
      ),
    { concurrency: 3 },
  );
