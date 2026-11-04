import { Schema } from "effect";

export const JiraUser = Schema.Struct({
  displayName: Schema.String,
  avatarUrls: Schema.Struct({ "48x48": Schema.String }),
});

export type JiraUser = typeof JiraUser.Type;
export const isJiraUser = Schema.is(JiraUser);
