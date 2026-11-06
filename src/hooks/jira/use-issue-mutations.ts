import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import {
  addWorklog,
  attachmentImage,
  editIssue,
  editIssueWiki,
  uploadAttachments,
  wikiField,
} from "@/lib/jira/issue";
import type { AdfNode } from "@/lib/jira/adf";
import { deleteComment, postComment, postReply, updateComment } from "@/lib/jira/comments";
import type { CommentEditPayload } from "@/lib/jira/comment-thread";
import { jiraKeys, useJiraSite } from "@/lib/jira/queries";

const useIssueMutation = <A, B>(
  key: string,
  run: (input: A) => Effect.Effect<B, unknown>,
  extraKeys: readonly (readonly unknown[])[] = [],
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: A) => Effect.runPromise(run(input)),
    onSuccess: () =>
      Promise.all(
        [jiraKeys.issue(key), jiraKeys.myWork, jiraKeys.allIssues, jiraKeys.allBoards, ...extraKeys].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  });
};

export const useJiraEditIssue = (key: string) =>
  useIssueMutation(key, (fields: Record<string, unknown>) =>
    editIssue(key, fields),
  );

export const useJiraPostComment = (key: string) =>
  useIssueMutation(key, (body: AdfNode) => postComment(key, body), [jiraKeys.comments(key)]);

export const useJiraPostReply = (key: string) =>
  useIssueMutation(
    key,
    ({ body, threadKey }: { body: AdfNode; threadKey: string }) => postReply(key, body, threadKey),
    [jiraKeys.comments(key)],
  );

export const useJiraUpdateComment = (key: string) =>
  useIssueMutation(
    key,
    ({ id, payload }: { id: string; payload: CommentEditPayload }) => updateComment(key, id, payload),
    [jiraKeys.comments(key)],
  );

export const useJiraDeleteComment = (key: string) =>
  useIssueMutation(key, (id: string) => deleteComment(key, id), [jiraKeys.comments(key)]);

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
