import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { jiraKeys, useJiraSite } from "@/lib/jira/queries";
import { createFilter, deleteFilter, fetchFilter, setFilterFavourite, updateFilter, type FilterInput } from "@/lib/jira/search";

export const useJiraFilter = (id: string) => {
  const site = useJiraSite();
  return useQuery({
    queryKey: jiraKeys.filter(id),
    queryFn: ({ signal }) => Effect.runPromise(fetchFilter(id), { signal }),
    enabled: !!site.data,
  });
};

const useInvalidateFilter = (id?: string) => {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      [jiraKeys.filters, ["jira", "issues"], ...(id ? [jiraKeys.filter(id)] : [])].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );
};

export const useUpdateFilter = (id: string) => {
  const invalidate = useInvalidateFilter(id);
  return useMutation({
    mutationFn: (input: FilterInput) => Effect.runPromise(updateFilter(id, input)),
    onSuccess: invalidate,
  });
};

export const useCreateFilter = () => {
  const invalidate = useInvalidateFilter();
  return useMutation({
    mutationFn: (input: FilterInput) => Effect.runPromise(createFilter(input)),
    onSuccess: invalidate,
  });
};

export const useDeleteFilter = (id: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => Effect.runPromise(deleteFilter(id)),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: jiraKeys.filter(id) });
      return queryClient.invalidateQueries({ queryKey: jiraKeys.filters });
    },
  });
};

export const useFilterFavourite = (id: string) => {
  const invalidate = useInvalidateFilter(id);
  return useMutation({
    mutationFn: (favourite: boolean) => Effect.runPromise(setFilterFavourite(id, favourite)),
    onSuccess: invalidate,
  });
};
