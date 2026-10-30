import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { SCM_KIND_LABELS, type NewConnection, type ScmKind } from "@/lib/scm/model";

const KINDS: Record<ScmKind, { url: string | null; username: string | null; token: string }> = {
  github: {
    url: "https://github.com oder https://github.firma.de",
    username: null,
    token: "Personal Access Token mit den Rechten repo und read:org. Nur nötig, wenn die GitHub CLI nicht genutzt wird.",
  },
  "bitbucket-cloud": {
    url: null,
    username: "E-Mail deines Atlassian-Kontos. Leer lassen bei Repository- oder Workspace-Access-Tokens.",
    token: "API-Token mit Lese- und Schreibrechten für Repositories und Pull Requests.",
  },
  "bitbucket-dc": {
    url: "https://bitbucket.firma.de",
    username: null,
    token: "HTTP Access Token mit Repository-Schreibrechten (Profil → HTTP access tokens).",
  },
};

const KIND_ORDER: ScmKind[] = ["bitbucket-cloud", "bitbucket-dc", "github"];

type AddConnectionFormProps = {
  pending: boolean;
  error: string | null;
  onSubmit: (connection: NewConnection) => void;
  onCancel: () => void;
};

function AddConnectionForm({ pending, error, onSubmit, onCancel }: AddConnectionFormProps) {
  const [form, setForm] = useState<NewConnection>({ kind: "bitbucket-cloud", baseUrl: "", username: "", token: "" });
  const kind = KINDS[form.kind];
  const valid = form.token.trim() !== "" && (!kind.url || form.baseUrl.trim() !== "");
  const update = (patch: Partial<NewConnection>) => setForm((current) => ({ ...current, ...patch }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (valid) onSubmit(form);
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="scm-kind">Anbieter</FieldLabel>
          <Select value={form.kind} onValueChange={(value) => {
              const next = KIND_ORDER.find((option) => option === value);
              if (next) update({ kind: next, baseUrl: "" });
            }}>
            <SelectTrigger id="scm-kind" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KIND_ORDER.map((option) => (
                <SelectItem key={option} value={option}>
                  {SCM_KIND_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {kind.url && (
          <Field>
            <FieldLabel htmlFor="scm-url">Server-URL</FieldLabel>
            <Input id="scm-url" type="url" placeholder={kind.url} value={form.baseUrl} onChange={(event) => update({ baseUrl: event.target.value })} />
          </Field>
        )}
        {kind.username && (
          <Field>
            <FieldLabel htmlFor="scm-username">E-Mail</FieldLabel>
            <Input id="scm-username" type="email" value={form.username} onChange={(event) => update({ username: event.target.value })} />
            <FieldDescription>{kind.username}</FieldDescription>
          </Field>
        )}
        <Field data-invalid={!!error || undefined}>
          <FieldLabel htmlFor="scm-token">Token</FieldLabel>
          <Input
            id="scm-token"
            type="password"
            autoComplete="off"
            value={form.token}
            onChange={(event) => update({ token: event.target.value })}
            aria-invalid={!!error}
          />
          <FieldDescription>{kind.token} Der Token liegt nur im Schlüsselbund.</FieldDescription>
          {error && <FieldError>{error}</FieldError>}
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={!valid || pending}>
          {pending && <Spinner />}
          Verbinden
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AddConnectionDialog({
  open,
  onOpenChange,
  ...form
}: Omit<AddConnectionFormProps, "onCancel"> & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Verbindung hinzufügen</DialogTitle>
          <DialogDescription>Die Verbindung wird vor dem Speichern geprüft.</DialogDescription>
        </DialogHeader>
        {open && <AddConnectionForm {...form} onCancel={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
