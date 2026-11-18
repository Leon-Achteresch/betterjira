import { useEffect, useRef, useState } from "react";
import { useIsMutating, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Effect } from "effect";
import { useJiraMyself, useJiraSite } from "@/lib/jira/queries";
import { useLatestRef } from "./use-latest-ref";
import { attachmentName } from "@/lib/attachment-filter";
import { emptyAttachmentSelection, reconcileAttachmentSelection } from "@/lib/attachment-selection";
import { attachmentManagement, canDeleteAttachment, sameAttachment, deleteAttachmentSelection, AttachmentContextChanged, type AttachmentSnapshot, type AttachmentDeleteResult } from "@/lib/jira/attachment-deletion";
import { acknowledgeAttachmentDeletion } from "@/lib/jira/attachment-deletion-cache";
import { jiraQueryScopeMatches, jiraRequestScope, withJiraQueryScope, type JiraQueryScope } from "@/lib/jira/query-scope";
import { jiraKeys } from "@/lib/jira/keys";
import { fileSize } from "@/lib/file-size";

type DeleteJob = { context: string; issueKey: string; scope: JiraQueryScope; attachments: readonly AttachmentSnapshot[]; isCurrent: () => boolean };
const RESULT_LABELS = { deleted: "Gelöscht", failed: "Nicht gelöscht", uncertain: "Ergebnis unklar", "not-attempted": "Nicht gesendet" } as const;

