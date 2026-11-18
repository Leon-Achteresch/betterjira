import { useId, useLayoutEffect, useRef, useState } from "react";
import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { jiraKeys } from "@/lib/jira/keys";
import { invalidateIssueChange } from "@/lib/jira/mutation-cache";
import { jiraQueryScopeMatches, jiraRequestScope } from "@/lib/jira/query-scope";
import { previewSubtaskRows, submitSubtaskRows, type SubtaskRowsPreview, type SubtaskRowsTarget } from "@/lib/jira/subtask-rows";
import { subtaskRowsAllowed } from "@/lib/jira/subtask-rows-capability";

export function useSubtaskRows(target: SubtaskRowsTarget, singlePending: boolean) {
  const client = useQueryClient();
  const instance = useId();
  const revision = useRef(0);
  const mounted = useRef(false);
  const used = useRef(false);
  const [text, setText] = useState("");
  const [review, setReview] = useState<{ text: string; revision: number }>();
  const [selected, setSelected] = useState<number[]>([]);
  const key = jiraKeys.subtaskRowsWrite(target.scope);
  const busy = useIsMutating({ mutationKey: key }) > 0;
  const writable = subtaskRowsAllowed(target.scope, target.siteUrl);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const scopedRequest = () => {
    const request = jiraRequestScope(client, target.scope);
    return { ...request, siteUrl: target.siteUrl, isCurrent: () => mounted.current && request.isCurrent() };
  };
  const query = useQuery({
    queryKey: jiraKeys.subtaskRowsPreview(instance, review?.revision),
    queryFn: ({ signal }) => Effect.runPromise(previewSubtaskRows(review!.text, target, scopedRequest()), { signal }),
    enabled: !!review,
    retry: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    gcTime: 0,
  });
  const mutation = useMutation({
    mutationKey: key,
    retry: false,
    networkMode: "always",
    mutationFn: ({ preview, lines }: { preview: SubtaskRowsPreview; lines: readonly number[] }) =>
      Effect.runPromise(submitSubtaskRows(preview, lines, scopedRequest())),
    onSuccess: (results, { preview }) => {
      if (!results.some(({ status }) => status === "created" || status === "uncertain")) return;
      if (jiraQueryScopeMatches(client, preview.target.scope)) invalidateIssueChange(client, preview.target.parent.key, true);
      else void client.invalidateQueries({ queryKey: jiraKeys.issueDetail(preview.target.parent.key, preview.target.scope), exact: true, refetchType: "none" });
    },
  });
  const preview = query.data;
  const canSubmit = writable && !busy && !singlePending && !!preview && !preview.problem && selected.length > 0 && !used.current;
  return {
    text,
    waiting: !!review && query.isFetching,
    preview,
    previewFailed: !!review && query.isError,
    writable,
    busy: mutation.isPending,
    submitted: used.current,
    results: mutation.data,
    failed: mutation.isError,
    selected,
    canSubmit,
    setText: (next: string) => {
      if (used.current) return;
      setText(next);
      setReview(undefined);
      setSelected([]);
    },
    inspect: () => {
      if (used.current) return;
      setSelected([]);
      setReview({ text, revision: ++revision.current });
    },
    select: (line: number, checked: boolean) => {
      if (!writable || used.current || preview?.problem || !preview?.rows.some((row) => row.line === line && !row.problem)) return;
      setSelected((lines) => checked ? [...new Set([...lines, line])] : lines.filter((entry) => entry !== line));
    },
    submit: () => {
      if (!preview || !canSubmit || used.current || client.isMutating({ mutationKey: key }) || !scopedRequest().isCurrent()) return;
      used.current = true;
      mutation.mutate({ preview, lines: selected });
    },
  };
}
