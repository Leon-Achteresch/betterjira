import { Schema } from "effect";
import { jira, jiraSend, type JiraRequestInit, type JiraRequestScope } from "./client";
import { JiraStatus } from "./status";

const TransitionField = Schema.Struct({
  required: Schema.Boolean,
  name: Schema.String,
  schema: Schema.Struct({
    type: Schema.String,
    items: Schema.optional(Schema.String),
    system: Schema.optional(Schema.String),
    custom: Schema.optional(Schema.String),
  }),
  allowedValues: Schema.optional(Schema.Array(Schema.Unknown)),
});

const Transitions = Schema.Struct({
  transitions: Schema.Array(Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    to: JiraStatus,
    fields: Schema.optional(Schema.Record(Schema.String, TransitionField)),
    isAvailable: Schema.optional(Schema.Boolean),
    isConditional: Schema.optional(Schema.Boolean),
  })),
});

export type JiraTransition = (typeof Transitions.Type)["transitions"][number];
export type JiraTransitionField = typeof TransitionField.Type;

const transitionsPath = (key: string) => `/issue/${encodeURIComponent(key)}/transitions`;

export const readIssueTransitions = (key: string, scope?: JiraRequestScope) =>
  jira(`${transitionsPath(key)}?expand=transitions.fields`, Transitions, scope && { scope, cache: "no-store" });

export type JiraTransitionBody = {
  transition: { id: string };
  fields?: Record<string, unknown>;
  update?: Record<string, unknown>;
};

export const transitionComment = (body: unknown) => ({ comment: [{ add: { body } }] });

export const sendIssueTransition = (key: string, body: JiraTransitionBody, options?: Pick<JiraRequestInit, "scope" | "retry">) =>
  jiraSend(transitionsPath(key), { method: "POST", body: JSON.stringify(body), ...options });
