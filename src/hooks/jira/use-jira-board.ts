import { useMemo } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useJiraSite } from "./use-jira";
import { boardQuery } from "@/lib/jira/board-query";
import { boardGroups, type BoardIdentity } from "@/lib/jira/board";
import { useLoadMoreOnIntersection } from "@/hooks/use-load-more-on-intersection";

export const useJiraBoard = (board: BoardIdentity, sprintId?: number, enabled = true) => {
  const site = useJiraSite();
  const client = useQueryClient();
  const query = useInfiniteQuery({
    ...boardQuery(client, board, sprintId),
    enabled: !!site.data && enabled,
  });
  const data = useMemo(() => query.data ? boardGroups(query.data) : undefined, [query.data]);
  const loadMore = () => { if (!query.isFetching) void query.fetchNextPage({ cancelRefetch: false }); };
  const sentinelRef = useLoadMoreOnIntersection(enabled && query.hasNextPage && !query.isFetching && !query.error, loadMore);
  return { ...query, data, sentinelRef, loadMore };
};
