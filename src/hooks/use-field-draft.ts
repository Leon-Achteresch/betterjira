import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useJiraEditIssue, useJiraEditIssueWiki } from "@/hooks/jira/use-issue-mutations";
import { useJiraMyself, useJiraSite } from "@/lib/jira/queries";
import { encode, jiraErrors } from "@/lib/jira/field-values";
import { adfDraftField, fieldDraftId, parseAdfDraft } from "@/lib/field-draft";
import { useFieldDraftStore } from "@/hooks/use-field-drafts";
import { useCheckedDescriptionSave } from "@/hooks/jira/use-checked-description-save";
import { descriptionBasis, type DescriptionBasis } from "@/lib/description-comparison";
import { submitFieldDraft } from "@/lib/field-draft-save";

function useScopedFieldDraft(issueKey: string, field: string) {
  const site = useJiraSite();
  const myself = useJiraMyself();
  const id =
    site.data && myself.data ? fieldDraftId(site.data.cloudId, myself.data.accountId, issueKey, field) : undefined;
  const draft = useFieldDraftStore((state) => (id ? state.drafts[id] : undefined));
  return { id, draft, lockId: site.data && myself.data ? fieldDraftId(site.data.cloudId, myself.data.accountId, issueKey, "description") : undefined };
}

export function useFieldDraftPresence(issueKey: string, field: string) {
  return useScopedFieldDraft(issueKey, field).draft !== undefined;
}

export function useAdfFieldDraftPresence(issueKey: string, field: string) {
  return useFieldDraftPresence(issueKey, adfDraftField(field));
}

export function useFieldDraft({
  issueKey,
  field,
  initial,
  initialRaw,
  mode,
  onClose,
}: {
  issueKey: string;
  field: string;
  initial: string;
  initialRaw?: unknown;
  mode: "text" | "wiki" | "adf";
  onClose: () => void;
}) {
  const { id, draft, lockId } = useScopedFieldDraft(issueKey, mode === "adf" ? adfDraftField(field) : field);
  const description = field === "description";
  const saveLockId = description ? lockId : id;
  const [origin] = useState(() => ({ id, basis: description ? descriptionBasis(mode, mode === "text" ? initial : initialRaw) : undefined }));
  const basis = origin.id === id ? origin.basis : undefined;
  const write = useFieldDraftStore((state) => state.write);
  const discardDraft = useFieldDraftStore((state) => state.discard);
  const saving = useFieldDraftStore((state) => saveLockId !== undefined && state.saving.includes(saveLockId));
  const edit = useJiraEditIssue(issueKey);
  const wikiEdit = useJiraEditIssueWiki(issueKey);
  const checked = useCheckedDescriptionSave(issueKey);
  const mutation = description ? checked : mode === "wiki" ? wikiEdit : edit;
  const submitting = useRef(false);
  const [notice, setNotice] = useState<string>();
  const text = draft?.text ?? initial;
  const errors = jiraErrors(mutation.error);
  const comparison = description && checked.variables?.input.format === mode && checked.data && checked.data.status !== "saved" ? checked.data : undefined;

  const submit = async (event?: FormEvent, reviewed?: DescriptionBasis) => {
    event?.preventDefault();
    if (!id || submitting.current || mutation.isPending || saving) return;
    submitting.current = true;
    setNotice(undefined);
    try {
      const result = await submitFieldDraft(useFieldDraftStore, id, async (submitted) => {
        if (description) return checked.mutateAsync({ draft: submitted, format: mode, reviewed });
        if (submitted.text !== initial) {
          if (mode === "wiki") await wikiEdit.mutateAsync({ [field]: submitted.text });
          else if (mode === "adf") {
            const doc = parseAdfDraft(submitted.text);
            if (!doc) throw new Error("Der Entwurf lässt sich nicht lesen und wurde nicht gespeichert.");
            await edit.mutateAsync({ [field]: encode("richtext", doc) });
          } else await edit.mutateAsync({ [field]: encode("text", submitted.text) });
        }
        return { status: "saved" };
      }, saveLockId);
      if (result.status === "saved" || result.status === "missing") onClose();
      else if (result.status === "newer-draft") setNotice("Gespeichert. Deine neueren Änderungen bleiben als Entwurf erhalten.");
      else if (result.status === "unbased") setNotice("Für diesen älteren Entwurf fehlt die ursprüngliche Serverfassung. Er wurde nicht gespeichert. Dein Entwurf bleibt erhalten; prüfe beide Fassungen vor einer Übernahme.");
      else if (result.status === "conflict") setNotice("Die Beschreibung wurde inzwischen in Jira geändert. Es wurde nichts überschrieben. Dein Entwurf bleibt erhalten; prüfe beide Fassungen vor einer Übernahme.");
    } catch {
      setNotice(description
        ? "Speichern fehlgeschlagen. Dein Entwurf bleibt erhalten; beim nächsten Versuch wird die Serverbeschreibung erneut geprüft."
        : "Speichern fehlgeschlagen. Dein Entwurf bleibt erhalten.");
      return;
    } finally {
      submitting.current = false;
    }
  };

  return {
    text,
    ready: id !== undefined,
    hasDraft: draft !== undefined,
    pending: mutation.isPending || saving,
    errors: [...errors.messages, ...Object.values(errors.fields)],
    notice,
    comparison,
    confirmCompared: () => {
      if (comparison) return submit(undefined, comparison.remote);
    },
    setText: (value: unknown) => {
      if (id && typeof value === "string") write(id, value, basis);
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
