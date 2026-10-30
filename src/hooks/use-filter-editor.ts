import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCreateFilter, useDeleteFilter, useFilterFavourite, useJiraFilter, useUpdateFilter } from "@/hooks/jira/use-jira-filter";
import { useJqlValidation } from "@/hooks/jira/use-jql-validation";
import { jiraErrors } from "@/lib/jira/field-values";
import { useJiraMyself } from "@/lib/jira/queries";

const errorText = (error: unknown) => jiraErrors(error).messages.concat(Object.values(jiraErrors(error).fields)).join(" ");

export function useFilterEditor(id: string) {
  const filter = useJiraFilter(id);
  const myself = useJiraMyself();
  const update = useUpdateFilter(id);
  const create = useCreateFilter();
  const remove = useDeleteFilter(id);
  const favourite = useFilterFavourite(id);
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>();
  const [applied, setApplied] = useState<string>();
  const validation = useJqlValidation(draft ?? "");

  const saved = filter.data?.jql ?? "";
  const value = draft ?? saved;
  const reset = () => {
    setDraft(undefined);
    setApplied(undefined);
  };
  const save = (input: { name?: string; jql?: string }, success: string) => {
    if (!filter.data) return;
    const { name, jql, description } = filter.data;
    update.mutate(
      { name, jql, ...(description !== undefined && { description }), ...input },
      {
        onSuccess: () => {
          reset();
          toast.success(success);
        },
        onError: (error) => toast.error("Filter konnte nicht gespeichert werden", { description: errorText(error) }),
      },
    );
  };

  return {
    filter: filter.data,
    error: filter.error,
    isOwner: !!filter.data?.owner && filter.data.owner.accountId === myself.data?.accountId,
    tableJql: applied ?? filter.data?.jql ?? (filter.error ? `filter = ${id}` : undefined),
    editing,
    setEditing,
    value,
    setValue: setDraft,
    dirty: value.trim() !== saved.trim(),
    previewing: applied !== undefined,
    errors: draft === undefined ? [] : (validation.data ?? []),
    validating: draft !== undefined && validation.isFetching,
    apply: () => setApplied(value.trim() || undefined),
    discard: reset,
    adopt: (jql: string) => {
      setDraft(jql);
      setEditing(true);
    },
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
            void navigate({ to: "/filter/$id", params: { id: created.id } });
          },
        },
      ),
    creating: create.isPending,
    createError: create.error ? errorText(create.error) : undefined,
    resetCreate: create.reset,
    favourite: !!filter.data?.favourite,
    toggleFavourite: () =>
      favourite.mutate(!filter.data?.favourite, {
        onError: (error) => toast.error("Favorit konnte nicht geändert werden", { description: errorText(error) }),
      }),
    togglingFavourite: favourite.isPending,
    remove: () =>
      remove.mutate(undefined, {
        onSuccess: () => {
          toast.success("Filter gelöscht");
          void navigate({ to: "/" });
        },
        onError: (error) => toast.error("Filter konnte nicht gelöscht werden", { description: errorText(error) }),
      }),
    removing: remove.isPending,
  };
}

export type FilterEditorState = ReturnType<typeof useFilterEditor>;
