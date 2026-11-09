import type { ReactNode } from "react";
import {
  ChevronDownIcon,
  Clock3Icon,
  FlagIcon,
  FolderIcon,
} from "lucide-react";
import { PersonLabel } from "@/components/people/person-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { UserPicker } from "./user-picker";
import type { HelpdeskDetailModel } from "@/hooks/zammad/use-helpdesk-detail";
import type { Named } from "@/lib/zammad/model";

export function PropertySelect({
  name,
  label,
  value,
  current,
  options,
}: {
  name: string;
  label: string;
  value?: number;
  current?: string | null;
  options: readonly Named[];
}) {
  return (
    <label className="grid gap-1.5 text-xs text-muted-foreground">
      {label}
      <select
        aria-label={label}
        name={name}
        defaultValue={value}
        className="h-9 min-w-0 rounded-xl border bg-background px-3 text-sm text-foreground"
      >
        {value && <option value={value}>{current || `#${value}`}</option>}
        {options.map(
          (row) =>
            row.id !== value && (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ),
        )}
      </select>
    </label>
  );
}

function PropertyRow({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-9 grid-cols-[6rem_minmax(0,1fr)] items-center gap-2">
      <dt className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="min-w-0 text-[13px]">{children}</dd>
    </div>
  );
}

export function PropertyMenu({
  label,
  current,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  current: string;
  value: number;
  options: readonly Named[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          disabled={disabled}
          className="h-8 max-w-full justify-start gap-1 px-1.5 text-[13px] font-normal"
          aria-label={`${label} ändern`}
        >
          <span className="truncate">{current}</span>
          <ChevronDownIcon className="ml-auto size-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44">
        <DropdownMenuRadioGroup value={String(value)} onValueChange={onChange}>
          {options.map((option) => (
            <DropdownMenuRadioItem key={option.id} value={String(option.id)}>
              {option.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TicketProperties({ model }: { model: HelpdeskDetailModel }) {
  if (!model.ticket) return null;
  return (
    <aside
      aria-label="Ticketeigenschaften"
      className="flex min-w-0 flex-col gap-7 text-[13px]"
    >
      <section className="space-y-3">
        <h2 className="text-xs font-medium text-muted-foreground">Kunde</h2>
        <PersonLabel
          {...model.customerPerson}
          size="lg"
          subtitle={model.ticket.organization ?? model.customerPerson.email}
        />
        <p className="break-all pl-[3.125rem] text-xs text-muted-foreground">
          {model.customerPerson.email}
        </p>
        <UserPicker
          model={model.customer}
          triggerLabel="Kunde ändern"
          name="customer_id"
          label="Kunde"
          compact
        />
      </section>
      <section className="space-y-2">
        <h2 className="text-xs font-medium text-muted-foreground">Zuständig</h2>
        <UserPicker
          model={model.owner}
          person={model.ownerPerson}
          name="owner_id"
          label="Zuständig"
          compact
        />
      </section>
      <section className="space-y-2">
        <h2 className="text-xs font-medium text-muted-foreground">
          Eigenschaften
        </h2>
        <dl>
          <PropertyRow label="Status">
            <PropertyMenu
              label="Status"
              current={model.stateLabel}
              value={model.ticket.state_id}
              options={model.states}
              onChange={model.onStateChange}
              disabled={model.saving}
            />
          </PropertyRow>
          <PropertyRow
            label="Priorität"
            icon={<FlagIcon className="size-3.5" />}
          >
            <PropertyMenu
              label="Priorität"
              current={model.priorityLabel}
              value={model.ticket.priority_id}
              options={model.priorities}
              onChange={model.onPriorityChange}
              disabled={model.saving}
            />
          </PropertyRow>
          <PropertyRow
            label="Gruppe"
            icon={<FolderIcon className="size-3.5" />}
          >
            <PropertyMenu
              label="Gruppe"
              current={model.ticket.group ?? "Gruppe wählen"}
              value={model.ticket.group_id}
              options={model.groups}
              onChange={model.onGroupChange}
              disabled={model.saving}
            />
          </PropertyRow>
          <PropertyRow
            label="Wiedervorlage"
            icon={<Clock3Icon className="size-3.5" />}
          >
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-8 px-1.5 text-[13px] font-normal"
                >
                  {model.pendingTime || "Festlegen"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 space-y-2 p-4">
                <label className="grid gap-2 text-xs">
                  Warten bis
                  <Input
                    type="datetime-local"
                    name="pending_time"
                    aria-label="Warten bis"
                    defaultValue={model.pendingTime}
                    onBlur={model.onPendingBlur}
                    disabled={model.saving}
                  />
                </label>
              </PopoverContent>
            </Popover>
          </PropertyRow>
        </dl>
        {model.metadataError && (
          <p role="alert" className="text-xs text-destructive">
            {model.metadataError}
          </p>
        )}
      </section>
      <section className="space-y-2">
        <h2 className="text-xs font-medium text-muted-foreground">
          Ticketnotiz
        </h2>
        <Textarea
          name="note"
          aria-label="Ticketnotiz"
          defaultValue={model.ticket.note ?? ""}
          onBlur={model.onNoteBlur}
          placeholder="Notiz hinzufügen …"
          className="min-h-16 resize-none border-transparent bg-muted/30 text-xs shadow-none focus-visible:border-input"
          disabled={model.saving}
        />
      </section>
      <dl className="space-y-3 text-xs text-muted-foreground">
        <div className="flex justify-between gap-3">
          <dt>Erstellt</dt>
          <dd className="text-right tabular-nums">{model.created}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Aktualisiert</dt>
          <dd className="text-right tabular-nums">{model.updated}</dd>
        </div>
        {model.escalation && (
          <div className="flex justify-between gap-3">
            <dt>SLA-Eskalation</dt>
            <dd className="text-right tabular-nums">{model.escalation}</dd>
          </div>
        )}
      </dl>
    </aside>
  );
}
