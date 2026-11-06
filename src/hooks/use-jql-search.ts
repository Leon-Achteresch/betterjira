import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCreateFilter } from "@/hooks/jira/use-jira-filter";
import { useJqlValidation } from "@/hooks/jira/use-jql-validation";
import { jiraErrors } from "@/lib/jira/field-values";

export function useJqlSearch(jql: string, active: boolean, onSearch: (jql: string) => void) {
  const [draft, setDraft] = useState<string>();
  const [seen, setSeen] = useState(jql);
  if (seen !== jql) {
    setSeen(jql);
    setDraft(undefined);
  }
  const value = seen === jql ? (draft ?? jql) : jql;
  const validation = useJqlValidation(active ? value : "");
  const create = useCreateFilter();
  const navigate = useNavigate();

  return {
    value,
    setValue: setDraft,
    errors: active && value.trim() ? (validation.data ?? []) : [],
    validating: validation.isFetching,
    search: () => {
      setDraft(undefined);
      onSearch(value.trim());
    },
    saveAs: (name: string) =>
      create.mutate(
        { name, jql: value },
        {
          onSuccess: (created) => {
            toast.success(`Filter „${created.name}“ angelegt`);
            void navigate({ to: "/filter/$id", params: { id: created.id } });
          },
        },
      ),
    creating: create.isPending,
    createError: create.error ? jiraErrors(create.error).messages.concat(Object.values(jiraErrors(create.error).fields)).join(" ") : undefined,
    resetCreate: create.reset,
  };
}

export type JqlSearchState = ReturnType<typeof useJqlSearch>;
