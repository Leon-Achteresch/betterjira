import { invoke } from "@tauri-apps/api/core";
import { Effect, Schema } from "effect";
import { ZammadError } from "./client";
import type { Article, User } from "./model";
import { userLabel } from "./presentation";

export type Person = {
  id?: number;
  name: string;
  email?: string;
  avatarUrl?: string;
  initials: string;
  organization?: string;
  phone?: string;
};
export const personInitials = (name: string) =>
  name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
export const personFromUser = (user: User, avatarUrl?: string): Person => ({
  id: user.id,
  name: userLabel(user),
  email: user.email ?? undefined,
  initials: personInitials(userLabel(user)),
  avatarUrl,
  organization: user.organization ?? undefined,
  phone: user.phone ?? undefined,
});
export const personFromAddress = (
  address: string,
  fallback: string,
): Person => {
  address = address.trim() === "-" ? "" : address;
  const match = address.match(/^\s*"?([^<"]+?)"?\s*<([^>]+)>/);
  const email =
    match?.[2] ?? (address.includes("@") ? address.trim() : undefined);
  const name =
    match?.[1]?.trim() ||
    (email ? email.split("@")[0].replace(/[._-]/g, " ") : address) ||
    fallback;
  return { name, email, initials: personInitials(name) };
};
export const authorId = (article: Article) =>
  article.origin_by_id ?? article.created_by_id;
export const articlePerson = (
  article: Article,
  people: ReadonlyMap<number, Person>,
) => {
  const id = authorId(article);
  const person = id ? people.get(id) : undefined;
  const address = personFromAddress(
    article.from ?? "",
    article.sender === "Customer" ? "Kunde" : "Team",
  );
  if (
    person &&
    (!address.email ||
      !person.email ||
      address.email.toLowerCase() === person.email.toLowerCase())
  )
    return person;
  return address;
};
export const replyRecipient = (article: Article) =>
  personFromAddress(
    article.sender === "Agent" ? (article.to ?? "") : (article.from ?? ""),
    "",
  );
export const canReplyToArticle = (article: Article) =>
  !article.internal &&
  article.sender !== "System" &&
  (article.type === "email" || article.sender === "Customer") &&
  !!replyRecipient(article).email;
export const stateLabel = (state?: string | null) =>
  ({
    new: "Neu",
    open: "Offen",
    closed: "Geschlossen",
    "pending reminder": "Wiedervorlage",
    "pending close": "Wartet auf Abschluss",
    merged: "Zusammengeführt",
    removed: "Entfernt",
  })[state ?? ""] ??
  state ??
  "Unbekannt";
export const priorityLabel = (priority?: string | null) =>
  ({ "1 low": "Niedrig", "2 normal": "Normal", "3 high": "Hoch" })[
    priority ?? ""
  ] ??
  priority ??
  "Normal";

const ImageResponse = Schema.Struct({
  status: Schema.Number,
  data: Schema.NullOr(Schema.Array(Schema.Number)),
  content_type: Schema.NullOr(Schema.String),
});
export const getAvatar = (hash: string) =>
  Effect.gen(function* () {
    if (!/^[a-f0-9]{1,128}$/i.test(hash))
      return yield* new ZammadError({ message: "Ungültiges Profilbild" });
    const raw = yield* Effect.tryPromise({
      try: () =>
        invoke<unknown>("zammad_request", {
          path: `/users/image/${hash}`,
          method: "GET",
          body: null,
          binary: true,
        }),
      catch: (cause) =>
        new ZammadError({
          message: "Profilbild konnte nicht geladen werden",
          cause,
        }),
    });
    const response = yield* Schema.decodeUnknownEffect(ImageResponse)(raw).pipe(
      Effect.mapError(
        (cause) => new ZammadError({ message: "Ungültiges Profilbild", cause }),
      ),
    );
    const mime = response.content_type?.split(";")[0].trim();
    if (
      response.status !== 200 ||
      !response.data ||
      response.data.length > 2 * 1024 * 1024 ||
      !mime ||
      !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mime)
    )
      return yield* new ZammadError({ message: "Kein Profilbild verfügbar" });
    let binary = "";
    for (let offset = 0; offset < response.data.length; offset += 8192)
      binary += String.fromCharCode(
        ...response.data.slice(offset, offset + 8192),
      );
    return `data:${mime};base64,${btoa(binary)}`;
  });
