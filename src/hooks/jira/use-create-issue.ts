import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { canCreateIssues, createFields, createIssue, createIssueTypes, type CreateIssuePayload } from "@/lib/jira/create-issue";
import { jiraKeys, useJiraSite } from "@/lib/jira/queries";

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
  return useMutation({
    mutationKey: ["jira", "create-issue"],
    mutationFn: (payload: CreateIssuePayload) => Effect.runPromise(createIssue(payload)),
    retry: false,
    onSuccess: () => {
      for (const queryKey of [jiraKeys.allIssues, jiraKeys.myWork, jiraKeys.allBoards, jiraKeys.allProjectStats])
        void queryClient.invalidateQueries({ queryKey });
    },
  });
};
