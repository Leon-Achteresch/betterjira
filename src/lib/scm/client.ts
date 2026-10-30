import { invoke } from "@tauri-apps/api/core";
import { Data, Effect, Schema } from "effect";
import type { RepoLink, ScmAuth, ScmConnection } from "./model";

export class ScmError extends Data.TaggedError("ScmError")<{ message: string; cause?: unknown }> {}

export class ScmApiError extends Data.TaggedError("ScmApiError")<{ status: number; body: string }> {
  override get message() {
    if (this.status === 401) return "Anmeldung abgelaufen oder Token ungültig";
    if (this.status === 403) return "Keine Berechtigung für diese Aktion";
    if (this.status === 404) return "Nicht gefunden oder kein Zugriff";
    const detail = serverMessage(this.body);
    return `Server antwortet mit ${this.status}${detail ? `: ${detail}` : ""}`;
  }
}

export const scmKeys = {
  all: ["scm"] as const,
  ghHosts: ["scm", "gh-hosts"] as const,
  repos: (connectionId: string) => ["scm", "repos", connectionId] as const,
  developmentAll: (issueKey: string) => ["scm", "development", issueKey] as const,
  development: (issueKey: string, links: readonly RepoLink[]) => ["scm", "development", issueKey, links] as const,
};

const ServerMessage = Schema.Struct({
  message: Schema.optional(Schema.String),
  error: Schema.optional(Schema.Struct({ message: Schema.optional(Schema.String) })),
  errors: Schema.optional(Schema.Array(Schema.Struct({ message: Schema.optional(Schema.String) }))),
});

const serverMessage = (body: string) => {
  try {
    const parsed = Schema.decodeUnknownSync(ServerMessage)(JSON.parse(body));
    return parsed.errors?.[0]?.message ?? parsed.error?.message ?? parsed.message ?? "";
  } catch {
    return body.slice(0, 200);
  }
};

const scmError = (message: string) => (cause: unknown) =>
  new ScmError({ message: typeof cause === "string" ? cause : message, cause });

type ScmInit = { method?: "GET" | "POST"; body?: unknown };

const RawResponse = Schema.Struct({ status: Schema.Number, body: Schema.String });

export const scmFetch = (auth: ScmAuth, url: string, init: ScmInit = {}) =>
  Effect.tryPromise({
    try: () =>
      invoke<unknown>("scm_request", {
        auth,
        url,
        method: init.method ?? "GET",
        body: init.body === undefined ? null : JSON.stringify(init.body),
      }),
    catch: scmError("Anfrage fehlgeschlagen"),
  }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(RawResponse)),
    Effect.mapError((error) => (error instanceof ScmError ? error : new ScmError({ message: "Ungültige Antwort", cause: error }))),
    Effect.flatMap((response) =>
      response.status >= 200 && response.status < 300
        ? Effect.succeed(response.body)
        : Effect.fail(new ScmApiError({ status: response.status, body: response.body })),
    ),
  );

export const scm = <S extends Schema.Decoder<unknown>>(auth: ScmAuth, url: string, schema: S, init?: ScmInit) =>
  scmFetch(auth, url, init).pipe(
    Effect.flatMap((body) =>
      Effect.try({ try: () => (body === "" ? null : (JSON.parse(body) as unknown)), catch: scmError("Antwort ist kein JSON") }),
    ),
    Effect.flatMap((json) =>
      Schema.decodeUnknownEffect(schema)(json).pipe(Effect.mapError(scmError("Unerwartete Antwort des Servers"))),
    ),
  );

const GhHosts = Schema.Struct({
  hosts: Schema.Record(
    Schema.String,
    Schema.Array(
      Schema.Struct({
        state: Schema.String,
        active: Schema.Boolean,
        host: Schema.String,
        login: Schema.optional(Schema.String),
      }),
    ),
  ),
});

export const ghConnections = Effect.tryPromise({
  try: () => invoke<string>("scm_gh_hosts"),
  catch: scmError("GitHub CLI konnte nicht gelesen werden"),
}).pipe(
  Effect.flatMap((raw) => Effect.try({ try: () => JSON.parse(raw) as unknown, catch: scmError(raw) })),
  Effect.flatMap((json) => Schema.decodeUnknownEffect(GhHosts)(json).pipe(Effect.mapError(scmError("Unerwartete Ausgabe von gh")))),
  Effect.map(({ hosts }) =>
    Object.values(hosts)
      .flat()
      .filter((account) => account.active && account.state === "success")
      .map(
        (account): ScmConnection => ({
          id: `gh:${account.host}`,
          kind: "github",
          label: account.host === "github.com" ? "GitHub" : `GitHub Enterprise · ${account.host}`,
          baseUrl: `https://${account.host}`,
          account: account.login ?? null,
          auth: { kind: "gh", host: account.host },
        }),
      ),
  ),
);

export const saveToken = (id: string, token: string, host: string) =>
  Effect.tryPromise({ try: () => invoke("scm_token_set", { id, token, host }), catch: scmError("Token konnte nicht gespeichert werden") });

export const deleteToken = (id: string) =>
  Effect.tryPromise({ try: () => invoke("scm_token_delete", { id }), catch: scmError("Token konnte nicht gelöscht werden") });
