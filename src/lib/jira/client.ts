import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { fetch } from "@tauri-apps/plugin-http";
import { Data, Effect, Fiber, Schema, Semaphore } from "effect";
import { isRetryableRead, isTransientStatus, JIRA_READ_CONCURRENCY, JIRA_READ_RETRIES, JIRA_MAX_AUTO_RETRY_DELAY, JIRA_WRITE_CONCURRENCY, retryAfterMs } from "./request-policy";

import { rateLimitMessage, retryAtFrom } from "./retry-after";

const CLIENT_ID: string | undefined = import.meta.env.VITE_ATLASSIAN_CLIENT_ID;
const CLIENT_SECRET: string | undefined = import.meta.env.VITE_ATLASSIAN_CLIENT_SECRET;
const refreshLock = Semaphore.makeUnsafe(1);
const readSlots = Semaphore.makeUnsafe(JIRA_READ_CONCURRENCY);
const writeSlots = Semaphore.makeUnsafe(JIRA_WRITE_CONCURRENCY);
let rateLimitedUntil = 0;
const CALLBACK_PORT = 8742;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/callback`;
const SCOPES =
  "read:jira-work write:jira-work read:jira-user read:me offline_access read:board-scope:jira-software read:board-scope.admin:jira-software read:sprint:jira-software read:project:jira read:issue-filter:jira";

export class JiraAuthError extends Data.TaggedError("JiraAuthError")<{ message: string; cause?: unknown }> {}
export class NotAuthenticated extends Data.TaggedError("NotAuthenticated")<{}> {}
export class JiraApiError extends Data.TaggedError("JiraApiError")<{ status: number; body: string; retryAfterMs?: number; retryAt?: number; handledRetries?: boolean }> {
  override get message() {
    if (this.status === 429) return rateLimitMessage(this.retryAt, Date.now());
    return `Jira antwortet mit ${this.status}${this.body ? `: ${this.body.slice(0, 300)}` : ""}`;
  }
}

const Session = Schema.Struct({
  accessToken: Schema.String,
  refreshToken: Schema.String,
  expiresAt: Schema.Number,
  cloudId: Schema.String,
  siteUrl: Schema.String,
  siteName: Schema.String,
});
type Session = typeof Session.Type;
let cachedSession: Session | undefined;

const TokenResponse = Schema.Struct({
  access_token: Schema.String,
  refresh_token: Schema.String,
  expires_in: Schema.Number,
});

const AccessibleResources = Schema.Array(
  Schema.Struct({ id: Schema.String, url: Schema.String, name: Schema.String }),
);

const authError = (message: string) => (cause: unknown) => new JiraAuthError({ message, cause });

const send = (url: string, init?: RequestInit) =>
  Effect.tryPromise({
    try: (signal) => fetch(url, { ...init, signal }),
    catch: authError("Atlassian ist nicht erreichbar"),
  });

const apiError = (response: Response, body: string) => new JiraApiError({
  status: response.status, body,
  retryAfterMs: retryAfterMs(response.headers.get("Retry-After")),
  retryAt: retryAtFrom(response.headers.get("Retry-After"), Date.now()),
  handledRetries: isTransientStatus(response.status),
});

const decode = <S extends Schema.Decoder<unknown>>(schema: S) =>
  Effect.fnUntraced(function* (response: Response) {
    if (!response.ok) {
      const body = yield* Effect.promise(() => response.text());
      return yield* apiError(response, body);
    }
    const json = yield* Effect.tryPromise({ try: () => response.json(), catch: authError("Ungültige Antwort von Atlassian") });
    return yield* Schema.decodeUnknownEffect(schema)(json);
  });

const requestTokens = Effect.fnUntraced(function* (grant: Record<string, string>) {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return yield* new JiraAuthError({ message: "VITE_ATLASSIAN_CLIENT_ID / VITE_ATLASSIAN_CLIENT_SECRET fehlen in .env.local" });
  }
  const response = yield* send("https://auth.atlassian.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...grant }),
  });
  const tokens = yield* decode(TokenResponse)(response);
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  };
});

const loadSession = Effect.gen(function* () {
  if (cachedSession) return cachedSession;
  const raw = yield* Effect.tryPromise({
    try: () => invoke<string | null>("session_get"),
    catch: authError("Anmeldedaten konnten nicht gelesen werden"),
  });
  if (raw === null) return yield* new NotAuthenticated();
  const session = yield* Effect.try(() => JSON.parse(raw)).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(Session)),
    Effect.mapError(() => new NotAuthenticated()),
  );
  cachedSession = session;
  return session;
});

const saveSession = (session: Session) =>
  Effect.tryPromise({
    try: () => invoke("session_set", { value: JSON.stringify(session) }),
    catch: authError("Anmeldedaten konnten nicht gespeichert werden"),
  }).pipe(Effect.tap(() => Effect.sync(() => { cachedSession = session; })));

const deleteSession = Effect.sync(() => { cachedSession = undefined; }).pipe(Effect.andThen(Effect.tryPromise({
  try: () => invoke("session_delete"),
  catch: authError("Anmeldedaten konnten nicht gelöscht werden"),
})));

const awaitCallback = Effect.fnUntraced(function* (authorizeUrl: string) {
  const raw = yield* Effect.tryPromise({
    try: () => invoke<string>("oauth_login", { port: CALLBACK_PORT, authorizeUrl }),
    catch: (cause) => new JiraAuthError({ message: typeof cause === "string" ? cause : "Anmeldung fehlgeschlagen", cause }),
  }).pipe(
    Effect.onInterrupt(() => Effect.promise(() => invoke("oauth_cancel").catch(() => undefined))),
    Effect.timeoutOrElse({
      duration: "5 minutes",
      orElse: () => Effect.fail(new JiraAuthError({ message: "Anmeldung abgelaufen" })),
    }),
  );
  yield* Effect.tryPromise(async () => {
    const window = getCurrentWindow();
    await window.unminimize();
    await window.setFocus();
  }).pipe(Effect.ignore);
  return new URL(raw);
});

export const login = Effect.gen(function* () {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return yield* new JiraAuthError({ message: "VITE_ATLASSIAN_CLIENT_ID / VITE_ATLASSIAN_CLIENT_SECRET fehlen in .env.local" });
  }
  const state = crypto.randomUUID();
  const authorizeUrl = new URL("https://auth.atlassian.com/authorize");
  authorizeUrl.search = new URLSearchParams({
    audience: "api.atlassian.com",
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    state,
    response_type: "code",
    prompt: "consent",
  }).toString();

  const { pathname, searchParams } = yield* awaitCallback(authorizeUrl.toString());
  if (pathname !== "/callback" || searchParams.get("state") !== state) {
    return yield* new JiraAuthError({ message: "Ungültige OAuth-Antwort, bitte erneut verbinden" });
  }
  const code = searchParams.get("code");
  if (!code) return yield* new JiraAuthError({ message: searchParams.get("error_description") ?? "Anmeldung abgebrochen" });

  const tokens = yield* requestTokens({ grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI });
  const resources = yield* send("https://api.atlassian.com/oauth/token/accessible-resources", {
    headers: { Authorization: `Bearer ${tokens.accessToken}`, Accept: "application/json" },
  }).pipe(Effect.flatMap(decode(AccessibleResources)));
  const site = resources[0];
  if (!site) return yield* new JiraAuthError({ message: "Dieser Account hat keinen Zugriff auf eine Jira-Site" });

  yield* saveSession({ ...tokens, cloudId: site.id, siteUrl: site.url, siteName: site.name }).pipe(
    refreshLock.withPermits(1),
  );
});

let pendingLogin: Fiber.Fiber<void, unknown> | undefined;

export const runLogin = () => {
  const previous = pendingLogin;
  const fiber = Effect.runFork(
    Effect.gen(function* () {
      if (previous) yield* Fiber.interrupt(previous);
      yield* login;
    }),
  );
  pendingLogin = fiber;
  return Effect.runPromise(Fiber.join(fiber));
};

export const logout = deleteSession.pipe(refreshLock.withPermits(1));

const refresh = Effect.fnUntraced(function* (session: Session) {
  const tokens = yield* requestTokens({ grant_type: "refresh_token", refresh_token: session.refreshToken }).pipe(
    Effect.catchTag("JiraApiError", (error) =>
      error.status !== 400 && error.status !== 401
        ? Effect.fail<JiraApiError | JiraAuthError | NotAuthenticated>(error)
        : deleteSession.pipe(Effect.andThen(Effect.fail(new NotAuthenticated()))),
    ),
  );
  const next = { ...session, ...tokens };
  yield* saveSession(next);
  return next;
}, Effect.uninterruptible);

const validSession = (rejectedToken?: string) =>
  Effect.gen(function* () {
    const session = yield* loadSession;
    const expired = session.expiresAt - 60_000 < Date.now();
    return expired || session.accessToken === rejectedToken ? yield* refresh(session) : session;
  }).pipe(refreshLock.withPermits(1));

export const currentSite = validSession().pipe(
  Effect.map(({ cloudId, siteName, siteUrl }) => ({ cloudId, siteName, siteUrl })),
  Effect.catchTag("NotAuthenticated", () => Effect.succeed(null)),
);

const authedAttempt = (path: string, init?: RequestInit) =>
  Effect.gen(function* () {
    const call = (session: Session) =>
      send(`https://api.atlassian.com/ex/jira/${session.cloudId}/rest/${path}`, {
        ...init,
        headers: {
          Accept: "application/json",
          ...(typeof init?.body === "string" && { "Content-Type": "application/json" }),
          ...init?.headers,
          Authorization: `Bearer ${session.accessToken}`,
        },
      });
    const session = yield* validSession();
    const response = yield* call(session);
    if (response.status !== 401) return response;
    const renewed = yield* validSession(session.accessToken);
    return yield* call(renewed);
  });

