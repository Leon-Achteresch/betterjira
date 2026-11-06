import { useMutation, useMutationState, useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect, Schema } from "effect";
import { withFavourite } from "@/lib/filter-overview";
import { jiraKeys, useJiraSite, type JiraFilter } from "@/lib/jira/queries";
import {
  createFilter,
  deleteFilter,
  fetchFilter,
  setFilterFavourite,
  updateFilter,
  type FilterInput,
  type JiraFilterDetail,
} from "@/lib/jira/search";

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

const FavouriteChange = Schema.Struct({ id: Schema.String, favourite: Schema.Boolean });
const isFavouriteChange = Schema.is(FavouriteChange);

export type FilterFavouriteChange = typeof FavouriteChange.Type;

export const useFilterFavourite = () => {
  const queryClient = useQueryClient();
  const apply = ({ id, favourite }: FilterFavouriteChange) => {
    queryClient.setQueryData<readonly JiraFilter[]>(jiraKeys.filters, (filters) => filters && withFavourite(filters, id, favourite));
    queryClient.setQueryData<JiraFilterDetail>(jiraKeys.filter(id), (filter) => filter && { ...filter, favourite });
  };
  return useMutation({
    mutationKey: jiraKeys.filterFavourite,
    mutationFn: ({ id, favourite }: FilterFavouriteChange) => Effect.runPromise(setFilterFavourite(id, favourite)),
    onMutate: async (change) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: jiraKeys.filters }),
        queryClient.cancelQueries({ queryKey: jiraKeys.filter(change.id) }),
      ]);
      apply(change);
    },
    onError: (_, change) => apply({ id: change.id, favourite: !change.favourite }),
    onSettled: (_, __, { id }) =>
      Promise.all([jiraKeys.filters, jiraKeys.filter(id)].map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
};

const pendingFavourite = (id: string) => ({
  mutationKey: jiraKeys.filterFavourite,
  status: "pending" as const,
  predicate: ({ state }: { state: { variables: unknown } }) => isFavouriteChange(state.variables) && state.variables.id === id,
});

export const useFilterFavouritePending = () => {
  const queryClient = useQueryClient();
  const ids = useMutationState({
    filters: { mutationKey: jiraKeys.filterFavourite, status: "pending" },
    select: ({ state }) => (isFavouriteChange(state.variables) ? state.variables.id : ""),
  });
  return { ids, isPending: (id: string) => queryClient.isMutating(pendingFavourite(id)) > 0 };
};
