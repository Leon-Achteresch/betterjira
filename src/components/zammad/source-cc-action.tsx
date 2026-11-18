import { useId, useRef } from "react";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import type { ZammadSourceCcModel } from "@/hooks/zammad/use-zammad-source-cc";

export function SourceCcAction({ model }: { model: ZammadSourceCcModel }) {
  const titleId = useId();
  const title = useRef<HTMLHeadingElement>(null);
  return (
    <Popover open={model.open} onOpenChange={model.setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="ml-12 h-8 px-2 text-xs text-muted-foreground"
        >
          CC aus Quellmail prüfen
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-labelledby={titleId}
        className="max-w-[calc(100vw-1rem)] p-3"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          title.current?.focus();
        }}
      >
        <h2
          id={titleId}
          ref={title}
          tabIndex={-1}
          className="font-medium outline-none text-balance"
        >
          CC aus der Quellmail
        </h2>
        {model.loading ? (
          <div
            role="status"
            aria-label="Quellmail wird geprüft"
            className="space-y-2 py-1"
          >
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-5 w-3/5" />
          </div>
        ) : model.addresses.length ? (
          <Stagger role="group" aria-label="CC-Adressen aus der Quellmail">
            {model.addresses.map((address) => (
              <StaggerItem key={address}>
                <label className="flex min-h-8 cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1 text-xs hover:bg-muted/60">
                  <Checkbox
                    checked={model.checked.includes(address)}
                    disabled={model.checking}
                    onCheckedChange={() => model.toggle(address)}
                  />
                  <span className="min-w-0 break-all">{address}</span>
                </label>
              </StaggerItem>
            ))}
          </Stagger>
        ) : (
          !model.error && (
            <p role="status" className="text-xs text-muted-foreground">
              Keine sicher lesbaren CC-Adressen in dieser Quellmail.
            </p>
          )
        )}
        {model.error && (
          <p role="alert" className="text-xs text-destructive">
            {model.error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            className="h-8 text-xs"
            onClick={() => model.setOpen(false)}
          >
            Abbrechen
          </Button>
          {model.addresses.length > 0 && (
            <Button
              type="button"
              className="h-8 text-xs"
              disabled={!model.checked.length || model.checking}
              onClick={model.insert}
            >
              Auswahl übernehmen
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
