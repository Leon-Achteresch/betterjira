import { Schema } from "effect";

const optionalText = Schema.optional(Schema.NullOr(Schema.String));
export const Connection = Schema.Struct({ baseUrl: Schema.String });
export type Connection = typeof Connection.Type;
export const User = Schema.Struct({
  id: Schema.Number,
  firstname: Schema.optional(Schema.String),
  lastname: Schema.optional(Schema.String),
  email: optionalText,
  login: optionalText,
  active: Schema.optional(Schema.Boolean),
  image: optionalText,
  organization: optionalText,
  phone: optionalText,
  department: optionalText,
});
export type User = typeof User.Type;
export const Named = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  active: Schema.optional(Schema.Boolean),
  state_type_id: Schema.optional(Schema.Number),
});
export type Named = typeof Named.Type;
export const Ticket = Schema.Struct({
  id: Schema.Number,
  number: Schema.String,
  title: Schema.String,
  group_id: Schema.Number,
  state_id: Schema.Number,
  priority_id: Schema.Number,
  owner_id: Schema.Number,
  customer_id: Schema.Number,
  organization_id: Schema.optional(Schema.NullOr(Schema.Number)),
  state: optionalText,
  priority: optionalText,
  group: optionalText,
  owner: optionalText,
  customer: optionalText,
  organization: optionalText,
  created_at: Schema.String,
  updated_at: Schema.String,
  pending_time: optionalText,
  escalation_at: optionalText,
  note: optionalText,
  article_count: Schema.optional(Schema.Number),
});
export type Ticket = typeof Ticket.Type;
export const Attachment = Schema.Struct({
  id: Schema.Union([Schema.Number, Schema.String]),
  filename: Schema.String,
  size: Schema.optional(Schema.Union([Schema.Number, Schema.String])),
});
export type Attachment = typeof Attachment.Type;
export const Article = Schema.Struct({
  id: Schema.Number,
  ticket_id: Schema.Number,
  body: Schema.String,
  content_type: Schema.optional(Schema.String),
  internal: Schema.Boolean,
  subject: optionalText,
  from: optionalText,
  to: optionalText,
  cc: optionalText,
  type: optionalText,
  sender: optionalText,
  created_at: Schema.String,
  created_by_id: Schema.optional(Schema.Number),
  origin_by_id: Schema.optional(Schema.NullOr(Schema.Number)),
  sender_id: Schema.optional(Schema.Number),
  message_id: optionalText,
  attachments: Schema.optional(Schema.Array(Attachment)),
});
export type Article = typeof Article.Type;
export const TimeEntry = Schema.Struct({
  id: Schema.Number,
  ticket_id: Schema.Number,
  time_unit: Schema.Union([Schema.String, Schema.Number]),
  created_at: Schema.String,
  type_id: Schema.optional(Schema.NullOr(Schema.Number)),
});
export type TimeEntry = typeof TimeEntry.Type;
export const TicketLinks = Schema.Struct({
  links: Schema.Array(
    Schema.Struct({
      link_type: Schema.String,
      link_object: Schema.String,
      link_object_value: Schema.Number,
    }),
  ),
  assets: Schema.optional(
    Schema.Struct({
      Ticket: Schema.optional(Schema.Record(Schema.String, Ticket)),
    }),
  ),
});
export type TicketLinks = typeof TicketLinks.Type;
export const Upload = Schema.Struct({
  filename: Schema.String,
  data: Schema.String,
  "mime-type": Schema.String,
});
export type Upload = typeof Upload.Type;
export type TicketPatch = {
  title?: string;
  state_id?: number;
  priority_id?: number;
  group_id?: number;
  owner_id?: number;
  customer_id?: number;
  organization_id?: number | null;
  pending_time?: string | null;
  note?: string;
};
export type ArticleInput = {
  body: string;
  type: string;
  internal: boolean;
  to?: string;
  cc?: string;
  subject?: string;
  in_reply_to?: string;
  attachments?: readonly Upload[];
};
export type CreateTicketInput = TicketPatch & {
  title: string;
  group_id: number;
  customer_id: number;
  article: ArticleInput;
};
