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

const useInvalidateFilter = () => {
  const queryClient = useQueryClient();
  return (id?: string) =>
    Promise.all(
      [jiraKeys.filters, ["jira", "issues"], ...(id ? [jiraKeys.filter(id)] : [])].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    );
};

export const useUpdateFilter = () => {
  const invalidate = useInvalidateFilter();
  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: FilterInput }) => Effect.runPromise(updateFilter(id, fields)),
    onSuccess: (_filter, { id }) => invalidate(id),
  });
};

export const useCreateFilter = () => {
  const invalidate = useInvalidateFilter();
  return useMutation({
    mutationFn: (input: FilterInput) => Effect.runPromise(createFilter(input)),
    onSuccess: () => invalidate(),
  });
};

export const useDeleteFilter = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => Effect.runPromise(deleteFilter(id)),
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: jiraKeys.filter(id) });
      return queryClient.invalidateQueries({ queryKey: jiraKeys.filters });
    },
  });
};

export const useFilterFavourite = () => {
  const invalidate = useInvalidateFilter();
  return useMutation({
    mutationFn: ({ id, favourite }: { id: string; favourite: boolean }) => Effect.runPromise(setFilterFavourite(id, favourite)),
    onSuccess: (_result, { id }) => invalidate(id),
  });
};
