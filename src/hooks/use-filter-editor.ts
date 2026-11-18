import { useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCreateFilter, useDeleteFilter, useFilterFavourite, useJiraFilter, useUpdateFilter } from "@/hooks/jira/use-jira-filter";
import { useJqlValidation } from "@/hooks/jira/use-jql-validation";
import { jiraErrorText } from "@/lib/jira/field-values";
import { filterProblem } from "@/lib/jira/filter-problem";
import { useContextSession } from "./use-context-session";


type EditorState = { token: object; editing: boolean; draft?: string; applied?: string };

export function useFilterEditor(id: string, queryOnly = false) {
  const filter = useJiraFilter(id);
  const update = useUpdateFilter();
  const create = useCreateFilter();
  const remove = useDeleteFilter();
  const favourite = useFilterFavourite();
  const navigate = useNavigate();
  const router = useRouter();
  const context = JSON.stringify([id, filter.scope, queryOnly]);
  const session = useContextSession(context);
  const isCurrentFilter = () => session.isCurrent() && router.state.location.pathname.replace(/\/+$/, "") === `/filter/${encodeURIComponent(id)}`;
  const [state, setState] = useState<EditorState>({ token: session.token, editing: queryOnly });
  const scoped = (current: EditorState): EditorState => (current.token === session.token ? current : { token: session.token, editing: queryOnly });
  const { editing, draft, applied } = scoped(state);
  const patch = (next: Partial<Omit<EditorState, "token">>) => setState((current) => ({ ...scoped(current), ...next }));
  const validation = useJqlValidation(draft ?? "");

  const saved = filter.data?.jql ?? "";
  const value = draft ?? saved;
  const reset = () => setState((current) => (current.token === session.token ? { token: session.token, editing: current.editing } : current));
  const save = (input: { name?: string; jql?: string }, success: string) => {
    if (!filter.data) return;
    const { name, jql, description } = filter.data;
    update.mutate(
      { id, fields: { name, jql, ...(description !== undefined && { description }), ...input } },
      {
        onSuccess: () => {
          reset();
          toast.success(success, { description: name });
        },
        onError: (error) => toast.error("Filter konnte nicht gespeichert werden", { description: jiraErrorText(error) }),
      },
    );
  };

  return {
    context,
    filter: filter.data,
    loadError: !filter.data && (filter.error || filter.scopeError) ? filterProblem(filter.error ?? filter.scopeError) : undefined,
    refreshFailed: !!filter.data && filter.isError,
    retry: () => void (filter.scopeError ? filter.retryScope() : filter.refetch()),
    retrying: filter.isFetching || filter.checkingScope,
    isOwner: !!filter.data?.owner && filter.data.owner.accountId === filter.scope?.accountId,
    tableJql: applied ?? (queryOnly ? undefined : filter.data?.jql),
    editing: !!filter.data && editing,
    setEditing: (next: boolean) => patch({ editing: next }),
    value,
    setValue: (next: string) => patch({ draft: next }),
    dirty: value.trim() !== saved.trim(),
    previewing: applied !== undefined,
    errors: draft === undefined ? [] : (validation.data ?? []),
    validating: draft !== undefined && validation.isFetching,
    apply: () => patch({ applied: value.trim() || undefined }),
    discard: reset,
    adopt: (jql: string) => patch({ draft: jql, editing: true }),
    save: () => save({ jql: value }, "Filter gespeichert"),
    rename: (name: string) => save({ name }, "Filter umbenannt"),
    saving: update.isPending,
    saveAs: (name: string) =>
      create.mutate(
        { name, jql: value },
        {
          onSuccess: (created) => {
            reset();
            toast.success(`Filter „${created.name}“ angelegt`);
            if (isCurrentFilter()) void navigate({ to: "/filter/$id", params: { id: created.id } });
          },
        },
      ),
    creating: create.isPending,
    createError: create.error ? jiraErrorText(create.error) : undefined,
    resetCreate: create.reset,
    favourite: !!filter.data?.favourite,
    toggleFavourite: () =>
      favourite.mutate({ id, favourite: !filter.data?.favourite }, {
        onError: (error) => toast.error("Favorit konnte nicht geändert werden", { description: jiraErrorText(error) }),
      }),
    togglingFavourite: favourite.isPending,
    remove: () =>
      remove.mutate(id, {
        onSuccess: () => {
          toast.success("Filter gelöscht", { description: filter.data?.name ?? id });
          if (isCurrentFilter()) void navigate({ to: "/" });
        },
        onError: (error) => toast.error("Filter konnte nicht gelöscht werden", { description: jiraErrorText(error) }),
      }),
    removing: remove.isPending,
  };
}

export type FilterEditorState = ReturnType<typeof useFilterEditor>;
