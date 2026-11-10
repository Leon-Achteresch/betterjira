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
import {
  commentPageKeys,
  withEditedPostedComment,
  withoutPostedComment,
  withPostedComment,
  type JiraComment,
} from "@/lib/jira/comment-pages";
import type { CommentEditPayload, IssueComment } from "@/lib/jira/comment-thread";
import { deleteComment, postComment, postReply, updateComment } from "@/lib/jira/comments";
import { jiraKeys, useJiraMyself, useJiraSite } from "@/lib/jira/queries";
import { invalidateIssueChange } from "@/lib/jira/mutation-cache";
import { patchBoardIssue, rollbackBoardPatches } from "@/lib/jira/board-cache";
import { deduplicateMutation } from "@/lib/jira/deduplicate-mutation";

const useIssueMutation = <A>(
  key: string,
  operation: string,
  run: (input: A) => Effect.Effect<unknown, unknown>,
  affectsLists = false,
  optimistic?: (input: A) => Record<string, unknown>,
  settled?: (input: A) => void,
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
    onSuccess: (_result, input) => {
      settled?.(input);
      invalidateIssueChange(queryClient, key, affectsLists);
    },
  });
};

export const useJiraEditIssue = (key: string) =>
  useIssueMutation(key, "edit", (fields: Record<string, unknown>) =>
    editIssue(key, fields), true, (fields) => fields,
  );

const usePostedComments = (key: string) => {
  const queryClient = useQueryClient();
  const site = useJiraSite();
  const myself = useJiraMyself();
  const cloudId = site.data?.cloudId;
  const accountId = myself.data?.accountId;
  return (update: (posted: readonly JiraComment[] | undefined) => JiraComment[]) => {
    if (cloudId && accountId) queryClient.setQueryData<JiraComment[]>(commentPageKeys.posted(cloudId, accountId, key), update);
  };
};

const useCommentMutation = <A>(key: string, run: (input: A) => Effect.Effect<IssueComment, unknown>) => {
  const queryClient = useQueryClient();
  const updatePosted = usePostedComments(key);
  return useMutation({
    mutationFn: (input: A) => Effect.runPromise(run(input)),
    onSuccess: (created) => {
      updatePosted((posted) => withPostedComment(posted, created));
      invalidateIssueChange(queryClient, key, false);
    },
  });
};

export const useJiraPostComment = (key: string) => useCommentMutation(key, (body: AdfNode) => postComment(key, body));

export const useJiraPostReply = (key: string) =>
  useCommentMutation(key, ({ body, threadKey }: { body: AdfNode; threadKey: string }) => postReply(key, body, threadKey));

export const useJiraUpdateComment = (key: string) => {
  const updatePosted = usePostedComments(key);
  return useIssueMutation(
    key,
    "comment-edit",
    ({ id, payload }: { id: string; payload: CommentEditPayload }) => updateComment(key, id, payload),
    false,
    undefined,
    ({ id, payload }) => updatePosted((posted) => withEditedPostedComment(posted, id, payload.body, new Date().toISOString())),
  );
};

export const useJiraDeleteComment = (key: string) => {
  const updatePosted = usePostedComments(key);
  return useIssueMutation(key, "comment-delete", (id: string) => deleteComment(key, id), false, undefined, (id) =>
    updatePosted((posted) => withoutPostedComment(posted, id)),
  );
};

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
