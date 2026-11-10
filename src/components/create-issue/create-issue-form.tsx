import type { ReactNode } from "react";
import { AlertCircleIcon, ExternalLinkIcon, InfoIcon, LockIcon, RotateCwIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AdfEditor } from "@/components/adf-editor";
import { JiraFieldInput } from "@/components/jira-field-input";
import { ProjectAvatar } from "@/components/shell/project-avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { fieldInputId, type CreateIssueForm as CreateIssueFormModel } from "@/hooks/jira/use-create-issue-form";
import { EASE_OUT } from "@/lib/ease";
import { IS_MAC } from "@/lib/platform";

const NOTICES = {
  "no-permission": {
    icon: LockIcon,
    title: "Keine Berechtigung zum Erstellen",
    text: "In diesem Projekt darfst du keine Tickets anlegen. Wähle ein anderes Projekt oder frag die Projektverwaltung.",
  },
  "no-types": {
    icon: InfoIcon,
    title: "Kein Vorgangstyp verfügbar",
    text: "Jira liefert für dieses Projekt keinen Vorgangstyp, den betterjira anlegen kann. Unteraufgaben werden hier noch nicht unterstützt.",
  },
  blocked: {
    icon: InfoIcon,
    title: "Erstellen hier nicht möglich",
    text: "Dieser Vorgangstyp verlangt Pflichtfelder, die betterjira noch nicht ausfüllen kann:",
  },
} as const;

