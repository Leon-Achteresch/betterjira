import { Effect, Option, Schema } from "effect";
import { jira, type JiraRequestScope } from "./client";
import type { QueryClient } from "@tanstack/react-query";
import { jiraRequestScope, withJiraQueryScope, type JiraQueryScope } from "./query-scope";
import { jiraKeys } from "./keys";

const SelectedComponent = Schema.Struct({ id: Schema.String, name: Schema.optional(Schema.String) });
const Lead = Schema.Struct({
  displayName: Schema.optional(Schema.String), active: Schema.optional(Schema.Boolean),
  avatarUrls: Schema.optional(Schema.Struct({ "48x48": Schema.optional(Schema.String) })),
});
const Component = Schema.Struct({
  id: Schema.String, name: Schema.String, project: Schema.optional(Schema.String),
  projectId: Schema.optional(Schema.Union([Schema.String, Schema.Int])), lead: Schema.optional(Schema.Unknown),
});
export type ComponentProject = { key: string; id?: string };
export type ComponentSelection = typeof SelectedComponent.Type;
export type ComponentLeadContact = {
  id: string; name: string; status: "visible" | "unavailable" | "unverified" | "error";
  message?: string; person?: { name: string; initials: string; avatarUrl?: string; subtitle: string };
};

export const selectedComponents = (value: unknown) => {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  const decoded = values.map((entry) => Option.getOrUndefined(Schema.decodeUnknownOption(SelectedComponent)(entry)));
  const components = [...new Map(decoded.filter((entry) => entry && entry.id.trim()).map((entry) => [entry!.id, entry!])).values()];
  return { components, invalid: decoded.filter((entry) => !entry || !entry.id.trim()).length };
};

const avatarUrl = (value: string | undefined) => {
  try { return value && new URL(value).protocol === "https:" ? value : undefined; } catch { return undefined; }
};

export const fetchComponentLead = (selected: ComponentSelection, project: ComponentProject, scope: JiraRequestScope) => Effect.gen(function* () {
  if (!scope.isCurrent()) return { id: selected.id, name: selected.name ?? selected.id, status: "error", message: "Kontext nicht bestätigt. Leitung nicht gelesen." } satisfies ComponentLeadContact;
  const component = yield* jira(`/component/${encodeURIComponent(selected.id)}`, Component, { scope, retry: false, cache: "no-store" });
  const matchesKey = component.project?.toUpperCase() === project.key.toUpperCase();
  const matchesId = project.id !== undefined && component.projectId !== undefined && String(component.projectId) === project.id;
  const conflicts = (component.project !== undefined && !matchesKey) || (project.id !== undefined && component.projectId !== undefined && !matchesId);
  if (component.id !== selected.id || conflicts || (!matchesKey && !matchesId))
    return { id: selected.id, name: selected.name ?? selected.id, status: "unverified", message: "Komponente oder Projekt nicht bestätigt. Kein Rollenhinweis übernommen." } satisfies ComponentLeadContact;
  const lead = Option.getOrUndefined(Schema.decodeUnknownOption(Lead)(component.lead));
  const name = lead?.displayName?.trim();
  if (!name) return { id: component.id, name: component.name, status: "unavailable", message: "Keine sichtbare Komponentenleitung geliefert. Sie kann fehlen oder für dieses Konto verborgen sein." } satisfies ComponentLeadContact;
  return {
    id: component.id, name: component.name, status: "visible",
    person: { name, initials: name.split(/\s+/).map((part) => part.charAt(0)).join("").slice(0, 2), avatarUrl: avatarUrl(lead?.avatarUrls?.["48x48"]), subtitle: lead?.active === false ? "Komponentenleitung · Konto inaktiv" : "Hinterlegte Komponentenleitung" },
  } satisfies ComponentLeadContact;
}).pipe(Effect.catch(() => Effect.succeed<ComponentLeadContact>({ id: selected.id, name: selected.name ?? selected.id, status: "error", message: "Komponente oder Leitung nicht lesbar. Berechtigung, Verfügbarkeit oder Projekttyp konnten nicht bestätigt werden." })));

export const fetchComponentLeads = (components: readonly ComponentSelection[], project: ComponentProject, scope: JiraRequestScope) =>
  Effect.forEach(components, (component) => fetchComponentLead(component, project, scope), { concurrency: 3 });

export const componentLeadsQuery = (client: QueryClient, scope: JiraQueryScope | undefined, project: ComponentProject | undefined, components: readonly ComponentSelection[]) => ({
  queryKey: jiraKeys.componentLeads(project, components.map((component) => component.id), scope),
  queryFn: ({ signal }: { signal: AbortSignal }) => Effect.runPromise(withJiraQueryScope(client, scope,
    fetchComponentLeads(components, project ?? { key: "" }, scope ? jiraRequestScope(client, scope) : { cloudId: "", isCurrent: () => false })), { signal }),
  staleTime: 60_000, retry: false,
});