export function useAttachmentSelection(issueKey: string, attachments: readonly AttachmentSnapshot[], filter: { query: string; kind: string; visibleIds: ReadonlySet<string> }) {
  const client = useQueryClient();
  const site = useJiraSite();
  const myself = useJiraMyself();
  const scope = site.isSuccess && site.data && myself.isSuccess && myself.data ? { cloudId: site.data.cloudId, accountId: myself.data.accountId } : undefined;
  const context = JSON.stringify([scope?.cloudId, scope?.accountId, issueKey, filter.query, filter.kind]);
  const stopping = useRef(false);
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; stopping.current = true; };
  }, []);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const key = jiraKeys.attachmentDeletion(issueKey, scope);
  const pending = useIsMutating({ mutationKey: key }) > 0;
  const management = useQuery({
    queryKey: jiraKeys.attachmentManagement(issueKey, scope),
    queryFn: ({ signal }) => Effect.runPromise(withJiraQueryScope(client, scope,
      attachmentManagement(issueKey, scope ? jiraRequestScope(client, scope) : { cloudId: "", isCurrent: () => false })), { signal }),
    enabled: !!scope && attachments.length > 0,
    retry: false,
    staleTime: 30_000,
  });
  const permissions = management.isError ? undefined : management.data?.permissions;
  const eligible = attachments.filter((entry) => filter.visibleIds.has(entry.id) && canDeleteAttachment(entry, permissions, scope?.accountId)
    && management.data?.issueKey.toUpperCase() === issueKey.toUpperCase()
    && management.data.attachments.some((fresh) => sameAttachment(entry, fresh)));
  const [state, setState] = useState(() => emptyAttachmentSelection(context));
  const reconciled = reconcileAttachmentSelection(state, context, eligible, pending || submitting.current);
  if (reconciled !== state) setState(reconciled);
  const current = reconciled;
  const latest = useLatestRef(current);
  const selected = eligible.filter((entry) => current.ids.includes(entry.id));
  const record = (job: DeleteJob, result: AttachmentDeleteResult) => {
    acknowledgeAttachmentDeletion(client, job.issueKey, job.scope, result);
    if (mounted.current) setState((previous) => previous.context === job.context && previous.confirmation === job.attachments ? { ...previous, results: [...previous.results, result] } : previous);
  };
  const mutation = useMutation({
    mutationKey: key,
    retry: false,
    mutationFn: (job: DeleteJob) => {
      if (!jiraQueryScopeMatches(client, job.scope) || !job.isCurrent()) return Promise.reject(new AttachmentContextChanged());
      const request = jiraRequestScope(client, job.scope);
      return Effect.runPromise(deleteAttachmentSelection(job.issueKey, job.attachments, job.scope.accountId,
        { ...request, isCurrent: () => request.isCurrent() && job.isCurrent() }, (result) => record(job, result)));
    },
    onSettled: (_results, _error, job) => {
      const refetchType = jiraQueryScopeMatches(client, job.scope) ? "active" : "none";
      void client.invalidateQueries({ queryKey: jiraKeys.issueDetail(job.issueKey, job.scope), exact: true, refetchType });
      void client.invalidateQueries({ queryKey: jiraKeys.attachmentManagement(job.issueKey, job.scope), exact: true, refetchType });
      void client.invalidateQueries({ queryKey: jiraKeys.issueRenderedAll(job.issueKey), refetchType });
    },
  });
  const confirm = async () => {
    const confirmation = current.confirmation;
    if (!mounted.current || !scope || !confirmation?.length || submitting.current || client.isMutating({ mutationKey: key }) || latest.current.context !== context || latest.current.confirmation !== confirmation) return;
    submitting.current = true;
    stopping.current = false;
    setState((previous) => ({ ...previous, results: [] }));
    try {
      const results = await mutation.mutateAsync({ context, scope, issueKey, attachments: confirmation, isCurrent: () => mounted.current && latest.current.context === context && latest.current.confirmation === confirmation && !stopping.current });
      if (mounted.current) setState((previous) => previous.context === context && previous.confirmation === confirmation ? { ...previous, confirmation: null, ids: results.filter((result) => result.status !== "deleted").map((result) => result.attachment.id) } : previous);
    } catch {
      if (mounted.current) setState((previous) => previous.context === context && previous.confirmation === confirmation ? { ...previous, confirmation: null } : previous);
    } finally {
      submitting.current = false;
    }
  };
  const error = mutation.variables?.context === context && mutation.error ? `Prüfung fehlgeschlagen; keine weitere Löschung gestartet. ${mutation.error instanceof Error ? mutation.error.message : "Bitte erneut prüfen."}` : undefined;
  const unavailableReason = !scope ? "Jira-Konto ist noch nicht bestätigt." : management.isPending ? "Anhänge und Löschrechte werden geprüft."
    : management.isError ? "Anhänge und Löschrechte konnten nicht geprüft werden." : !eligible.length ? "Keine sichtbaren Anhänge mit bestätigtem Löschrecht. Bitte gegebenenfalls neu prüfen." : undefined;
  const busy = () => submitting.current || client.isMutating({ mutationKey: key }) > 0;

  return {
    selecting: current.selecting,
    triggerRef,
    selectedIds: new Set(current.ids),
    selectedCount: selected.length,
    pending,
    unavailableReason,
    error,
    results: current.results.map((result) => ({ ...result, name: attachmentName(result.attachment.filename), label: RESULT_LABELS[result.status] })),
    eligibleIds: new Set(eligible.map((entry) => entry.id)),
    setSelecting: () => {
      if (!busy() && latest.current.context === context) { mutation.reset(); setState((previous) => ({ ...emptyAttachmentSelection(context), selecting: !previous.selecting })); }
    },
    toggle: (id: string) => {
      if (busy() || latest.current.context !== context || !eligible.some((entry) => entry.id === id)) return;
      setState((previous) => ({ ...previous, confirmation: null, ids: previous.ids.includes(id) ? previous.ids.filter((entry) => entry !== id) : [...previous.ids, id] }));
    },
    selectVisible: () => { if (!busy() && latest.current.context === context) setState((previous) => ({ ...previous, confirmation: null, ids: eligible.map((entry) => entry.id) })); },
    request: () => { if (selected.length && !busy() && latest.current.context === context) { mutation.reset(); setState((previous) => ({ ...previous, confirmation: [...selected] })); } },
    refresh: () => {
      if (busy()) return;
      void client.invalidateQueries({ queryKey: jiraKeys.issueDetail(issueKey, scope), exact: true });
      void management.refetch();
    },
    dialog: {
      open: !!current.confirmation,
      issueKey,
      accountLabel: scope ? `${myself.data?.displayName ?? scope.accountId} · ${site.data?.siteName ?? scope.cloudId}` : "",
      attachments: current.confirmation?.map((entry) => ({ ...entry, name: attachmentName(entry.filename), sizeLabel: fileSize(entry.size) })) ?? [],
      pending,
      onOpenChange: (open: boolean) => { if (!open && !busy()) setState((previous) => ({ ...previous, confirmation: null })); },
      onConfirm: () => void confirm(),
      onStop: () => { stopping.current = true; },
      onCloseAutoFocus: (event: Event) => { event.preventDefault(); triggerRef.current?.focus(); },
    },
  };
}

export type AttachmentSelectionModel = ReturnType<typeof useAttachmentSelection>;
