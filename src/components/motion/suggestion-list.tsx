import { useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useAnchorPosition } from "@/hooks/use-anchor-position";
import { EASE_OUT, SPRING_CURSOR, SPRING_PANEL } from "@/lib/ease";
import { listboxOptionId } from "@/lib/listbox";

export function SuggestionList<T>({
  id,
  label,
  open,
  anchor,
  items,
  getValue,
  renderItem,
  activeValue,
  onActiveChange,
  onSelect,
  status,
}: {
  id: string;
  label: string;
  open: boolean;
  anchor: (() => DOMRect | null) | null;
  items: readonly T[];
  getValue: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  activeValue: string | null;
  onActiveChange: (value: string) => void;
  onSelect: (item: T) => void;
  status?: ReactNode;
}) {
  const reduce = useReducedMotion();
  const positionerRef = useRef<HTMLDivElement>(null);
  useAnchorPosition({ open, anchor, floatingRef: positionerRef });

  return createPortal(
    <div ref={positionerRef} className="pointer-events-none fixed top-0 left-0 z-50">
      <AnimatePresence>
        {open && (
          <motion.div
            key="suggestions"
            style={{ transformOrigin: "top left" }}
            initial={{ opacity: 0, scale: reduce ? 1 : 0.96, y: reduce ? 0 : -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
            transition={reduce ? { duration: 0.15, ease: EASE_OUT } : SPRING_PANEL}
            className="pointer-events-auto flex w-64 flex-col gap-0.5 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
          >
            <div role="listbox" id={id} aria-label={label} className="flex flex-col gap-0.5">
              {items.map((item) => {
                const value = getValue(item);
                const active = value === activeValue;
                return (
                  <div
                    key={value}
                    id={listboxOptionId(id, value)}
                    role="option"
                    aria-selected={active}
                    onMouseDown={(event) => event.preventDefault()}
                    onPointerMove={() => onActiveChange(value)}
                    onClick={() => onSelect(item)}
                    className="relative isolate flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm"
                  >
                    {active && (
                      <motion.span
                        layoutId={`${id}-active`}
                        transition={reduce ? { duration: 0 } : SPRING_CURSOR}
                        className="absolute inset-0 -z-10 rounded-md bg-accent"
                      />
                    )}
                    {renderItem(item)}
                  </div>
                );
              })}
            </div>
            {status && (
              <p role="status" className="px-2 py-1.5 text-sm text-muted-foreground">
                {status}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
