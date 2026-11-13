import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { canCreateIssues, createFields, createIssue, createIssueTypes, type CreateIssuePayload } from "@/lib/jira/create-issue";
import { jiraKeys, useJiraSite } from "@/lib/jira/queries";
import { useJiraQueryScope } from "@/hooks/jira/use-jira-query-scope";
import { jiraQueryScopeMatches, jiraRequestScope, withJiraQueryScope, type JiraQueryScope } from "@/lib/jira/query-scope";

export const useCreatePermission = (projectId: string | undefined) => {
  const site = useJiraSite();
  return useQuery({
    queryKey: jiraKeys.createPermission(projectId ?? ""),
    queryFn: ({ signal }) => Effect.runPromise(canCreateIssues(projectId!), { signal }),
    enabled: !!site.data && !!projectId,
  });
};

export const useCreateIssueTypes = (projectId: string | undefined, enabled: boolean) => {
  const site = useJiraSite();
  return useQuery({
    queryKey: jiraKeys.createIssueTypes(projectId ?? ""),
    queryFn: ({ signal }) => Effect.runPromise(createIssueTypes(projectId!), { signal }),
    enabled: !!site.data && !!projectId && enabled,
  });
};

export const useCreateFields = (projectId: string | undefined, issueTypeId: string | undefined) => {
  const site = useJiraSite();
  return useQuery({
    queryKey: jiraKeys.createFields(projectId ?? "", issueTypeId ?? ""),
    queryFn: ({ signal }) => Effect.runPromise(createFields(projectId!, issueTypeId!), { signal }),
    enabled: !!site.data && !!projectId && !!issueTypeId,
  });
};

export const useCreateIssue = () => {
  const queryClient = useQueryClient();
  const { scope } = useJiraQueryScope();
  const mutation = useMutation({
    mutationKey: ["jira", "create-issue"],
    mutationFn: (job: { payload: CreateIssuePayload; scope: JiraQueryScope | undefined }) => Effect.runPromise(withJiraQueryScope(queryClient, job.scope, createIssue(job.payload, job.scope ? jiraRequestScope(queryClient, job.scope) : undefined))),
    retry: false,
    onSuccess: (_, job) => {
      if (!jiraQueryScopeMatches(queryClient, job.scope)) return;
      for (const queryKey of [jiraKeys.allIssues, jiraKeys.myWork, jiraKeys.allBoards, jiraKeys.allProjectStats])
        void queryClient.invalidateQueries({ queryKey });
      const parent = job.payload.fields.parent;
      if (typeof parent === "object" && parent !== null && "key" in parent && typeof parent.key === "string")
        void queryClient.invalidateQueries({ queryKey: jiraKeys.issueDetail(parent.key, job.scope) });
    },
  });
  return {
    ...mutation,
    error: mutation.variables && jiraQueryScopeMatches(queryClient, mutation.variables.scope) ? mutation.error : null,
    mutateAsync: (payload: CreateIssuePayload) => mutation.mutateAsync({ payload, scope }),
  };
};
