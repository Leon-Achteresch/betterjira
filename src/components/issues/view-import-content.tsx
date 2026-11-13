import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { IssueViewTransferState } from "@/hooks/use-issue-view-transfer";

export function ViewImportContent({ transfer }: { transfer: IssueViewTransferState }) {
  const id = useId();
  return (
    <form onSubmit={(event) => { event.preventDefault(); transfer.apply(); }} className="flex flex-col gap-3 p-1">
      <p className="text-sm font-medium text-balance">Ansicht importieren</p>
      <p id={`${id}-description`} className="text-xs text-muted-foreground">Übernimmt Spalten, Gruppierung und Filter für diese Liste. Die Basisabfrage bleibt erhalten. Es werden keine Tickets verändert.</p>
      <Field data-invalid={!!transfer.error || undefined}>
        <FieldLabel htmlFor={id}>Ansichtsdefinition (JSON)</FieldLabel>
        <Textarea
          id={id}
          value={transfer.source}
          onChange={(event) => transfer.setSource(event.target.value)}
          maxLength={65_537}
          spellCheck={false}
          aria-invalid={!!transfer.error}
          aria-describedby={`${id}-description${transfer.error ? ` ${id}-error` : ""}`}
          className="h-40 resize-y font-mono text-xs"
        />
        {transfer.error && <FieldError id={`${id}-error`} role="alert">{transfer.error}</FieldError>}
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" type="button" onClick={() => transfer.setOpen(false)}>Abbrechen</Button>
        <Button type="submit" disabled={!transfer.source.trim()}>Ansicht übernehmen</Button>
      </div>
    </form>
  );
}
