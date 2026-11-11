import { useQuery } from "@tanstack/react-query";
import { Effect } from "effect";
import { usablePermissions } from "@/lib/jira/comment-permissions";
import { commentPermissions } from "@/lib/jira/comments";
import { jiraKeys, useJiraSite } from "@/lib/jira/queries";

const PERMISSIONS_STALE_MS = 5 * 60_000;

export const useCommentPermissions = (issueKey: string) => {
  const site = useJiraSite();
  const query = useQuery({
    queryKey: jiraKeys.commentPermissions(issueKey),
    queryFn: ({ signal }) => Effect.runPromise(commentPermissions(issueKey), { signal }),
    enabled: !!site.data,
    staleTime: PERMISSIONS_STALE_MS,
  });
  return usablePermissions(query.data, query.isError);
};
