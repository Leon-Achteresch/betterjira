import { type KeyboardEvent, useEffect, useId, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { PinIcon, XIcon } from "lucide-react";
import { SearchField } from "@/components/motion/search-field";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Tooltip } from "@/components/motion/tooltip";
import type { IssueTab } from "@/components/shell/issue-tabs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useOverlayReturnFocus } from "@/hooks/use-overlay-return-focus";
import { EASE_OUT, SPRING_CURSOR } from "@/lib/ease";
import { cn } from "@/lib/utils";

type OpenTabSearchProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: string;
  onQueryChange: (query: string) => void;
  results: IssueTab[];
  total: number;
  activeKey?: string;
  highlighted?: string;
  onHighlight: (key: string) => void;
  onKeyDown: (event: KeyboardEvent) => void;
  onSelect: (key: string) => void;
  fallbackFocus: () => HTMLElement | null;
};

export function OpenTabSearch({
  open,
  onOpenChange,
  query,
  onQueryChange,
  results,
  total,
  activeKey,
  highlighted,
  onHighlight,
  onKeyDown,
  onSelect,
  fallbackFocus,
}: OpenTabSearchProps) {
  const reduce = useReducedMotion();
  const uid = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const focus = useOverlayReturnFocus({
    fallbackFocus,
    onOpenAutoFocus: (event) => {
      event.preventDefault();
      inputRef.current?.focus();
    },
  });
  const optionId = (key: string) => `${uid}-${key}`;

  useEffect(() => {
    if (open && highlighted) document.getElementById(`${uid}-${highlighted}`)?.scrollIntoView({ block: "nearest" });
  }, [open, highlighted, uid]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        {...focus}
        showCloseButton={false}
        className="flex max-h-[min(34rem,calc(100dvh-2rem))] flex-col gap-3 rounded-2xl p-3 sm:max-w-md motion-reduce:data-open:animate-none motion-reduce:data-closed:animate-none"
      >
        <div className="flex items-start gap-2 pl-1">
          <div className="grid min-w-0 flex-1 gap-1 pt-1">
            <DialogTitle className="flex items-center gap-2 text-balance">
              Geöffnete Tickets
              <span className="text-xs font-normal text-muted-foreground tabular-nums">{total}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">Nach Schlüssel oder bekanntem Titel suchen.</DialogDescription>
          </div>
          <Tooltip content="Schließen" side="bottom">
            <DialogClose asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Schließen" className="shrink-0">
                <XIcon />
              </Button>
            </DialogClose>
          </Tooltip>
        </div>
        <div>
          <SearchField
            ref={inputRef}
            onKeyDown={onKeyDown}
            value={query}
            onChange={onQueryChange}
            label="Geöffnete Tickets durchsuchen"
            placeholder="Schlüssel oder Titel…"
            role="combobox"
            aria-expanded="true"
            aria-controls={`${uid}-list`}
            aria-autocomplete="list"
            aria-activedescendant={highlighted ? optionId(highlighted) : undefined}
          />
        </div>
        <p aria-live="polite" className="sr-only">
          {query ? `${results.length} Treffer` : ""}
        </p>
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1">
          <AnimatePresence mode="popLayout">
            {results.length > 0 ? (
              <Stagger
                key="results"
                id={`${uid}-list`}
                role="listbox"
                aria-label="Geöffnete Tickets"
                exit={{ opacity: 0, transition: { duration: 0.1, ease: EASE_OUT } }}
              >
                {results.map((tab) => {
                  const isHighlighted = tab.key === highlighted;
                  const isActive = tab.key === activeKey;
                  return (
                    <StaggerItem
                      key={tab.key}
                      id={optionId(tab.key)}
                      role="option"
                      aria-selected={isHighlighted}
                      aria-current={isActive ? "page" : undefined}
                      title={tab.title ? `${tab.label ?? tab.key} · ${tab.title}` : (tab.label ?? tab.key)}
                      onPointerMove={() => !isHighlighted && onHighlight(tab.key)}
                      onClick={() => onSelect(tab.key)}
                      className={cn(
                        "relative isolate flex min-h-9 cursor-default items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm",
                        isHighlighted ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {isHighlighted ? (
                        <motion.span
                          layoutId={`${uid}-highlight`}
                          transition={reduce ? { duration: 0 } : SPRING_CURSOR}
                          className="absolute inset-0 -z-10 rounded-xl bg-muted"
                        />
                      ) : null}
                      <span className="w-3.5 shrink-0">
                        {tab.pinned ? <PinIcon aria-hidden className="size-3.5 text-muted-foreground" /> : null}
                      </span>
                      <span className="shrink-0 font-medium text-foreground tabular-nums">{tab.label ?? tab.key}</span>{" "}
                      {tab.title ? (
                        <span className="min-w-0 flex-1 truncate">{tab.title}</span>
                      ) : (
                        <span className="min-w-0 flex-1 truncate italic">Titel nicht geladen</span>
                      )}
                      {tab.pinned ? <span className="sr-only">(angeheftet)</span> : null}
                      {isActive ? (
                        <span className="shrink-0 rounded-md bg-primary/12 px-1.5 py-0.5 text-[11px] font-medium text-foreground">
                          Aktuell
                        </span>
                      ) : null}
                    </StaggerItem>
                  );
                })}
              </Stagger>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: reduce ? 0 : 4 }}
                animate={{ opacity: 1, y: 0, transition: { duration: 0.18, ease: EASE_OUT } }}
                exit={{ opacity: 0, transition: { duration: 0.1, ease: EASE_OUT } }}
                className="flex flex-col items-center gap-3 px-4 py-8 text-center text-sm text-muted-foreground"
              >
                {total === 0 ? (
                  "Keine Tickets geöffnet."
                ) : (
                  <>
                    <p className="text-balance">Kein geöffnetes Ticket passt zu „{query.trim()}“.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onQueryChange("");
                        inputRef.current?.focus();
                      }}
                    >
                      Suche zurücksetzen
                    </Button>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
