import { focusManager, QueriesObserver, QueryClient } from "@tanstack/react-query";
import { Effect, Schema } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { jira, session } = vi.hoisted(() => ({ jira: vi.fn(), session: { cloudId: "cloud-a" as string | null } }));
vi.mock("@/lib/jira/client", async (importOriginal) => {
  const { Effect } = await import("effect");
  return {
    ...(await importOriginal<typeof import("./client")>()),
    jira,
    currentSite: Effect.sync(() => (session.cloudId ? { cloudId: session.cloudId, siteName: "Test", siteUrl: "https://jira.test" } : null)),
  };
});

const { JiraApiError } = await import("./client");
const { jiraKeys } = await import("./queries");
const { ISSUE_TITLE_CONCURRENCY, ISSUE_TITLE_STALE_TIME, issueTabMetadataKeys, issueTabTitleQuery, newestSummary, NO_SUMMARY, reusableSummary } =
  await import("./issue-tab-metadata");

const ACCOUNT_A = { cloudId: "cloud-a", accountId: "user-a" };
const ACCOUNT_B = { cloudId: "cloud-b", accountId: "user-a" };
const TABS = Array.from({ length: 12 }, (_, index) => `DEMO-${index + 1}`);

type Rule = { delayMs?: number; status?: number; summary?: string };

let client: QueryClient;
let paths: string[];
let open: number;
let peak: number;
let interrupted: number;
let rule: (key: string) => Rule;

const keyOf = (path: string) => decodeURIComponent(new URL(path, "https://jira.test").pathname.split("/")[2] ?? "");
const summaryCalls = (key: string) => paths.filter((path) => keyOf(path) === key).length;

const observe = (scope: typeof ACCOUNT_A | undefined, keys: readonly string[], activeKey?: string) => {
  const observer = new QueriesObserver(
    client,
    keys.map((key) => issueTabTitleQuery(client, scope, key, key === activeKey)),
  );
  const unsubscribe = observer.subscribe(() => undefined);
  const titles = () => observer.getCurrentResult().map((result) => result.data);
  return { titles, unsubscribe };
};

beforeEach(() => {
  client = new QueryClient();
  client.mount();
  paths = [];
  open = 0;
  peak = 0;
  interrupted = 0;
  rule = () => ({});
  session.cloudId = ACCOUNT_A.cloudId;
  client.setQueryData(jiraKeys.site, { cloudId: ACCOUNT_A.cloudId });
  client.setQueryData(jiraKeys.myself, { accountId: ACCOUNT_A.accountId });
  jira.mockReset();
  jira.mockImplementation((path: string, schema: Schema.Decoder<unknown>) =>
    Effect.gen(function* () {
      const key = keyOf(path);
      const { delayMs = 5, status, summary = `Titel ${key}` } = rule(key);
      paths.push(path);
      open++;
      peak = Math.max(peak, open);
      yield* Effect.sleep(delayMs);
      if (status) return yield* new JiraApiError({ status, body: "" });
      return yield* Schema.decodeUnknownEffect(schema)({ key, fields: { summary } });
    }).pipe(
      Effect.onInterrupt(() => Effect.sync(() => interrupted++)),
      Effect.ensuring(Effect.sync(() => open--)),
    ),
  );
});

afterEach(() => {
  client.clear();
  client.unmount();
});

