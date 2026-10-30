import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

type RepoOption = { id: string; label: string };

type CreateBranchFormProps = {
  repos: RepoOption[];
  defaultName: string;
  pending: boolean;
  error: string | null;
  onSubmit: (repoId: string, name: string) => void;
  onCancel: () => void;
};

function CreateBranchForm({ repos, defaultName, pending, error, onSubmit, onCancel }: CreateBranchFormProps) {
  const [repoId, setRepoId] = useState(repos[0]?.id ?? "");
  const [name, setName] = useState(defaultName);
  const valid = repoId !== "" && name.trim() !== "" && !/\s/.test(name.trim());
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (valid) onSubmit(repoId, name.trim());
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="branch-repo">Repository</FieldLabel>
          <Select value={repoId} onValueChange={(value) => setRepoId(String(value))}>
            <SelectTrigger id="branch-repo" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {repos.map((repo) => (
                <SelectItem key={repo.id} value={repo.id}>
                  {repo.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field data-invalid={!!error || undefined}>
          <FieldLabel htmlFor="branch-name">Branch-Name</FieldLabel>
          <Input
            id="branch-name"
            autoFocus
            className="font-mono"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={!!error}
          />
          {error && <FieldError>{error}</FieldError>}
        </Field>
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={!valid || pending}>
          {pending && <Spinner />}
          Branch erstellen
        </Button>
      </DialogFooter>
    </form>
  );
}

export function CreateBranchDialog({
  open,
  onOpenChange,
  ...form
}: Omit<CreateBranchFormProps, "onCancel"> & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Branch erstellen</DialogTitle>
          <DialogDescription>Der Branch wird vom Standard-Branch des Repositorys abgezweigt.</DialogDescription>
        </DialogHeader>
        {open && <CreateBranchForm {...form} onCancel={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
