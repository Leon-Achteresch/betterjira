import type { HTMLAttributes, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Effect, Schema } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../../../tests/jira/fixtures/template-target.json";
import type { CreationWorkspace } from "@/lib/jira/create-issue-drafts";

const mock = vi.hoisted(() => {
  const data = new Map<string, string>();
  const localStorage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) };
  vi.stubGlobal("window", { localStorage });
  return { permission: vi.fn(), types: vi.fn(), fields: vi.fn(), success: vi.fn(), create: vi.fn(), reset: vi.fn(), search: vi.fn() };
});
vi.mock("@tanstack/react-router", async (original) => ({ ...await original<typeof import("@tanstack/react-router")>(), useNavigate: () => vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: mock.success, error: vi.fn() } }));
vi.mock("@/lib/jira/client", async (original) => ({ ...await original<typeof import("@/lib/jira/client")>(), currentSite: Effect.succeed({ cloudId: "site-a" }) }));
vi.mock("@/lib/jira/search", async (original) => ({ ...await original<typeof import("@/lib/jira/search")>(), searchIssues: mock.search }));
vi.mock("@/lib/jira/create-issue", async (original) => ({ ...await original<typeof import("@/lib/jira/create-issue")>(), canCreateIssues: mock.permission, createIssueTypes: mock.types, createFields: mock.fields }));
vi.mock("@/lib/jira/queries", async (original) => ({
  ...await original<typeof import("@/lib/jira/queries")>(),
  useJiraSite: () => ({ data: { cloudId: "site-a", siteUrl: "https://jira.test", siteName: "Test-Site" }, isSuccess: true }),
  useJiraMyself: () => ({ data: { accountId: "account-a", displayName: "Testkonto" }, isSuccess: true }),
  useJiraProjects: () => ({ data: [{ id: "target", key: "TARGET", name: "Ziel" }, { id: "source", key: "SOURCE", name: "Quelle" }], isPending: false, error: null }),
}));
vi.mock("./use-create-issue-parent", () => ({ useCreateIssueParent: () => ({ data: undefined, isPending: false, error: null }) }));
vi.mock("./use-create-issue-drafts", async (original) => {
  const actual = await original<typeof import("./use-create-issue-drafts")>();
  return { ...actual, useCreateIssueDrafts: () => ({
    id: account,
    workspace: actual.useCreationStore.getState().workspaces[account],
    update: (id: string, transform: (workspace: CreationWorkspace) => CreationWorkspace) => actual.useCreationStore.getState().update(id, transform),
  }) };
});
vi.mock("./use-create-issue", () => ({
  useCreateIssue: () => ({ error: null, reset: mock.reset, mutateAsync: mock.create }),
  useCreatePermission: () => ({ data: true, isPending: false, error: null }),
  useCreateIssueTypes: () => ({ data: [{ id: "target-type", name: "Task" }], isPending: false, error: null }),
  useCreateFields: () => ({ data: offeredFields, isPending: false, error: null }),
}));
vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("motion/react", async (original) => ({
  ...await original<typeof import("motion/react")>(),
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: { div: ({ initial: _initial, animate: _animate, exit: _exit, transition: _transition, ...props }: HTMLAttributes<HTMLDivElement> & { initial?: unknown; animate?: unknown; exit?: unknown; transition?: unknown }) => <div {...props} /> },
}));

const { useCreateIssueForm } = await import("./use-create-issue-form");
const { useCreationStore: store } = await import("./use-create-issue-drafts");
const { IssueTemplate, creationFieldScope, EMPTY_CREATION_WORKSPACE } = await import("@/lib/jira/create-issue-drafts");
const { CreateField } = await import("@/lib/jira/create-issue");
const { TemplateApplicationNotice } = await import("@/components/create-issue/template-application-notice");
const { jiraKeys } = await import("@/lib/jira/keys");
const { workspaceId } = await import("@/lib/workspace");
const { TemplateTargetError } = await import("@/lib/jira/create-metadata-query");
const template = Schema.decodeUnknownSync(IssueTemplate)(fixture.template);
const fields = Schema.decodeUnknownSync(Schema.Array(CreateField))(fixture.fields);
let offeredFields: readonly typeof CreateField.Type[];
const account = workspaceId("site-a", "account-a");
const scope = creationFieldScope("target", "target-type");
let client: QueryClient;
type Form = ReturnType<typeof useCreateIssueForm>;