function FieldBlock({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
        {required && <span aria-hidden className="text-destructive">*</span>}
      </Label>
      {children}
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            id={`${id}-error`}
            role="alert"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.15, ease: EASE_OUT }}
            className="text-xs text-destructive"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export function CreateIssueForm({ form }: { form: CreateIssueFormModel }) {
  const reduce = useReducedMotion();
  const enter = { opacity: 0, y: reduce ? 0 : 6 };
  const shown = { opacity: 1, y: 0 };
  const leave = { opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } };
  const fieldError = (id: string, label: string) => form.errors.fields[id] ?? (form.missing.has(id) ? `${label} fehlt` : undefined);
  const notice = form.status in NOTICES ? NOTICES[form.status as keyof typeof NOTICES] : undefined;
  const canSubmit = form.status === "ready" && !form.pending;

  return (
    <form onSubmit={form.submit} onKeyDown={form.onKeyDown} aria-busy={form.pending} className="flex flex-col gap-6" noValidate>
      <fieldset disabled={form.pending} className="flex min-w-0 flex-col gap-5 rounded-2xl border bg-card p-4 shadow-xs sm:p-6">
        <legend className="sr-only">Neues Ticket</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldBlock id="create-project" label="Projekt" required>
            {form.projectsLoading ? (
              <Skeleton className="h-8 w-full rounded-lg" />
            ) : (
              <Select value={form.project?.id ?? ""} onValueChange={form.selectProject}>
                <SelectTrigger id="create-project" className="w-full">
                  <SelectValue placeholder={form.projects.length ? "Projekt wählen…" : "Keine Projekte sichtbar"} />
                </SelectTrigger>
                <SelectContent>
                  {form.projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      <ProjectAvatar project={project} className="size-4" />
                      <span className="truncate">{project.name}</span>
                      <span className="text-xs text-muted-foreground">{project.key}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FieldBlock>
          <FieldBlock id="create-type" label="Vorgangstyp" required>
            {form.project && form.status === "loading" && !form.issueType ? (
              <Skeleton className="h-8 w-full rounded-lg" />
            ) : (
              <Select value={form.issueType?.id ?? ""} onValueChange={form.selectIssueType} disabled={form.issueTypes.length === 0}>
                <SelectTrigger id="create-type" className="w-full">
                  <SelectValue placeholder={form.project ? "Kein Typ verfügbar" : "Erst Projekt wählen"} />
                </SelectTrigger>
                <SelectContent>
                  {form.issueTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id} disabled={type.subtask}>
                      {type.iconUrl && <img src={type.iconUrl} alt="" className="size-4" />}
                      {type.name}
                      {type.subtask && <span className="text-xs text-muted-foreground">nur in Jira</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FieldBlock>
        </div>

        <FieldBlock id="create-summary" label="Titel" required error={fieldError("summary", "Titel")}>
          <Input
            id="create-summary"
            value={form.summary}
            autoFocus
            autoComplete="off"
            placeholder="Was ist zu tun?"
            aria-invalid={!!fieldError("summary", "Titel")}
            aria-describedby={fieldError("summary", "Titel") ? "create-summary-error" : undefined}
            onChange={(event) => form.setSummary(event.target.value)}
          />
        </FieldBlock>

        <AnimatePresence initial={false} mode="popLayout">
          {form.showDescription && (
            <motion.div key="description" initial={enter} animate={shown} exit={leave} transition={{ duration: 0.2, ease: EASE_OUT }}>
              <FieldBlock
                id="create-field-description"
                label={form.plan.description?.name ?? "Beschreibung"}
                required={form.plan.description?.required}
                error={fieldError("description", "Beschreibung")}
              >
                <AdfEditor id="create-field-description" label="Beschreibung" value={form.description} onChange={form.setDescription} />
              </FieldBlock>
            </motion.div>
          )}
        </AnimatePresence>
        {form.descriptionIgnored && (
          <p role="status" className="text-xs text-muted-foreground">
            Dieser Vorgangstyp hat keine Beschreibung. Dein Text bleibt hier erhalten, wird aber nicht übertragen.
          </p>
        )}

        <AnimatePresence mode="wait" initial={false}>
          {form.fieldsLoading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={leave} className="flex flex-col gap-3" aria-hidden>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-full rounded-lg" />
            </motion.div>
          ) : form.plan.inputs.length > 0 ? (
            <motion.section
              key={`${form.project?.id}/${form.issueType?.id}`}
              aria-labelledby="create-required"
              initial="hidden"
              animate="shown"
              exit={leave}
              variants={{ hidden: {}, shown: { transition: { staggerChildren: 0.03 } } }}
              className="flex flex-col gap-4 border-t pt-5"
            >
              <h2 id="create-required" className="text-sm font-medium text-balance">
                Pflichtfelder für {form.issueType?.name}
              </h2>
              {form.plan.inputs.map((input) => {
                const id = fieldInputId(input.field.fieldId);
                return (
                  <motion.div
                    key={input.field.fieldId}
                    variants={{ hidden: enter, shown }}
                    transition={{ duration: 0.18, ease: EASE_OUT }}
                  >
                    <FieldBlock id={id} label={input.field.name} required error={fieldError(input.field.fieldId, input.field.name)}>
                      <JiraFieldInput
                        id={id}
                        field={input.field}
                        kind={input.kind}
                        value={form.valueOf(input)}
                        onChange={(value) => form.setValue(input.field.fieldId, value)}
                      />
                    </FieldBlock>
                  </motion.div>
                );
              })}
            </motion.section>
          ) : null}
        </AnimatePresence>

        <AnimatePresence mode="wait" initial={false}>
          {notice ? (
            <motion.div key={form.status} initial={enter} animate={shown} exit={leave} transition={{ duration: 0.2, ease: EASE_OUT }}>
              <Alert variant="warning" className="rounded-xl">
                <notice.icon />
                <AlertTitle>{notice.title}</AlertTitle>
                <AlertDescription>
                  <p>{notice.text}</p>
                  {form.status === "blocked" && (
                    <ul className="mt-1 list-disc pl-5">
                      {form.plan.blocked.map((field) => (
                        <li key={field.fieldId}>{field.name}</li>
                      ))}
                    </ul>
                  )}
                </AlertDescription>
              </Alert>
            </motion.div>
          ) : form.status === "load-error" ? (
            <motion.div key="load-error" initial={enter} animate={shown} exit={leave} transition={{ duration: 0.2, ease: EASE_OUT }}>
              <Alert variant="destructive" className="rounded-xl">
                <AlertCircleIcon />
                <AlertTitle>Angaben zum Erstellen konnten nicht geladen werden</AlertTitle>
                <AlertDescription>
                  <p>{form.loadError}</p>
                  <Button type="button" variant="outline" size="sm" className="mt-2" onClick={form.retryLoad}>
                    <RotateCwIcon />
                    Erneut laden
                  </Button>
                </AlertDescription>
              </Alert>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {form.errors.global.length > 0 && (
            <motion.div initial={enter} animate={shown} exit={leave} transition={{ duration: 0.2, ease: EASE_OUT }}>
              <Alert variant="destructive" className="rounded-xl">
                <AlertCircleIcon />
                <AlertTitle>{form.errors.uncertain ? "Ergebnis konnte nicht bestätigt werden" : "Ticket wurde nicht erstellt"}</AlertTitle>
                <AlertDescription className="[&_p:not(:last-child)]:mb-1">
                  {form.errors.global.map((message) => (
                    <p key={message}>{message}</p>
                  ))}
                  {form.errors.uncertain && <p>Prüfe in Jira, ob das Ticket schon angelegt wurde, bevor du es erneut versuchst.</p>}
                  <p>Deine Eingaben bleiben erhalten.</p>
                </AlertDescription>
              </Alert>
            </motion.div>
          )}
        </AnimatePresence>
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        {form.project && (
          <Button type="button" variant="ghost" onClick={form.openInJira} disabled={form.pending}>
            <ExternalLinkIcon />
            In Jira öffnen
          </Button>
        )}
        <span className="ml-auto hidden items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
          <KbdGroup>
            <Kbd>{IS_MAC ? "⌘" : "Strg"}</Kbd>
            <Kbd>Enter</Kbd>
          </KbdGroup>
        </span>
        <Button type="submit" disabled={!canSubmit} className="max-sm:ml-auto">
          {form.pending && <Spinner />}
          {form.pending ? "Wird erstellt…" : "Erstellen"}
        </Button>
      </div>
    </form>
  );
}
