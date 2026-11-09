import { Schema } from "effect";

export const JiraStatus = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  statusCategory: Schema.Struct({ key: Schema.String, colorName: Schema.String }),
});