function Harness({ expose }: { expose: (form: Form) => void }) {
  expose(useCreateIssueForm());
  return null;
}
const mount = () => {
  let result: Form | undefined;
  renderToStaticMarkup(<QueryClientProvider client={client}><Harness expose={(form) => { result = form; }} /></QueryClientProvider>);
  if (!result) throw new Error("form missing");
  return result;
};

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  client.setQueryData(jiraKeys.site, { cloudId: "site-a" });
  client.setQueryData(jiraKeys.myself, { accountId: "account-a" });
  offeredFields = fields;
  mock.permission.mockReset().mockReturnValue(Effect.succeed(true));
  mock.types.mockReset().mockReturnValue(Effect.succeed([{ id: "target-type", name: "Task" }]));
  mock.fields.mockReset().mockReturnValue(Effect.succeed(fields));
  mock.success.mockReset(); mock.create.mockReset(); mock.reset.mockReset();
  mock.search.mockReset().mockReturnValue(Effect.succeed({ issues: [{ id: "hint", key: "TARGET-1", fields: { summary: "Vorhandenes Anliegen", project: { id: "target", key: "TARGET" } } }], isLast: true }));
  store.setState({ workspaces: { [account]: { draft: { projectId: "target", issueTypeId: "target-type", summary: "Eigen", description: null, values: {} }, templates: [template] } } });
});
afterEach(() => client.clear());

