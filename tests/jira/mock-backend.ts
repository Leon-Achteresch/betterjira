import { JqlError } from "./mock-jql";
import { CLOUD_ID, createDataset, createRng, SITE_URL, type DatasetOptions } from "./mock-data";
import { createRoutes, type RouteName } from "./mock-routes";
import { createMockJira, JiraHttpError } from "./mock-store";

export type { RouteName } from "./mock-routes";

export type LatencySpec = { base: number; jitter?: number; perItem?: number };
export type LatencyProfile = Partial<Record<RouteName | "default", LatencySpec>>;

const REALISTIC: LatencyProfile = {
  default: { base: 120, jitter: 80 },
  search: { base: 250, jitter: 150, perItem: 4 },
  "board-issues": { base: 250, jitter: 150, perItem: 4 },
  "board-backlog": { base: 250, jitter: 150, perItem: 4 },
  "sprint-issues": { base: 250, jitter: 150, perItem: 4 },
  count: { base: 300, jitter: 150 },
  fields: { base: 180, jitter: 60 },
  issue: { base: 220, jitter: 120 },
  "issue-edit": { base: 300, jitter: 150 },
  "issue-create": { base: 400, jitter: 200 },
  transition: { base: 350, jitter: 150 },
  "comment-add": { base: 300, jitter: 120 },
  "worklog-add": { base: 300, jitter: 120 },
  rank: { base: 250, jitter: 100 },
};

export const scaleLatency = (profile: LatencyProfile, factor: number): LatencyProfile =>
  Object.fromEntries(
    Object.entries(profile).map(([route, spec]) => [route, { base: spec.base * factor, jitter: (spec.jitter ?? 0) * factor, perItem: (spec.perItem ?? 0) * factor }]),
  );

export const LATENCY = { none: {}, realistic: REALISTIC, slow: scaleLatency(REALISTIC, 4) } satisfies Record<string, LatencyProfile>;

export type RateLimit = { requests: number; perMs: number };

export type MockRequest = { seq: number; method: string; route: RouteName; path: string; url: URL };

export type FaultRule = {
  route?: RouteName | RouteName[];
  method?: string;
  match?: (request: MockRequest) => boolean;
  status: number | "network";
  times?: number;
  skip?: number;
  probability?: number;
  retryAfter?: number | string;
  body?: unknown;
};

export type RequestRecord = {
  seq: number;
  method: string;
  route: RouteName | "unknown";
  path: string;
  status: number | "network" | "aborted" | "pending";
  startedAt: number;
  endedAt?: number;
  items: number;
  bytes: number;
  fault: boolean;
};

export type JiraMockOptions = DatasetOptions & {
  latency?: LatencyProfile;
  rateLimit?: RateLimit;
  faults?: FaultRule[];
  pageLimit?: number;
  now?: () => number;
};

type FaultState = FaultRule & { seen: number; fired: number };

const API_PATH = /^(?:\/ex\/jira\/([^/]+))?\/rest\/(?:api\/(2|3)|(agile)\/1\.0)(\/.*)$/;

const abortError = (signal: AbortSignal): unknown => signal.reason ?? new DOMException("This operation was aborted", "AbortError");

const wait = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(abortError(signal));
    if (ms <= 0) return resolve();
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError(signal));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });

const json = (status: number, body: unknown, headers: Record<string, string> = {}) => {
  const text = status === 204 || body === undefined ? null : JSON.stringify(body);
  return { response: new Response(text, { status, headers: { "content-type": "application/json;charset=UTF-8", ...headers } }), bytes: text ? new TextEncoder().encode(text).byteLength : 0 };
};

const readBody = async (request: Request) => {
  if (request.method === "GET" || request.method === "HEAD") return undefined;
  if (request.headers.get("content-type")?.includes("multipart/form-data")) return request.formData();
  const text = await request.text();
  if (text === "") return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new JiraHttpError(400, ["Unexpected character in request body: invalid JSON."]);
  }
};

