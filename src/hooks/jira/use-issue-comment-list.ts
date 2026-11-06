import { useQuery } from "@tanstack/react-query";
import { Effect } from "effect";
import { commentList } from "@/lib/jira/comments";
import { jiraKeys, useJiraSite } from "@/lib/jira/queries";

export const useIssueCommentList = (issueKey: string) => {
  const site = useJiraSite();
  return useQuery({
    queryKey: jiraKeys.comments(issueKey),
    queryFn: ({ signal }) => Effect.runPromise(commentList(issueKey), { signal }),
    enabled: !!site.data,
  });
};