describe("Tab-Titel ohne volle Ticketdetails", () => {
  it("lädt bei zwölf Tabs nur Zusammenfassungen und keinen Titel für das aktive Ticket", async () => {
    const tabs = observe(ACCOUNT_A, TABS, "DEMO-1");
    await vi.waitFor(() => expect(tabs.titles().filter(Boolean)).toHaveLength(11));
    expect(paths).toHaveLength(11);
    expect(paths.every((path) => path.endsWith("?fields=summary"))).toBe(true);
    expect(paths.some((path) => path.includes("*all") || path.includes("expand="))).toBe(false);
    expect(summaryCalls("DEMO-1")).toBe(0);
    expect(tabs.titles()[1]).toBe("Titel DEMO-2");
    tabs.unsubscribe();
  });

  it("schreibt Zusammenfassungen nie in den Detailcache", async () => {
    const tabs = observe(ACCOUNT_A, TABS, "DEMO-1");
    await vi.waitFor(() => expect(tabs.titles().filter(Boolean)).toHaveLength(11));
    for (const key of TABS) expect(client.getQueryData(jiraKeys.issue(key))).toBeUndefined();
    expect(client.getQueryData(issueTabMetadataKeys.title(ACCOUNT_A.cloudId, ACCOUNT_A.accountId, "DEMO-2"))).toBe("Titel DEMO-2");
    tabs.unsubscribe();
  });

  it("hält höchstens vier Titel-Anfragen gleichzeitig offen", async () => {
    rule = () => ({ delayMs: 20 });
    const tabs = observe(ACCOUNT_A, TABS);
    await vi.waitFor(() => expect(tabs.titles().filter(Boolean)).toHaveLength(12));
    expect(ISSUE_TITLE_CONCURRENCY).toBe(4);
    expect(peak).toBe(4);
    tabs.unsubscribe();
  });

  it("bricht laufende und wartende Anfragen beim Schließen ab und gibt die Plätze frei", async () => {
    rule = () => ({ delayMs: 200 });
    const first = observe(ACCOUNT_A, TABS);
    await vi.waitFor(() => expect(paths).toHaveLength(4));
    first.unsubscribe();
    await vi.waitFor(() => expect(interrupted).toBe(4));
    expect(open).toBe(0);

    rule = () => ({ delayMs: 5 });
    const second = observe(ACCOUNT_A, TABS.slice(0, 2));
    await vi.waitFor(() => expect(second.titles()).toEqual(["Titel DEMO-1", "Titel DEMO-2"]));
    expect(paths).toHaveLength(6);
    second.unsubscribe();
  });

  it("trennt Titel nach Instanz und Konto und bricht beim Kontowechsel die alten Anfragen ab", async () => {
    rule = () => ({ delayMs: 200 });
    const before = observe(ACCOUNT_A, TABS);
    await vi.waitFor(() => expect(paths).toHaveLength(4));
    before.unsubscribe();

    rule = (key) => ({ delayMs: 5, summary: `Konto B ${key}` });
    session.cloudId = ACCOUNT_B.cloudId;
    client.setQueryData(jiraKeys.site, { cloudId: ACCOUNT_B.cloudId });
    client.setQueryData(jiraKeys.myself, { accountId: ACCOUNT_B.accountId });
    const after = observe(ACCOUNT_B, ["DEMO-1"]);
    await vi.waitFor(() => expect(after.titles()).toEqual(["Konto B DEMO-1"]));
    await vi.waitFor(() => expect(interrupted).toBe(4));
    expect(client.getQueryData(issueTabMetadataKeys.title(ACCOUNT_A.cloudId, ACCOUNT_A.accountId, "DEMO-1"))).toBeUndefined();
    expect(issueTabMetadataKeys.title("cloud-a", "user-a", "DEMO-1")).not.toEqual(issueTabMetadataKeys.title("cloud-a", "user-b", "DEMO-1"));
    after.unsubscribe();
  });

  it("verwirft laufende Titel und startet wartende Titel nach einem Kontowechsel derselben Instanz nicht", async () => {
    rule = () => ({ delayMs: 100 });
    const before = observe(ACCOUNT_A, TABS);
    await vi.waitFor(() => expect(paths).toHaveLength(4));
    const other = { ...ACCOUNT_A, accountId: "user-b" };
    client.setQueryData(jiraKeys.myself, { accountId: other.accountId });
    await vi.waitFor(() => expect(client.isFetching()).toBe(0));
    expect(paths).toHaveLength(4);
    expect(before.titles()).toEqual(TABS.map(() => undefined));

    rule = () => ({ summary: "Titel für Konto B" });
    const after = observe(other, ["DEMO-1"]);
    await vi.waitFor(() => expect(after.titles()).toEqual(["Titel für Konto B"]));
    expect(client.getQueryData(issueTabMetadataKeys.title(ACCOUNT_A.cloudId, ACCOUNT_A.accountId, "DEMO-1"))).toBeUndefined();
    expect(paths).toHaveLength(5);
    before.unsubscribe();
    after.unsubscribe();
  });

  it("übernimmt keine gecachten Details in einen Titel-Key des vorherigen Kontos", async () => {
    client.setQueryData(jiraKeys.myself, { accountId: "user-b" });
    client.setQueryData(jiraKeys.issueDetail("DEMO-1", ACCOUNT_A), { fields: { summary: "Titel des neuen Kontos" } });
    const previous = observe(ACCOUNT_A, ["DEMO-1"]);
    await vi.waitFor(() => expect(client.isFetching()).toBe(0));
    expect(previous.titles()).toEqual([undefined]);
    expect(paths).toHaveLength(0);
    previous.unsubscribe();
  });

  it("verwirft Titel, wenn die Sitzung inzwischen zu einer anderen Instanz gehört", async () => {
    const tabs = observe(ACCOUNT_A, ["DEMO-1", "DEMO-2"]);
    await vi.waitFor(() => expect(tabs.titles()).toEqual(["Titel DEMO-1", "Titel DEMO-2"]));
    session.cloudId = ACCOUNT_B.cloudId;
    rule = (key) => ({ summary: `Andere Instanz ${key}` });
    await client.invalidateQueries({ queryKey: jiraKeys.issue("DEMO-1") });
    expect(paths).toHaveLength(2);
    expect(tabs.titles()).toEqual(["Titel DEMO-1", "Titel DEMO-2"]);

    session.cloudId = ACCOUNT_A.cloudId;
    rule = (key) => ({ delayMs: 50, summary: `Spät ${key}` });
    const pending = client.invalidateQueries({ queryKey: jiraKeys.issue("DEMO-2") });
    await vi.waitFor(() => expect(paths).toHaveLength(3));
    session.cloudId = ACCOUNT_B.cloudId;
    await pending;
    expect(tabs.titles()[1]).toBe("Titel DEMO-2");
    tabs.unsubscribe();
  });

  it("lädt ohne Sitzung nichts", async () => {
    const tabs = observe(undefined, TABS);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(paths).toHaveLength(0);
    tabs.unsubscribe();
  });

  it("lädt nach einer Ticketänderung genau diesen Titel neu", async () => {
    const tabs = observe(ACCOUNT_A, TABS, "DEMO-1");
    await vi.waitFor(() => expect(tabs.titles().filter(Boolean)).toHaveLength(11));
    rule = (key) => ({ summary: key === "DEMO-3" ? "Neuer Titel" : `Titel ${key}` });
    await client.invalidateQueries({ queryKey: jiraKeys.issue("DEMO-3") });
    await vi.waitFor(() => expect(tabs.titles()[2]).toBe("Neuer Titel"));
    expect(paths).toHaveLength(12);
    expect(summaryCalls("DEMO-3")).toBe(2);
    expect(summaryCalls("DEMO-1")).toBe(0);
    tabs.unsubscribe();
  });

  it("verwendet einen frischen Titel aus dem Detailcache ohne Abruf", async () => {
    client.setQueryData(jiraKeys.issueDetail("DEMO-5", ACCOUNT_A), { key: "DEMO-5", fields: { summary: "Aus den Details" } });
    const tabs = observe(ACCOUNT_A, ["DEMO-5"]);
    await vi.waitFor(() => expect(tabs.titles()).toEqual(["Aus den Details"]));
    expect(paths).toHaveLength(0);
    tabs.unsubscribe();
  });

  it("lädt nach einem Wechsel des aktiven Tabs keinen Titel für das gerade geladene Ticket", async () => {
    const active = observe(ACCOUNT_A, ["DEMO-1"], "DEMO-1");
    client.setQueryData(jiraKeys.issueDetail("DEMO-1", ACCOUNT_A), { key: "DEMO-1", fields: { summary: "Aktiv geladen" } });
    active.unsubscribe();
    const inactive = observe(ACCOUNT_A, ["DEMO-1"], "DEMO-3");
    await vi.waitFor(() => expect(inactive.titles()).toEqual(["Aktiv geladen"]));
    expect(paths).toHaveLength(0);
    inactive.unsubscribe();
  });

  it("fragt nach Invalidierung trotz vorhandener Details die Zusammenfassung neu ab", async () => {
    client.setQueryData(jiraKeys.issueDetail("DEMO-5", ACCOUNT_A), { key: "DEMO-5", fields: { summary: "Alter Titel" } });
    const tabs = observe(ACCOUNT_A, ["DEMO-5"]);
    await vi.waitFor(() => expect(tabs.titles()).toEqual(["Alter Titel"]));
    rule = () => ({ summary: "Neuer Titel" });
    await client.invalidateQueries({ queryKey: jiraKeys.issue("DEMO-5") });
    await vi.waitFor(() => expect(tabs.titles()).toEqual(["Neuer Titel"]));
    expect(paths).toEqual(["/issue/DEMO-5?fields=summary"]);
    expect(client.getQueryData(jiraKeys.issueDetail("DEMO-5", ACCOUNT_A))).toEqual({ key: "DEMO-5", fields: { summary: "Alter Titel" } });
    tabs.unsubscribe();
  });

  it("verwendet keine veralteten oder fremd geformten Detaildaten", () => {
    const now = 1_000_000;
    const state = (data: unknown, age: number, isInvalidated = false) => ({ data, dataUpdatedAt: now - age, isInvalidated });
    const detail = { fields: { summary: "Titel" } };
    expect(reusableSummary(state(detail, 1000), now)).toBe("Titel");
    expect(reusableSummary(state(detail, ISSUE_TITLE_STALE_TIME), now)).toBeUndefined();
    expect(reusableSummary(state(detail, 1000, true), now)).toBeUndefined();
    expect(reusableSummary(state({ fields: {} }, 1000), now)).toBeUndefined();
    expect(reusableSummary(undefined, now)).toBeUndefined();
  });

  it("fragt fehlgeschlagene Titel weder erneut noch beim Fokus ab", async () => {
    rule = () => ({ status: 503 });
    const tabs = observe(ACCOUNT_A, TABS, "DEMO-1");
    await vi.waitFor(() => expect(paths).toHaveLength(11));
    await new Promise((resolve) => setTimeout(resolve, 50));
    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(paths).toHaveLength(11);
    expect(tabs.titles().every((title) => title === undefined)).toBe(true);
    focusManager.setFocused(undefined);
    tabs.unsubscribe();
  });
});

describe("newestSummary", () => {
  it("nimmt den jüngeren Titel und bevorzugt bei Gleichstand die Details", () => {
    expect(newestSummary({ summary: "Alt", updatedAt: 1 }, { summary: "Neu", updatedAt: 2 })).toBe("Neu");
    expect(newestSummary({ summary: "Neu", updatedAt: 3 }, { summary: "Alt", updatedAt: 2 })).toBe("Neu");
    expect(newestSummary({ summary: "Titel", updatedAt: 2 }, { summary: "Details", updatedAt: 2 })).toBe("Details");
  });

  it("fällt auf die vorhandene Quelle zurück und bleibt sonst leer", () => {
    expect(newestSummary({ summary: "Titel", updatedAt: 1 }, NO_SUMMARY)).toBe("Titel");
    expect(newestSummary(NO_SUMMARY, { summary: "Details", updatedAt: 1 })).toBe("Details");
    expect(newestSummary(NO_SUMMARY, NO_SUMMARY)).toBeUndefined();
  });
});
