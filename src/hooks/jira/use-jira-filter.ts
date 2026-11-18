import { useMutation, useMutationState, useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect, Schema } from "effect";
import { withFavourite } from "@/lib/filter-overview";
import { jiraKeys, type JiraFilter } from "@/lib/jira/queries";
import { JiraRequestScopeChanged } from "@/lib/jira/client";
import { filterAccessLost, withFilterAccount, type JiraFilterScope } from "@/lib/jira/saved-filters";
import { filterRequestScope, useJiraFilterScope } from "./use-jira";
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
  const client = useQueryClient();
  const context = useJiraFilterScope();
  const scope = context.scope;
  const query = useQuery({
    queryKey: jiraKeys.filterScoped(id, scope),
    queryFn: ({ signal }) => Effect.runPromise(Effect.suspend(() => {
      if (!scope) return Effect.fail(new JiraRequestScopeChanged());
      const request = filterRequestScope(client, scope);
      return withFilterAccount(scope.accountId, request, fetchFilter(id, request));
    }), { signal }),
    enabled: !!scope,
  });
  return { ...query, ...context, data: filterAccessLost(query.error) ? undefined : query.data };
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

const FavouriteChange = Schema.Struct({ id: Schema.String, favourite: Schema.Boolean });
const isFavouriteChange = Schema.is(FavouriteChange);

export type FilterFavouriteChange = typeof FavouriteChange.Type;
type ScopedFavouriteChange = FilterFavouriteChange & { scope: JiraFilterScope };

export const useFilterFavourite = () => {
  const queryClient = useQueryClient();
  const { scope } = useJiraFilterScope();
  const apply = ({ id, favourite, scope }: ScopedFavouriteChange) => {
    queryClient.setQueryData<readonly JiraFilter[]>(jiraKeys.filtersScoped(scope), (filters) => filters && withFavourite(filters, id, favourite));
    queryClient.setQueryData<JiraFilterDetail>(jiraKeys.filterScoped(id, scope), (filter) => filter && { ...filter, favourite });
  };
  const mutation = useMutation({
    mutationKey: jiraKeys.filterFavourite,
    mutationFn: ({ id, favourite, scope }: ScopedFavouriteChange) =>
      Effect.runPromise(setFilterFavourite(id, favourite, filterRequestScope(queryClient, scope))),
    onMutate: async (change) => {
      const { id, scope } = change;
      await Promise.all([
        queryClient.cancelQueries({ queryKey: jiraKeys.filtersScoped(scope) }),
        queryClient.cancelQueries({ queryKey: jiraKeys.filterScoped(id, scope) }),
      ]);
      apply(change);
    },
    onError: (_, change) => apply({ ...change, favourite: !change.favourite }),
    onSettled: (_, __, { id, scope }) =>
      Promise.all([jiraKeys.filtersScoped(scope), jiraKeys.filterScoped(id, scope)].map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
  return { ...mutation, mutate: (change: FilterFavouriteChange, options?: Parameters<typeof mutation.mutate>[1]) => {
    if (scope) mutation.mutate({ ...change, scope }, options);
  } };
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
