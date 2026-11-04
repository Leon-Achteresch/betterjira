import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useJiraEditIssue, useJiraEditIssueWiki } from "@/hooks/jira/use-issue-mutations";
import { useJiraMyself, useJiraSite } from "@/lib/jira/queries";
import { encode, jiraErrors } from "@/lib/jira/field-values";
import { fieldDraftId } from "@/lib/field-draft";
import { useFieldDraftStore } from "@/hooks/use-field-drafts";

function useScopedFieldDraft(issueKey: string, field: string) {
  const site = useJiraSite();
  const myself = useJiraMyself();
  const id =
    site.data && myself.data ? fieldDraftId(site.data.cloudId, myself.data.accountId, issueKey, field) : undefined;
  const draft = useFieldDraftStore((state) => (id ? state.drafts[id] : undefined));
  return { id, draft };
}

export function useFieldDraftPresence(issueKey: string, field: string) {
  return useScopedFieldDraft(issueKey, field).draft !== undefined;
}

export function useFieldDraft({
  issueKey,
  field,
  initial,
  mode,
  onClose,
}: {
  issueKey: string;
  field: string;
  initial: string;
  mode: "text" | "wiki";
  onClose: () => void;
}) {
  const { id, draft } = useScopedFieldDraft(issueKey, field);
  const write = useFieldDraftStore((state) => state.write);
  const discardDraft = useFieldDraftStore((state) => state.discard);
  const complete = useFieldDraftStore((state) => state.complete);
  const beginSave = useFieldDraftStore((state) => state.beginSave);
  const endSave = useFieldDraftStore((state) => state.endSave);
  const saving = useFieldDraftStore((state) => id !== undefined && state.saving.includes(id));
  const edit = useJiraEditIssue(issueKey);
  const wikiEdit = useJiraEditIssueWiki(issueKey);
  const mutation = mode === "wiki" ? wikiEdit : edit;
  const submitting = useRef(false);
  const [notice, setNotice] = useState<string>();
  const text = draft?.text ?? initial;
  const errors = jiraErrors(mutation.error);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!id || submitting.current || mutation.isPending || saving) return;
    const submitted = useFieldDraftStore.getState().drafts[id];
    if (!submitted) return onClose();
    if (submitted.text === initial) {
      if (complete(id, submitted)) onClose();
      return;
    }
    if (!beginSave(id)) return;
    submitting.current = true;
    setNotice(undefined);
    try {
      if (mode === "wiki") await wikiEdit.mutateAsync({ [field]: submitted.text });
      else await edit.mutateAsync({ [field]: encode("text", submitted.text) });
      if (complete(id, submitted)) onClose();
      else setNotice("Gespeichert. Deine neueren Änderungen bleiben als Entwurf erhalten.");
    } catch {
      return;
    } finally {
      submitting.current = false;
      endSave(id);
    }
  };

  return {
    text,
    ready: id !== undefined,
    hasDraft: draft !== undefined,
    pending: mutation.isPending || saving,
    errors: [...errors.messages, ...Object.values(errors.fields)],
    notice,
    setText: (value: unknown) => {
      if (id && typeof value === "string") write(id, value);
    },
    submit,
    close: onClose,
    discard: () => {
      if (id) discardDraft(id);
      onClose();
    },
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing) {
        event.preventDefault();
        void submit();
      }
    },
  };
}
