import { useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCreateFilter, useDeleteFilter, useFilterFavourite, useJiraFilter, useUpdateFilter } from "@/hooks/jira/use-jira-filter";
import { useJqlValidation } from "@/hooks/jira/use-jql-validation";
import { jiraErrors } from "@/lib/jira/field-values";
import { filterProblem } from "@/lib/jira/filter-problem";
import { useJiraMyself } from "@/lib/jira/queries";

const errorText = (error: unknown) => jiraErrors(error).messages.concat(Object.values(jiraErrors(error).fields)).join(" ");

type EditorState = { id: string; editing: boolean; draft?: string; applied?: string };

export function useFilterEditor(id: string) {
  const filter = useJiraFilter(id);
  const myself = useJiraMyself();
  const update = useUpdateFilter();
  const create = useCreateFilter();
  const remove = useDeleteFilter();
  const favourite = useFilterFavourite();
  const navigate = useNavigate();
  const router = useRouter();
  const isCurrentFilter = () => router.state.location.pathname.replace(/\/+$/, "") === `/filter/${encodeURIComponent(id)}`;
  const [state, setState] = useState<EditorState>({ id, editing: false });
  const scoped = (current: EditorState): EditorState => (current.id === id ? current : { id, editing: false });
  const { editing, draft, applied } = scoped(state);
  const patch = (next: Partial<Omit<EditorState, "id">>) => setState((current) => ({ ...scoped(current), ...next }));
  const validation = useJqlValidation(draft ?? "");

  const saved = filter.data?.jql ?? "";
  const value = draft ?? saved;
  const reset = () => setState((current) => (current.id === id ? { id, editing: current.editing } : current));
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
        onError: (error) => toast.error("Filter konnte nicht gespeichert werden", { description: errorText(error) }),
      },
    );
  };

  return {
    filter: filter.data,
    loadError: !filter.data && filter.error ? filterProblem(filter.error) : undefined,
    refreshFailed: !!filter.data && filter.isError,
    retry: () => void filter.refetch(),
    retrying: filter.isFetching,
    isOwner: !!filter.data?.owner && filter.data.owner.accountId === myself.data?.accountId,
    tableJql: applied ?? filter.data?.jql,
    editing,
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
    createError: create.error ? errorText(create.error) : undefined,
    resetCreate: create.reset,
    favourite: !!filter.data?.favourite,
    toggleFavourite: () =>
      favourite.mutate({ id, favourite: !filter.data?.favourite }, {
        onError: (error) => toast.error("Favorit konnte nicht geändert werden", { description: errorText(error) }),
      }),
    togglingFavourite: favourite.isPending,
    remove: () =>
      remove.mutate(id, {
        onSuccess: () => {
          toast.success("Filter gelöscht", { description: filter.data?.name ?? id });
          if (isCurrentFilter()) void navigate({ to: "/" });
        },
        onError: (error) => toast.error("Filter konnte nicht gelöscht werden", { description: errorText(error) }),
      }),
    removing: remove.isPending,
  };
}

export type FilterEditorState = ReturnType<typeof useFilterEditor>;
