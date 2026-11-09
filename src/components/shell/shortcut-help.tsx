import { Fragment } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SearchXIcon, XIcon } from "lucide-react";
import { SearchField } from "@/components/motion/search-field";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useShortcutHelpSearch } from "@/hooks/use-shortcut-help-search";
import { EASE_OUT } from "@/lib/ease";

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
  const reduce = useReducedMotion();
  const search = useShortcutHelpSearch(groups, open);
  const fade = {
    initial: { opacity: 0, y: reduce ? 0 : 4 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } },
    transition: { duration: 0.18, ease: EASE_OUT },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={search.contentRef}
        showCloseButton={false}
        onOpenAutoFocus={search.handleOpenAutoFocus}
        onCloseAutoFocus={search.handleCloseAutoFocus}
        onEscapeKeyDown={search.handleEscapeKeyDown}
        className="flex max-h-[min(44rem,calc(100dvh-2rem))] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl"
      >
        <div className="flex flex-col gap-4 border-b border-border/60 p-4 sm:p-6 sm:pb-4">
          <DialogHeader className="gap-2">
            <div className="flex items-start justify-between gap-4">
              <DialogTitle className="text-lg font-semibold tracking-tight text-balance">Tastenkürzel</DialogTitle>
              <Tooltip
                content={
                  <span className="flex items-center gap-2">
                    Schließen <Kbd>Esc</Kbd>
                  </span>
                }
                side="bottom"
              >
                <DialogClose asChild>
                  <Button variant="ghost" size="icon" className="-mt-1 -mr-2 rounded-xl" aria-label="Schließen">
                    <XIcon />
                  </Button>
                </DialogClose>
              </Tooltip>
            </div>
            <DialogDescription>
              Mit <Kbd>?</Kbd> öffnest du diese Übersicht jederzeit. Einzeltasten wirken nicht, solange du in einem Textfeld
              tippst.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <SearchField
              value={search.query}
              onChange={search.setQuery}
              label="Tastenkürzel durchsuchen"
              placeholder="Aktion, Bereich oder Taste suchen"
              className="[&_input::-webkit-search-cancel-button]:hidden"
            />
            <p aria-live="polite" className="text-xs text-muted-foreground tabular-nums">
              {search.query
                ? `${search.resultCount} von ${search.totalCount} Tastenkürzeln`
                : `${search.totalCount} Tastenkürzel`}
            </p>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 sm:pt-4">
          <AnimatePresence mode="wait" initial={false}>
            {search.results.length > 0 ? (
              <motion.div key="results" {...fade} className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
                {search.results.map(({ group, shortcuts }) => (
                  <section key={group} className="flex min-w-0 flex-col gap-1">
                    <h3 className="pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{group}</h3>
                    <Stagger className="flex flex-col">
                      {shortcuts.map((shortcut) => (
                        <StaggerItem
                          key={shortcut.id}
                          className="flex items-center justify-between gap-4 border-b border-border/60 py-2 text-sm last:border-b-0"
                        >
                          <span className="min-w-0 truncate">{shortcut.label}</span>
                          <ShortcutKeys keys={shortcut.keys} />
                        </StaggerItem>
                      ))}
                    </Stagger>
                  </section>
                ))}
              </motion.div>
            ) : (
              <motion.div key="empty" {...fade}>
                <Empty className="py-8">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <SearchXIcon />
                    </EmptyMedia>
                    <EmptyTitle>Kein Tastenkürzel gefunden</EmptyTitle>
                    <EmptyDescription>
                      Für „{search.query.trim()}“ gibt es keinen Treffer. Suche nach einer Aktion wie „Zurück“, einem
                      Bereich wie „Navigation“ oder einer Taste wie „Strg“.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button variant="outline" className="rounded-xl" onClick={search.reset}>
                      Suche zurücksetzen
                    </Button>
                  </EmptyContent>
                </Empty>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