describe("projektübergreifende Vorlagen im bestehenden Erstellungsformular", () => {
  it("sucht nur bewusst im aktuellen Erstellziel und bewahrt Entwurf und bestehende Erstellung", async () => {
    offeredFields = fields.filter((field) => field.fieldId === "summary" || field.fieldId === "description");
    const before = store.getState().workspaces[account].draft;
    const form = mount(); expect(mock.search).not.toHaveBeenCalled(); await form.creationHints.start();
    expect(mock.search).toHaveBeenCalledTimes(1); expect(mock.search.mock.calls[0][0]).toContain('project = "target"'); expect(mock.search.mock.calls[0][3]).toBe(10);
    expect(store.getState().workspaces[account].draft).toBe(before); expect(mock.create).not.toHaveBeenCalled();
    form.selectProject("source"); const changed = mount(); expect(changed.creationHints.request?.project.id).toBe("source"); expect(changed.creationHints.result).toBeUndefined();
    expect(store.getState().workspaces[account].draft.summary).toBe(before.summary);
    mock.create.mockResolvedValue({ id: "created", key: "SOURCE-2" }); changed.submit();
    await vi.waitFor(() => expect(mock.create).toHaveBeenCalledTimes(1)); expect(mock.create.mock.calls[0][0].fields.project.id).toBe("source");
  });
  it("bindet Komponenten-Rollenhinweise an die tatsaechliche Auswahl und den Projektkontext ohne Zuweisung", () => {
    offeredFields = [...fields, Schema.decodeUnknownSync(CreateField)({ fieldId: "components", name: "Komponenten", required: true, schema: { type: "array", items: "component", system: "components" }, allowedValues: [{ id: "c1", name: "Backend" }], operations: ["set"] })];
    mount().setValue("components", [{ id: "c1", name: "Backend" }]);
    const form = mount();
    expect(form.componentLeads.visible).toBe(true);
    expect(form.componentLeads.projectLabel).toBe("TARGET");
    expect(form.componentLeads.rows.map((row) => row.id)).toEqual(["c1"]);
    expect(form.componentLeads.open).toBe(false);
    expect(store.getState().workspaces[account].draft.values[scope].assignee).toBeUndefined();
    expect(mock.create).not.toHaveBeenCalled();
    form.selectProject("source");
    const changed = mount();
    expect(changed.componentLeads.projectLabel).toBe("SOURCE");
    expect(changed.componentLeads.visible).toBe(false);
  });
  it("zeigt die fremde Projektvorlage bewusst als Quelle und wendet sie im gewählten Ziel an", async () => {
    const form = mount();
    expect(form.templateGroups.map((group) => group.id)).toEqual(["other"]);
    expect(form.templates[0].sourceLabel).toBe("Quelle · Bug");
    await form.applyTemplate(form.templates[0]);
    const after = store.getState().workspaces[account];
    expect(after.draft).toMatchObject({ projectId: "target", issueTypeId: "target-type", summary: "Aus der Vorlage" });
    expect(after.draft.values[scope].customer).toBe("ACME");
    expect(after.draft.templateReports?.[scope].skipped.some((entry) => entry.fieldId === "status")).toBe(true);
    expect(after.templates[0]).toBe(template);
    expect(mock.create).not.toHaveBeenCalled();
  });

  it("verwendet frisch geladene Feldoptionen statt des veralteten sichtbaren Plans", async () => {
    mock.fields.mockReturnValue(Effect.succeed(fields.map((field) => field.fieldId === "priority" ? { ...field, allowedValues: [{ id: "new", name: "Neu" }] } : field)));
    await mount().applyTemplate(template);
    expect(store.getState().workspaces[account].draft.values[scope]).not.toHaveProperty("priority");
    expect(store.getState().workspaces[account].draft.templateReports?.[scope].skipped).toContainEqual(expect.objectContaining({ fieldId: "priority", value: template.values.priority }));
  });

  it("erhält bei verweigerter Berechtigung und Lesefehler den bestehenden Entwurf exakt", async () => {
    const before = store.getState().workspaces[account].draft;
    mock.permission.mockReturnValue(Effect.succeed(false));
    await mount().applyTemplate(template);
    expect(store.getState().workspaces[account].draft).toBe(before);
    mock.permission.mockReturnValue(Effect.succeed(true));
    mock.fields.mockReturnValue(Effect.fail(new TemplateTargetError({ message: "offline" })));
    await mount().applyTemplate(template);
    expect(store.getState().workspaces[account].draft).toBe(before);
    expect(mock.success).not.toHaveBeenCalled();
  });

  it("ersetzt einen verschwundenen ausdrücklich gewählten Zieltyp auch im Formular nicht still", async () => {
    store.getState().update(account, (workspace) => ({ ...workspace, draft: { ...workspace.draft, issueTypeId: "removed-type" } }));
    const form = mount();
    expect(form.issueType).toBeUndefined();
    expect(form.status).toBe("no-types");
    expect(form.missingIssueType).toBe(true);
    await form.applyTemplate(template);
    expect(mock.permission).not.toHaveBeenCalled();
    expect(store.getState().workspaces[account].draft.issueTypeId).toBe("removed-type");
  });

  it.each(["project", "type", "typing", "template"])("wendet nach Änderung von %s während des Reads nichts an", async (change) => {
    let release: () => void = () => undefined;
    const wait = new Promise<void>((resolve) => { release = resolve; });
    mock.fields.mockReturnValue(Effect.promise(() => wait).pipe(Effect.as(fields)));
    const form = mount();
    const pending = form.applyTemplate(template);
    await vi.waitFor(() => expect(mock.fields).toHaveBeenCalledOnce());
    if (change === "project") form.selectProject("source");
    if (change === "type") form.selectIssueType("other-type");
    if (change === "typing") form.setSummary("Zwischenzeitlich weitergeschrieben");
    if (change === "template") form.removeTemplate(template);
    const current = store.getState().workspaces[account].draft;
    release();
    await pending;
    expect(store.getState().workspaces[account].draft).toBe(current);
    expect(current.templateReports).toBeUndefined();
  });

  it("isoliert Quellen und Anwendung nach Konto und verwirft einen Kontowechsel während des Reads", async () => {
    store.getState().update("other-account", () => ({ ...EMPTY_CREATION_WORKSPACE, templates: [{ ...template, id: "foreign" }] }));
    const form = mount();
    expect(form.templates.map((entry) => entry.id)).toEqual([template.id]);
    mock.fields.mockReturnValue(Effect.sync(() => {
      client.setQueryData(jiraKeys.myself, { accountId: "other" });
      return fields;
    }));
    const before = store.getState().workspaces;
    await form.applyTemplate(template);
    expect(store.getState().workspaces).toBe(before);
    expect(mock.success).not.toHaveBeenCalled();
  });

  it("vertraut übergebenen fremden Vorlagendaten nicht und lädt nur die eigene gespeicherte Quelle", async () => {
    const form = mount();
    await form.applyTemplate({ ...template, id: "foreign", summary: "Nicht übernehmen" });
    expect(mock.permission).not.toHaveBeenCalled();
    await form.applyTemplate({ ...template, summary: "Nicht übernehmen" });
    expect(store.getState().workspaces[account].draft.summary).toBe(template.summary);
  });

  it("sperrt Doppelanwendung und Erstellen während der Prüfung", async () => {
    const form = mount();
    const first = form.applyTemplate(template);
    await form.applyTemplate(template);
    form.submit();
    await first;
    expect(mock.permission).toHaveBeenCalledOnce();
    expect(mock.create).not.toHaveBeenCalled();
    expect(mock.success).toHaveBeenCalledOnce();
  });

  it("zeigt abgelehnte Originalwerte samt Grund dauerhaft aus dem Entwurf", async () => {
    await mount().applyTemplate(template);
    const form = mount();
    const markup = renderToStaticMarkup(<TemplateApplicationNotice report={form.templateReport} />);
    expect(markup).toContain("Altes Quellfeld");
    expect(markup).toContain("unverändert");
    expect(markup).toContain("42");
    expect(markup).toContain("Ziel · Task");
    expect(markup).toContain("nicht zur Eingabe angeboten");
  });

  it("macht die Anwendung lokal rückgängig, ohne zwischenzeitlich weitergeschriebene Eingaben zu überschreiben", async () => {
    const form = mount();
    const before = store.getState().workspaces[account].draft;
    await form.applyTemplate(template);
    const firstToast = mock.success.mock.calls.at(-1)?.[1];
    firstToast.action.onClick();
    expect(store.getState().workspaces[account].draft).toBe(before);
    await mount().applyTemplate(template);
    const secondToast = mock.success.mock.calls.at(-1)?.[1];
    mount().setSummary("Neuere eigene Eingabe");
    const newer = store.getState().workspaces[account].draft;
    secondToast.action.onClick();
    expect(store.getState().workspaces[account].draft).toBe(newer);
  });
});
