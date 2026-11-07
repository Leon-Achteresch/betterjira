import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useRolloutForm } from "@/hooks/calendar/use-rollout-form";
import { errorMessage, REMINDER_OPTIONS } from "@/lib/calendar/presentation";
import type { RolloutFormTarget } from "@/types/calendar";
import { IssueLinkPicker } from "./issue-link-picker";

type RolloutFormProps = {
  target: RolloutFormTarget;
  onDone: () => void;
};

export function RolloutForm({ target, onDone }: RolloutFormProps) {
  const rollout = useRolloutForm(target, onDone);
  const { form, errors, update } = rollout;
  return (
    <form onSubmit={rollout.submit} noValidate className="flex min-h-0 flex-col gap-4">
      <FieldGroup className="gap-4">
        <Field data-invalid={!!errors.title || undefined}>
          <FieldLabel htmlFor="rollout-title">Titel</FieldLabel>
          <Input
            id="rollout-title"
            autoFocus
            required
            placeholder="z. B. Release 2.4 Produktion"
            value={form.title}
            aria-invalid={!!errors.title}
            onChange={(event) => update({ title: event.target.value })}
          />
          {errors.title && <FieldError>{errors.title}</FieldError>}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.start || undefined}>
            <FieldLabel htmlFor="rollout-start-date">Beginn</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="rollout-start-date"
                type="date"
                required
                value={form.startDate}
                aria-invalid={!!errors.start}
                onChange={(event) => rollout.setStart(event.target.value, form.startTime)}
              />
              <Input
                type="time"
                aria-label="Uhrzeit Beginn"
                required
                className="w-28"
                value={form.startTime}
                aria-invalid={!!errors.start}
                onChange={(event) => rollout.setStart(form.startDate, event.target.value)}
              />
            </div>
            {errors.start && <FieldError>{errors.start}</FieldError>}
          </Field>
          <Field data-invalid={!!errors.end || undefined}>
            <FieldLabel htmlFor="rollout-end-date">Ende</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="rollout-end-date"
                type="date"
                required
                value={form.endDate}
                aria-invalid={!!errors.end}
                onChange={(event) => update({ endDate: event.target.value })}
              />
              <Input
                type="time"
                aria-label="Uhrzeit Ende"
                required
                className="w-28"
                value={form.endTime}
                aria-invalid={!!errors.end}
                onChange={(event) => update({ endTime: event.target.value })}
              />
            </div>
            {errors.end && <FieldError>{errors.end}</FieldError>}
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="rollout-reminder">Erinnerung</FieldLabel>
          <Select value={String(form.reminderMinutes)} onValueChange={(value) => update({ reminderMinutes: Number(value) })}>
            <SelectTrigger id="rollout-reminder" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REMINDER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>Wird beim Synchronisieren als Outlook-Erinnerung gesetzt.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel>Verknüpfte Tickets</FieldLabel>
          <IssueLinkPicker
            linked={form.issues}
            available={rollout.issuePicker.available}
            unavailableReason={rollout.issuePicker.unavailableReason}
            checking={rollout.issuePicker.checking}
            query={rollout.issuePicker.query}
            results={rollout.issuePicker.results}
            searching={rollout.issuePicker.searching}
            error={rollout.issuePicker.error}
            onQueryChange={rollout.issuePicker.setQuery}
            onToggle={rollout.toggleIssue}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="rollout-notes">Notizen</FieldLabel>
          <Textarea
            id="rollout-notes"
            rows={3}
            placeholder="Ablauf, Ansprechpartner, Rollback-Plan …"
            value={form.notes}
            onChange={(event) => update({ notes: event.target.value })}
          />
        </Field>
      </FieldGroup>
      {rollout.saveError && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(rollout.saveError, "Rollout konnte nicht gespeichert werden.")}</AlertDescription>
        </Alert>
      )}
      {rollout.duplicating && (
        <p className="text-xs text-muted-foreground">Die Kopie wird erst mit „Anlegen“ als neuer lokaler Rollout gespeichert. Outlook-Verknüpfungen werden nicht übernommen.</p>
      )}
      {rollout.linkedToOutlook && (
        <p className="text-xs text-muted-foreground">Änderungen gelten zunächst nur lokal. Synchronisiere den Rollout danach erneut, um Outlook zu aktualisieren.</p>
      )}
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={rollout.pending}>
          {rollout.pending && <Spinner />}
          {rollout.editing ? "Speichern" : "Anlegen"}
        </Button>
      </DialogFooter>
    </form>
  );
}
