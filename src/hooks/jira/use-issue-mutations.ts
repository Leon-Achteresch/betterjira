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

const useIssueMutation = <A>(
  key: string,
  run: (input: A) => Effect.Effect<unknown, unknown>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: A) => Effect.runPromise(run(input)),
    onSuccess: () =>
      Promise.all(
        [
          jiraKeys.issue(key),
          jiraKeys.myWork,
          jiraKeys.allIssues,
          jiraKeys.allBoards,
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ),
  });
};

export const useJiraEditIssue = (key: string) =>
  useIssueMutation(key, (fields: Record<string, unknown>) =>
    editIssue(key, fields),
  );

export const useJiraAddComment = (key: string) =>
  useIssueMutation(key, (body: string) => addComment(key, body));

export const useJiraAddWorklog = (key: string) =>
  useIssueMutation(
    key,
    (worklog: { timeSpent: string; started: string; comment?: string }) =>
      addWorklog(key, worklog),
  );

export const useJiraUploadAttachments = (key: string) =>
  useIssueMutation(key, (files: File[]) => uploadAttachments(key, files));

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
  useIssueMutation(key, (fields: Record<string, string>) =>
    editIssueWiki(key, fields),
  );

export const useJiraWikiField = (key: string, field: string) =>
  useQuery({
    queryKey: jiraKeys.wiki(key, field),
    queryFn: ({ signal }) =>
      Effect.runPromise(wikiField(key, field), { signal }),
    staleTime: 0,
    gcTime: 0,
  });