const awaitRateLimit = Effect.gen(function* () {
  while (rateLimitedUntil > Date.now()) {
    const remaining = rateLimitedUntil - Date.now();
    if (remaining > JIRA_MAX_AUTO_RETRY_DELAY) {
      return yield* new JiraApiError({ status: 429, body: "", retryAt: rateLimitedUntil, retryAfterMs: remaining, handledRetries: true });
    }
    yield* Effect.sleep(remaining);
  }
});

const authedFetch = (path: string, init?: RequestInit) => Effect.gen(function* () {
  const read = isRetryableRead(path, init?.method);
  const slots = read ? readSlots : writeSlots;
  for (let attempt = 0; ; attempt++) {
    const response = yield* Effect.gen(function* () {
      yield* awaitRateLimit;
      const response = yield* authedAttempt(path, init);
      if (response.status === 429) {
        rateLimitedUntil = Math.max(rateLimitedUntil, Date.now() + (retryAfterMs(response.headers.get("Retry-After")) || 1000));
      }
      return response;
    }).pipe(slots.withPermits(1));
    if (!read || !isTransientStatus(response.status) || attempt >= JIRA_READ_RETRIES
      || retryAfterMs(response.headers.get("Retry-After")) > JIRA_MAX_AUTO_RETRY_DELAY) return response;
    yield* Effect.promise(() => response.text()).pipe(Effect.ignore);
    yield* Effect.sleep(Math.max(retryAfterMs(response.headers.get("Retry-After")), 250 * 2 ** attempt * (0.8 + Math.random() * 0.4)));
  }
});

