import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

function NameForm({
  initial,
  label,
  submitLabel,
  pending,
  error,
  onSubmit,
  onCancel,
}: {
  initial: string;
  label: string;
  submitLabel: string;
  pending?: boolean;
  error?: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim()) onSubmit(name.trim());
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field data-invalid={!!error || undefined}>
        <FieldLabel htmlFor="name-dialog-input">{label}</FieldLabel>
        <Input id="name-dialog-input" autoFocus value={name} onChange={(event) => setName(event.target.value)} aria-invalid={!!error} />
        {error && <FieldError>{error}</FieldError>}
      </Field>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={!name.trim() || pending}>
          {pending && <Spinner />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function NameDialog({
  open,
  onOpenChange,
  title,
  description,
  initial = "",
  label = "Name",
  submitLabel = "Speichern",
  pending,
  error,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  initial?: string;
  label?: string;
  submitLabel?: string;
  pending?: boolean;
  error?: string;
  onSubmit: (name: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {open && (
          <NameForm
            initial={initial}
            label={label}
            submitLabel={submitLabel}
            pending={pending}
            error={error}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
