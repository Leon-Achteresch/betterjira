import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import {
  addComment,
  addWorklog,
  attachmentImage,
  editIssue,
  editIssueWiki,
  uploadAttachments,
  wikiField,
} from "@/lib/jira/issue";
import { jiraKeys, useJiraSite } from "@/lib/jira/queries";
import { invalidateIssueChange } from "@/lib/jira/mutation-cache";
import { patchBoardIssue, rollbackBoardPatches } from "@/lib/jira/board-cache";
import { deduplicateMutation } from "@/lib/jira/deduplicate-mutation";

const useIssueMutation = <A>(
  key: string,
  operation: string,
  run: (input: A) => Effect.Effect<unknown, unknown>,
  affectsLists = false,
  optimistic?: (input: A) => Record<string, unknown>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: A) => operation === "attachments"
      ? Effect.runPromise(run(input))
      : deduplicateMutation(queryClient, JSON.stringify([key, operation, input]), () => Effect.runPromise(run(input))),
    onMutate: async (input) => {
      if (!optimistic) return [];
      await queryClient.cancelQueries({ queryKey: jiraKeys.allBoards });
      return patchBoardIssue(queryClient, key, optimistic(input));
    },
    onError: (_error, _input, patches) => rollbackBoardPatches(queryClient, patches ?? []),
    onSuccess: () => invalidateIssueChange(queryClient, key, affectsLists),
  });
};

export const useJiraEditIssue = (key: string) =>
  useIssueMutation(key, "edit", (fields: Record<string, unknown>) =>
    editIssue(key, fields), true, (fields) => fields,
  );

export const useJiraAddComment = (key: string) =>
  useIssueMutation(key, "comment", (body: string) => addComment(key, body));

export const useJiraAddWorklog = (key: string) =>
  useIssueMutation(
    key,
    "worklog",
    (worklog: { timeSpent: string; started: string; comment?: string }) =>
      addWorklog(key, worklog),
  );

export const useJiraUploadAttachments = (key: string) =>
  useIssueMutation(key, "attachments", (files: File[]) => uploadAttachments(key, files));

export const useJiraAttachmentImage = (
  id: string,
  variant: "thumbnail" | "content",
) => {
  const site = useJiraSite();
  return useQuery({
    queryKey: jiraKeys.attachment(variant, id),
    queryFn: ({ signal }) =>
      Effect.runPromise(attachmentImage(id, variant), { signal }),
    enabled: !!site.data,
    staleTime: Infinity,
    retry: false,
  });
};

export const useJiraEditIssueWiki = (key: string) =>
  useIssueMutation(key, "wiki", (fields: Record<string, string>) =>
    editIssueWiki(key, fields), true,
  );

export const useJiraWikiField = (key: string, field: string) =>
  useQuery({
    queryKey: jiraKeys.wiki(key, field),
    queryFn: ({ signal }) =>
      Effect.runPromise(wikiField(key, field), { signal }),
    staleTime: 0,
    gcTime: 0,
  });