type ApiVersion = "api/2" | "api/3";

export const jira = <S extends Schema.Decoder<unknown>>(path: string, schema: S, init?: RequestInit, api: ApiVersion = "api/3") =>
  authedFetch(`${api}${path}`, init).pipe(Effect.flatMap(decode(schema)));

export const jiraSend = (path: string, init: RequestInit, api: ApiVersion = "api/3") =>
  Effect.gen(function* () {
    const response = yield* authedFetch(`${api}${path}`, init);
    if (response.ok) return;
    const body = yield* Effect.promise(() => response.text());
    return yield* apiError(response, body);
  });

export const jiraAgile = <S extends Schema.Decoder<unknown>>(path: string, schema: S) =>
  authedFetch(`agile/1.0${path}`).pipe(Effect.flatMap(decode(schema)));

export const jiraImage = (path: string) =>
  Effect.gen(function* () {
    const response = yield* authedFetch(`api/3${path}`, { headers: { Accept: "image/*" } });
    if (!response.ok) return yield* apiError(response, "");
    const blob = yield* Effect.tryPromise({ try: () => response.blob(), catch: authError("Bild konnte nicht geladen werden") });
    return yield* Effect.tryPromise({
      try: () =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        }),
      catch: authError("Bild konnte nicht gelesen werden"),
    });
  });