export const createJiraMock = ({ latency = LATENCY.none, rateLimit, faults = [], pageLimit, now = Date.now, ...datasetOptions }: JiraMockOptions = {}) => {
  const seed = datasetOptions.seed ?? 1;
  const dataset = createDataset(datasetOptions);
  const jira = createMockJira(dataset, now);
  const findRoute = createRoutes(jira, pageLimit);
  const jitterRng = createRng(seed + 1);
  const faultRng = createRng(seed + 2);
  const changeRng = createRng(seed + 3);
  let profile = latency;
  let limit = rateLimit;
  let tokens = rateLimit?.requests ?? 0;
  let refilledAt = now();
  let rules: FaultState[] = faults.map((rule) => ({ ...rule, seen: 0, fired: 0 }));
  let log: RequestRecord[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  let seq = 0;
  let signedIn = true;

  const delayFor = (route: RouteName, part: "base" | "items", items = 0) => {
    const spec = profile[route] ?? profile.default;
    if (!spec) return 0;
    if (part === "items") return (spec.perItem ?? 0) * items;
    return spec.base + Math.round((jitterRng.next() * 2 - 1) * (spec.jitter ?? 0));
  };

  const takeToken = () => {
    if (!limit) return undefined;
    const current = now();
    tokens = Math.min(limit.requests, tokens + ((current - refilledAt) * limit.requests) / limit.perMs);
    refilledAt = current;
    if (tokens >= 1) {
      tokens -= 1;
      return undefined;
    }
    return Math.max(1, Math.ceil((((1 - tokens) * limit.perMs) / limit.requests) / 1000));
  };

  const matchFault = (request: MockRequest) => {
    for (const rule of rules) {
      const routes = rule.route === undefined ? undefined : [rule.route].flat();
      if (routes && !routes.includes(request.route)) continue;
      if (rule.method && rule.method !== request.method) continue;
      if (rule.match && !rule.match(request)) continue;
      rule.seen++;
      if (rule.seen <= (rule.skip ?? 0)) continue;
      if (rule.fired >= (rule.times ?? Infinity)) continue;
      if (rule.probability !== undefined && faultRng.next() >= rule.probability) continue;
      rule.fired++;
      return rule;
    }
    return undefined;
  };

  const respond = async (request: Request, entry: RequestRecord) => {
    const url = new URL(request.url);
    const match = API_PATH.exec(url.pathname);
    if (!match || (match[1] && match[1] !== CLOUD_ID)) return json(404, { errorMessages: [`Mock: unknown site or path ${url.pathname}`] });
    const api = match[3] ? "agile" : "rest";
    const found = findRoute(request.method, api, match[4]);
    if (!found) return json(404, { errorMessages: [`Mock: ${request.method} ${match[4]} is not implemented`] });
    const { route, params } = found;
    entry.route = route.name;
    if (!request.headers.get("authorization")?.startsWith("Bearer ")) return json(401, { errorMessages: ["Unauthorized"] });
    const retryAfter = takeToken();
    if (retryAfter !== undefined) return json(429, { errorMessages: ["Rate limit exceeded."] }, { "retry-after": String(retryAfter), "ratelimit-reason": "jira-burst-based" });
    const mockRequest: MockRequest = { seq: entry.seq, method: request.method, route: route.name, path: entry.path, url };
    const fault = matchFault(mockRequest);
    await wait(delayFor(route.name, "base"), request.signal);
    if (fault) {
      entry.fault = true;
      if (fault.status === "network") throw new TypeError("Mock: network error");
      const headers: Record<string, string> = fault.retryAfter === undefined ? {} : { "retry-after": String(fault.retryAfter) };
      return json(fault.status, fault.body ?? { errorMessages: [`Mock: injected ${fault.status}`] }, headers);
    }
    let result;
    try {
      result = route.handle({ method: request.method, version: match[2] === "2" ? "2" : "3", query: url.searchParams, body: await readBody(request), params });
    } catch (error) {
      if (error instanceof JiraHttpError) return json(error.status, error.body);
      if (error instanceof JqlError) return json(400, { errorMessages: [error.message], errors: {} });
      throw error;
    }
    entry.items = result.items ?? 0;
    await wait(delayFor(route.name, "items", entry.items), request.signal);
    return json(result.status ?? 200, result.body);
  };

  const handle = async (request: Request) => {
    const url = new URL(request.url);
    const entry: RequestRecord = { seq: ++seq, method: request.method, route: "unknown", path: `${url.pathname}${url.search}`, status: "pending", startedAt: now(), items: 0, bytes: 0, fault: false };
    log.push(entry);
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    try {
      const { response, bytes } = await respond(request, entry);
      if (request.signal.aborted) throw abortError(request.signal);
      entry.status = response.status;
      entry.bytes = bytes;
      return response;
    } catch (error) {
      entry.status = request.signal.aborted ? "aborted" : "network";
      throw error;
    } finally {
      inFlight--;
      entry.endedAt = now();
    }
  };

  const fetch = (input: RequestInfo | URL, init?: RequestInit) => handle(new Request(input, init));

  const session = () => ({
    accessToken: "mock-access-token",
    refreshToken: "mock-refresh-token",
    expiresAt: now() + 365 * 86_400_000,
    cloudId: CLOUD_ID,
    siteUrl: SITE_URL,
    siteName: "Mock Jira",
  });

  const invoke = async (command: string) => {
    if (command === "session_get") return signedIn ? JSON.stringify(session()) : null;
    if (command === "session_set" || command === "session_delete") {
      signedIn = command === "session_set";
      return null;
    }
    throw new Error(`Mock: Tauri command '${command}' is not simulated`);
  };

  const stats = () => {
    const count = (key: (entry: RequestRecord) => string) => {
      const totals: Record<string, number> = {};
      for (const entry of log) totals[key(entry)] = (totals[key(entry)] ?? 0) + 1;
      return totals;
    };
    return {
      total: log.length,
      inFlight,
      maxInFlight,
      aborted: log.filter((entry) => entry.status === "aborted").length,
      failed: log.filter((entry) => entry.status === "network" || (typeof entry.status === "number" && entry.status >= 400)).length,
      rateLimited: log.filter((entry) => entry.status === 429).length,
      items: log.reduce((sum, entry) => sum + entry.items, 0),
      bytes: log.reduce((sum, entry) => sum + entry.bytes, 0),
      byRoute: count((entry) => entry.route),
      byStatus: count((entry) => String(entry.status)),
    };
  };

  return {
    cloudId: CLOUD_ID,
    baseUrl: `https://api.atlassian.com/ex/jira/${CLOUD_ID}/rest`,
    data: dataset,
    me: dataset.me,
    jira,
    fetch,
    handle,
    invoke,
    session,
    stats,
    get requests(): readonly RequestRecord[] {
      return log;
    },
    resetStats: () => {
      log = [];
      maxInFlight = inFlight;
    },
    setLatency: (next: LatencyProfile) => {
      profile = next;
    },
    setRateLimit: (next?: RateLimit) => {
      limit = next;
      tokens = next?.requests ?? 0;
      refilledAt = now();
    },
    addFault: (rule: FaultRule) => {
      const state = { ...rule, seen: 0, fired: 0 };
      rules.push(state);
      return () => {
        rules = rules.filter((entry) => entry !== state);
      };
    },
    clearFaults: () => {
      rules = [];
    },
    signOut: () => {
      signedIn = false;
    },
    simulateChanges: (count: number, options?: Parameters<typeof jira.simulateChanges>[2]) => jira.simulateChanges(changeRng, count, options),
  };
};

export type JiraMock = ReturnType<typeof createJiraMock>;
