import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PersonLabel } from "@/components/people/person-label";
import type { UserPickerModel } from "@/hooks/zammad/use-user-picker";
import type { Person } from "@/lib/zammad/people";

export function UserPicker({
  model,
  name,
  label,
  person,
  triggerLabel,
  compact = false,
}: {
  model: UserPickerModel;
  name: string;
  label: string;
  person?: Person;
  triggerLabel?: string;
  compact?: boolean;
}) {
  return (
    <div className="grid min-w-0 gap-1">
      <input type="hidden" name={name} value={model.value} />
      {!compact && (
        <span className="text-xs text-muted-foreground">{label}</span>
      )}
      <Popover open={model.open} onOpenChange={model.setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="h-auto min-h-8 w-full justify-start px-1.5 py-1 text-left font-normal"
            aria-label={`${label} auswählen`}
          >
            {triggerLabel ? (
              triggerLabel
            ) : person ? (
              <PersonLabel {...person} size="sm" />
            ) : (
              model.label || "Person auswählen"
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 space-y-2 p-2">
          <Input
            aria-label={`${label} suchen`}
            placeholder="Name oder E-Mail suchen…"
            value={model.query}
            onChange={(event) => model.setQuery(event.target.value)}
          />
          {model.loading && <Skeleton className="h-9" />}
          {model.error && (
            <p role="alert" className="px-2 text-xs text-destructive">
              {model.error}
            </p>
          )}
          <div className="max-h-64 overflow-auto">
            {model.users.map((user) => (
              <Button
                key={user.id}
                type="button"
                variant="ghost"
                className="h-auto w-full justify-start px-2 py-2 text-left"
                onClick={() => model.onSelect(user.id, user.label)}
              >
                <PersonLabel
                  {...user.person}
                  subtitle={user.email ?? undefined}
                />
              </Button>
            ))}
          </div>
          {model.query.length >= 2 && !model.loading && !model.users.length && (
            <p className="p-2 text-xs text-muted-foreground">
              Keine Personen gefunden.
            </p>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
