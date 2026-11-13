import { AnimatePresence } from "motion/react";
import { PencilIcon } from "lucide-react";
import { UserPicker } from "@/components/jira-field-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Fade } from "@/components/motion/fade";
import type { BulkEditState } from "@/hooks/jira/use-bulk-edit";

export function BulkEditMenu({
  state,
  disabled,
}: {
  state: BulkEditState;
  disabled: boolean;
}) {
  return (
    <Popover open={state.open} onOpenChange={state.setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <PencilIcon />
          Bearbeiten
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 max-w-[calc(100vw-2rem)] p-3"
        aria-label="Sammelbearbeitung"
      >
        <p className="font-medium text-balance">
          Ausgewählte Vorgänge bearbeiten
        </p>
        <p className="text-xs text-muted-foreground">
          Nur die ausgewählten geladenen Tickets werden geändert. Jira prüft die
          Berechtigung für jedes Ticket.
        </p>
        {state.loading ? (
          <Skeleton className="h-20 rounded-xl" />
        ) : state.error ? (
          <div role="alert" className="text-sm">
            <p>Bearbeitbare Felder konnten nicht geladen werden.</p>
            <Button variant="outline" size="sm" onClick={state.reload}>
              Erneut laden
            </Button>
          </div>
        ) : (
          <>
            <Label htmlFor="bulk-operation">Änderung</Label>
            <Select
              value={state.operation}
              onValueChange={state.setOperation}
              disabled={state.pending}
            >
              <SelectTrigger id="bulk-operation" className="w-full rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="self" disabled={!state.options.assign}>
                  Mir zuweisen
                </SelectItem>
                <SelectItem value="person" disabled={!state.options.assign}>
                  Person zuweisen
                </SelectItem>
                <SelectItem
                  value="unassigned"
                  disabled={!state.options.unassign}
                >
                  Zuweisung entfernen
                </SelectItem>
                <SelectItem
                  value="priority"
                  disabled={!state.options.priorities.length}
                >
                  Priorität ändern
                </SelectItem>
                <SelectItem
                  value="status"
                  disabled={!state.options.statuses.length}
                >
                  Status ändern
                </SelectItem>
                <SelectItem
                  value="add-labels"
                  disabled={!state.options.addLabels}
                >
                  Labels hinzufügen
                </SelectItem>
                <SelectItem
                  value="remove-labels"
                  disabled={!state.options.removeLabels}
                >
                  Labels entfernen
                </SelectItem>
              </SelectContent>
            </Select>
            <AnimatePresence initial={false} mode="wait">
              {state.operation === "status" && (
                <Fade key="status">
                  <Label htmlFor="bulk-status">Neuer Status</Label>
                  <Select
                    value={state.status}
                    onValueChange={state.setStatus}
                    disabled={state.pending}
                  >
                    <SelectTrigger
                      id="bulk-status"
                      className="mt-2 w-full rounded-xl"
                    >
                      <SelectValue placeholder="Status wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {state.options.statuses.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Gemeinsame Statuswechsel ohne zusätzliche Pflichtangaben.
                  </p>
                </Fade>
              )}
              {state.operation === "person" && (
                <Fade key="person">
                  <Label htmlFor="bulk-assignee">Person</Label>
                  <fieldset disabled={state.pending} className="mt-2">
                    <UserPicker
                      id="bulk-assignee"
                      value={state.assignee}
                      multiple={false}
                      scope={state.userScope}
                      onChange={state.setAssignee}
                    />
                  </fieldset>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Vorschläge für das erste Ticket; Jira prüft die Zuweisung
                    für jedes Ticket.
                  </p>
                </Fade>
              )}
              {state.operation === "priority" && (
                <Fade key="priority">
                  <Label htmlFor="bulk-priority">Priorität</Label>
                  <Select
                    value={state.priority}
                    onValueChange={state.setPriority}
                    disabled={state.pending}
                  >
                    <SelectTrigger
                      id="bulk-priority"
                      className="mt-2 w-full rounded-xl"
                    >
                      <SelectValue placeholder="Priorität wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {state.options.priorities.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Fade>
              )}
              {(state.operation === "add-labels" ||
                state.operation === "remove-labels") && (
                <Fade key="labels">
                  <Label htmlFor="bulk-labels">
                    Labels, durch Komma getrennt
                  </Label>
                  <Input
                    id="bulk-labels"
                    className="mt-2 rounded-xl"
                    value={state.labelsText}
                    onChange={(event) =>
                      state.setLabelsText(event.target.value)
                    }
                    placeholder="frontend, review"
                    disabled={state.pending}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ohne Leerzeichen. Andere Labels bleiben erhalten.
                  </p>
                </Fade>
              )}
            </AnimatePresence>
            <Button onClick={state.submit} disabled={!state.canSubmit}>
              {state.pending ? "Wird angewendet…" : "Änderung anwenden"}
            </Button>
          </>
        )}
        {state.total > 0 && (
          <Fade>
            <p role="status" className="text-xs tabular-nums">
              {state.succeeded} von {state.total} geändert
              {state.failed > 0 ? ` · ${state.failed} fehlgeschlagen` : ""}
            </p>
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
              {state.errors.map(({ key, error }) => (
                <li key={key} className="text-destructive">
                  {key}: {error}
                </li>
              ))}
            </ul>
            {state.failed > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                disabled={state.pending || disabled}
                onClick={state.retry}
              >
                Nur fehlgeschlagene wiederholen
              </Button>
            )}
          </Fade>
        )}
      </PopoverContent>
    </Popover>
  );
}
