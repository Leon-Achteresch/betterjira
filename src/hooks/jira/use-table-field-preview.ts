import { useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { jiraKeys } from "@/lib/jira/keys";
import { jiraRequestScope, withJiraQueryScope, type JiraQueryScope } from "@/lib/jira/query-scope";
import { planTableFieldPreview, previewTableField, TABLE_FIELD_LIMITS, type TableFieldTarget } from "@/lib/jira/table-field-preview";

export type TableFieldPreviewContext = {
  context: string;
  scope: JiraQueryScope;
  targets: readonly TableFieldTarget[];
  accountLabel: string;
};

type Plan = Exclude<ReturnType<typeof planTableFieldPreview>, { error: string }>;

export function useTableFieldPreview({ context, scope, targets }: TableFieldPreviewContext) {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string>();
  const [job, setJob] = useState<{ revision: number; plan: Plan }>();
  const revision = useRef(0);
  const instance = useId();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: jiraKeys.tableFieldPreview(context, instance, job?.revision),
    enabled: job !== undefined,
    staleTime: "static",
    gcTime: 0,
    retry: false,
    queryFn: ({ signal }) => {
      if (!job) throw new Error("Keine Tabellenprüfung angefordert.");
      return Effect.runPromise(withJiraQueryScope(client, scope, previewTableField(job.plan, jiraRequestScope(client, scope))), { signal });
    },
  });

  const canPreview = input.length > 0 && !query.isFetching;
  return {
    input,
    canPreview,
    setInput: (value: string) => {
      const tooLong = value.length > TABLE_FIELD_LIMITS.characters;
      setInput(tooLong ? "" : value);
      setError(tooLong ? `Die Eingabe wurde verworfen. Füge höchstens ${TABLE_FIELD_LIMITS.characters.toLocaleString("de-DE")} Zeichen ein.` : undefined);
      setJob(undefined);
    },
    requestPreview: () => {
      if (!canPreview) return;
      const plan = planTableFieldPreview(input, targets);
      if ("error" in plan) {
        setError(plan.error);
        setJob(undefined);
        return;
      }
      setError(undefined);
      setJob({ revision: ++revision.current, plan });
    },
    inputError: error,
    readError: query.isError,
    pending: !!job && query.isPending,
    preview: job ? query.data : undefined,
  };
}
