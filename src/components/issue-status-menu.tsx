import { useState, type FormEvent } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { ArrowRightIcon, ChevronDownIcon } from "lucide-react";
import { AdfEditor } from "@/components/adf-editor";
import { JiraFieldInput } from "@/components/jira-field-input";
import { JiraStatusBadge } from "@/components/jira-status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { encode, initialValue, isEmpty, jiraErrors, kindOf } from "@/lib/jira/field-values";
import { useJiraSite, useJiraTransition, useJiraTransitions, type JiraTransition, type JiraTransitionField } from "@/lib/jira/queries";
import { cn } from "@/lib/utils";

type Status = { name: string; statusCategory: { colorName: string } };
type FieldValues = Record<string, unknown>;

function TransitionDialog({
  issueKey,
  transition,
  current,
  mutation,
  onClose,
}: {
  issueKey: string;
  transition: JiraTransition;
  current: FieldValues;
  mutation: ReturnType<typeof useJiraTransition>;
  onClose: () => void;
}) {
  const site = useJiraSite();
  const fields = Object.entries(transition.fields ?? {}).map(([id, field]) => ({ id, field, kind: kindOf(field) }));
  const [values, setValues] = useState<FieldValues>(() =>
    Object.fromEntries(fields.flatMap(({ id, kind }) => (kind ? [[id, initialValue(kind, current[id])]] : []))),
  );
  const [touched, setTouched] = useState<Set<string>>(() => new Set());
  const [comment, setComment] = useState<unknown>(null);
  const [submitted, setSubmitted] = useState(false);

  const missing = (id: string, field: JiraTransitionField) => field.required && isEmpty(values[id]);
  const blocked = fields.filter(({ field, kind }) => !kind && field.required);
  const invalid = fields.some(({ id, field, kind }) => kind && missing(id, field));
  const errors = jiraErrors(mutation.error);
  const unplaced = Object.entries(errors.fields)
    .filter(([id]) => !fields.some((item) => item.id === id && item.kind))
    .map(([, message]) => message);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (invalid || blocked.length > 0) return;
    const changed = fields.filter(({ id, kind }) => kind && touched.has(id));
    mutation.mutate(
      {
        issueKey,
        body: {
          transition: { id: transition.id },
          ...(changed.length > 0 && { fields: Object.fromEntries(changed.map(({ id, kind }) => [id, encode(kind!, values[id])])) }),
          ...(!isEmpty(comment) && { update: { comment: [{ add: { body: comment } }] } }),
        },
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{transition.name}</DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <span className="font-mono">{issueKey}</span>
              <ArrowRightIcon className="size-3.5" />
              <JiraStatusBadge status={transition.to} />
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="max-h-[60vh] gap-4 overflow-y-auto">
            {fields.map(({ id, field, kind }) => {
              if (!kind) {
                return field.required ? (
                  <p key={id} className="text-sm text-muted-foreground">
                    Das Pflichtfeld „{field.name}“ kann betterjira nicht bearbeiten.
                  </p>
                ) : null;
              }
              const error = errors.fields[id] ?? (submitted && missing(id, field) ? "Pflichtfeld" : undefined);
              return (
                <Field key={id} data-invalid={!!error}>
                  <FieldLabel htmlFor={`transition-${id}`}>
                    {field.name}
                    {field.required && <span className="text-destructive">*</span>}
                  </FieldLabel>
                  <JiraFieldInput
                    id={`transition-${id}`}
                    field={field}
                    kind={kind}
                    value={values[id]}
                    issueKey={issueKey}
                    onChange={(value) => {
                      setValues((previous) => ({ ...previous, [id]: value }));
                      setTouched((previous) => new Set(previous).add(id));
                    }}
                  />
                  {error && <FieldError>{error}</FieldError>}
                </Field>
              );
            })}
            <Field>
              <FieldLabel htmlFor="transition-comment">Kommentar</FieldLabel>
              <AdfEditor id="transition-comment" label="Kommentar" value={null} onChange={setComment} />
            </Field>
          </FieldGroup>

          {[...errors.messages, ...unplaced].length > 0 && (
            <FieldError>
              {[...errors.messages, ...unplaced].map((message) => (
                <p key={message}>{message}</p>
              ))}
            </FieldError>
          )}

          <DialogFooter>
            {blocked.length > 0 && site.data && (
              <Button type="button" variant="ghost" className="sm:mr-auto" onClick={() => void openUrl(`${site.data!.siteUrl}/browse/${issueKey}`)}>
                In Jira öffnen
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={mutation.isPending || blocked.length > 0}>
              {mutation.isPending && <Spinner />}
              {transition.name}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TransitionChooser({
  issueKey,
  transitions,
  onChoose,
  onClose,
}: {
  issueKey: string;
  transitions: readonly JiraTransition[];
  onChoose: (transition: JiraTransition) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Übergang wählen</DialogTitle>
          <DialogDescription>Für {issueKey} führen mehrere Übergänge in diese Spalte.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1">
          {transitions.map((transition) => (
            <Button key={transition.id} variant="ghost" className="justify-between" onClick={() => onChoose(transition)}>
              {transition.name}
              <JiraStatusBadge status={transition.to} />
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useTransitionFlow() {
  const mutation = useJiraTransition();
  const [open, setOpen] = useState<{
    issueKey: string;
    transitions: readonly JiraTransition[];
    current: FieldValues;
    selected?: JiraTransition;
  }>();

  const run = (issueKey: string, transition: JiraTransition, current: FieldValues) => {
    const showDialog = () => setOpen({ issueKey, transitions: [transition], current, selected: transition });
    mutation.reset();
    if (Object.keys(transition.fields ?? {}).length > 0) return showDialog();
    mutation.mutate({ issueKey, body: { transition: { id: transition.id } } }, { onError: showDialog });
  };

  const start = (issueKey: string, transitions: readonly JiraTransition[], current: FieldValues) => {
    if (transitions.length === 1) return run(issueKey, transitions[0]!, current);
    if (transitions.length > 1) setOpen({ issueKey, transitions, current });
  };

  const close = () => setOpen(undefined);
  const dialog = !open ? null : open.selected ? (
    <TransitionDialog
      key={`${open.issueKey}:${open.selected.id}`}
      issueKey={open.issueKey}
      transition={open.selected}
      current={open.current}
      mutation={mutation}
      onClose={close}
    />
  ) : (
    <TransitionChooser
      issueKey={open.issueKey}
      transitions={open.transitions}
      onClose={close}
      onChoose={(transition) => {
        close();
        run(open.issueKey, transition, open.current);
      }}
    />
  );

  return { start, dialog, pending: mutation.isPending };
}

export function IssueStatusMenu({ issueKey, status, className }: { issueKey: string; status: Status; className?: string }) {
  const [open, setOpen] = useState(false);
  const transitions = useJiraTransitions(issueKey, open);
  const flow = useTransitionFlow();

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          disabled={flow.pending}
          aria-label={`Status ändern: ${status.name}`}
          className={cn(
            "group inline-flex items-center gap-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
            className,
          )}
        >
          <JiraStatusBadge status={status} />
          {flow.pending ? (
            <Spinner className="size-3.5" />
          ) : (
            <ChevronDownIcon className="size-3.5 text-muted-foreground opacity-60 group-hover:opacity-100" />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-auto min-w-48">
          <DropdownMenuLabel>Status ändern</DropdownMenuLabel>
          {transitions.isPending && <Spinner className="m-2" />}
          {transitions.error && <p className="p-2 text-sm text-destructive">{transitions.error.message}</p>}
          {transitions.data?.transitions.length === 0 && <p className="p-2 text-sm text-muted-foreground">Keine Übergänge möglich</p>}
          {transitions.data?.transitions.map((transition) => (
            <DropdownMenuItem
              key={transition.id}
              onSelect={() => flow.start(issueKey, [transition], transitions.data.current)}
              className="justify-between gap-4"
            >
              <span>{transition.name}</span>
              {transition.name !== transition.to.name && <JiraStatusBadge status={transition.to} />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {flow.dialog}
    </>
  );
}
