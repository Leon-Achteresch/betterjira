import { Fragment } from "react";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

type ShortcutEntry = { id: string; label: string; keys: string[][] };

export function ShortcutKeys({ keys }: { keys: string[][] }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {keys.map((step, index) => (
        <Fragment key={index}>
          {index > 0 && <span className="text-[11px] text-muted-foreground">dann</span>}
          <KbdGroup>
            {step.map((key) => (
              <Kbd key={key} className="min-w-6 bg-background shadow-xs ring-1 ring-border">
                {key}
              </Kbd>
            ))}
          </KbdGroup>
        </Fragment>
      ))}
    </span>
  );
}

export function ShortcutHelp({
  open,
  onOpenChange,
  groups,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: { group: string; shortcuts: ShortcutEntry[] }[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-6 p-6 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold tracking-tight">Tastenkürzel</DialogTitle>
          <DialogDescription>
            Mit <Kbd>?</Kbd> öffnest du diese Übersicht jederzeit. Einzeltasten wirken nicht, solange du in einem Textfeld
            tippst.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {groups.map(({ group, shortcuts }) => (
            <section key={group} className="flex flex-col gap-1">
              <h3 className="pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{group}</h3>
              <Stagger className="flex flex-col">
                {shortcuts.map((shortcut) => (
                  <StaggerItem
                    key={shortcut.id}
                    className="flex items-center justify-between gap-4 border-b border-border/60 py-2 text-sm last:border-b-0"
                  >
                    <span className="truncate">{shortcut.label}</span>
                    <ShortcutKeys keys={shortcut.keys} />
                  </StaggerItem>
                ))}
              </Stagger>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
