import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect, Schema } from "effect";
import { jira, jiraImage, jiraSend } from "./client";
import { jiraKeys, useJiraSite } from "./queries";

const issuePath = (key: string) => `/issue/${encodeURIComponent(key)}`;

const json = (method: string, body: unknown) => ({ method, body: JSON.stringify(body) });

const useIssueMutation = <A>(key: string, run: (input: A) => Effect.Effect<unknown, unknown>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: A) => Effect.runPromise(run(input)),
    onSuccess: () =>
      Promise.all(
        [jiraKeys.issue(key), jiraKeys.myWork, ["jira", "issues"], ["jira", "board"]].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey }),
        ),
      ),
  });
};

export const useJiraEditIssue = (key: string) =>
  useIssueMutation(key, (fields: Record<string, unknown>) => jiraSend(issuePath(key), json("PUT", { fields })));

export const useJiraAddComment = (key: string) =>
  useIssueMutation(key, (body: string) => jiraSend(`${issuePath(key)}/comment`, json("POST", { body }), "api/2"));

export const useJiraAddWorklog = (key: string) =>
  useIssueMutation(key, (worklog: { timeSpent: string; started: string; comment?: string }) =>
    jiraSend(`${issuePath(key)}/worklog`, json("POST", worklog), "api/2"),
  );

export const useJiraUploadAttachments = (key: string) =>
  useIssueMutation(key, (files: File[]) => {
    const form = new FormData();
    for (const file of files) form.append("file", file);
    return jiraSend(`${issuePath(key)}/attachments`, {
      method: "POST",
      body: form,
      headers: { "X-Atlassian-Token": "no-check" },
    });
  });

export const useJiraAttachmentImage = (id: string, variant: "thumbnail" | "content") => {
  const site = useJiraSite();
  return useQuery({
    queryKey: ["jira", "attachment", variant, id],
    queryFn: ({ signal }) => Effect.runPromise(jiraImage(`/attachment/${variant}/${id}?redirect=false`), { signal }),
    enabled: !!site.data,
    staleTime: Infinity,
    retry: false,
  });
};

export const useJiraEditIssueWiki = (key: string) =>
  useIssueMutation(key, (fields: Record<string, string>) => jiraSend(issuePath(key), json("PUT", { fields }), "api/2"));

const WikiFields = Schema.Struct({ fields: Schema.Record(Schema.String, Schema.NullOr(Schema.Unknown)) });

export const useJiraWikiField = (key: string, field: string) =>
  useQuery({
    queryKey: ["jira", "wiki", key, field],
    queryFn: ({ signal }) =>
      Effect.runPromise(jira(`${issuePath(key)}?fields=${encodeURIComponent(field)}`, WikiFields, undefined, "api/2"), { signal }).then(
        ({ fields }) => (typeof fields[field] === "string" ? fields[field] : ""),
      ),
    staleTime: 0,
    gcTime: 0,
  });
