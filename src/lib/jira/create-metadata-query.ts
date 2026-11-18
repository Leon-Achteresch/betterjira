import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { Data, Effect } from "effect";
import { canCreateIssues, createFields, createIssueTypes } from "./create-issue";
import { planFields } from "./create-issue-form";
import { jiraKeys } from "./keys";
import { jiraQueryScopeMatches, jiraRequestScope, withJiraQueryScope, type JiraQueryScope } from "./query-scope";

export const createPermissionQuery = (client: QueryClient, projectId: string, scope: JiraQueryScope | undefined) => queryOptions({
  queryKey: jiraKeys.createPermissionScoped(projectId, scope),
  queryFn: ({ signal }) => Effect.runPromise(withJiraQueryScope(client, scope, canCreateIssues(projectId, scope ? jiraRequestScope(client, scope) : undefined)), { signal }),
  staleTime: 0, retry: false,
});

export const createTypesQuery = (client: QueryClient, projectId: string, scope: JiraQueryScope | undefined) => queryOptions({
  queryKey: jiraKeys.createIssueTypesScoped(projectId, scope),
  queryFn: ({ signal }) => Effect.runPromise(withJiraQueryScope(client, scope, createIssueTypes(projectId, scope ? jiraRequestScope(client, scope) : undefined)), { signal }),
  staleTime: 0, retry: false,
});

export const createFieldsQuery = (client: QueryClient, projectId: string, typeId: string, scope: JiraQueryScope | undefined) => queryOptions({
  queryKey: jiraKeys.createFieldsScoped(projectId, typeId, scope),
  queryFn: ({ signal }) => Effect.runPromise(withJiraQueryScope(client, scope, createFields(projectId, typeId, scope ? jiraRequestScope(client, scope) : undefined)), { signal }),
  staleTime: 0, retry: false,
});

export class TemplateTargetError extends Data.TaggedError("TemplateTargetError")<{ message: string }> {}

export const freshTemplateTarget = async (client: QueryClient, scope: JiraQueryScope | undefined, target: {
  projectId: string; issueTypeId: string; parentKey?: string;
}) => {
  if (!jiraQueryScopeMatches(client, scope)) throw new TemplateTargetError({ message: "Das Jira-Konto hat sich geändert. Wähle die Vorlage im aktuellen Konto erneut." });
  if (!await client.fetchQuery(createPermissionQuery(client, target.projectId, scope))) throw new TemplateTargetError({ message: "Im Zielprojekt fehlt die Berechtigung zum Erstellen. Die Vorlage wurde nicht angewendet." });
  const types = await client.fetchQuery(createTypesQuery(client, target.projectId, scope));
  if (!types.some((type) => type.id === target.issueTypeId && !!type.subtask === !!target.parentKey)) throw new TemplateTargetError({ message: "Der gewählte Vorgangstyp ist im Zielprojekt nicht mehr verfügbar. Bitte erneut wählen." });
  const fields = await client.fetchQuery(createFieldsQuery(client, target.projectId, target.issueTypeId, scope));
  if (!fields.some((field) => field.fieldId === "summary")) throw new TemplateTargetError({ message: "Die Zielmetadaten enthalten kein Titelfeld. Die Vorlage wurde nicht angewendet; lade die Zielangaben erneut." });
  const plan = planFields(fields, target.parentKey);
  if (plan.blocked.length) throw new TemplateTargetError({ message: "Die aktuellen Pflichtfelder lassen sich hier nicht vollständig ausfüllen. Die Vorlage wurde nicht angewendet." });
  return { ...target, plan };
};
