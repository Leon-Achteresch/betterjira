import { useId, useRef, type ReactNode } from "react";
import { AnimatePresence } from "motion/react";
import { Fade } from "@/components/motion/fade";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
type Props = {
  title: string;
  triggerLabel: string;
  icon: ReactNode;
  children?: ReactNode;
  preview: {
    available: boolean;
    context: string;
    open: boolean;
    loading: boolean;
    error: string | null;
    setOpen: (open: boolean) => void;
    retry: () => void;
  };
};

export function IssueLinkPreviewPopover({
  title,
  triggerLabel,
  icon,
  children,
  preview,
}: Props) {
  const titleId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  if (!preview.available) return null;
  return (
    <Popover
      key={preview.context}
      open={preview.open}
      onOpenChange={preview.setOpen}
    >
      <Tooltip content={title}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={triggerLabel}
          >
            {icon}
          </Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent
        side="top"
        align="end"
        collisionPadding={12}
        aria-labelledby={titleId}
        className="w-[min(31rem,calc(100vw-1.5rem))] p-3"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          heading.current?.focus();
        }}
      >
        <h2
          id={titleId}
          ref={heading}
          tabIndex={-1}
          className="px-2 font-medium text-balance outline-none"
        >
          {title}
        </h2>
        <AnimatePresence initial={false} mode="wait">
          {children ? (
            <Fade key="comparison">{children}</Fade>
          ) : preview.error ? (
            <Fade key="error">
              <p role="alert" className="px-2 text-xs text-destructive">
                {preview.error}
              </p>
            </Fade>
          ) : (
            <Fade key="loading">
              <div
                role="status"
                aria-label="Beide Tickets werden geprüft"
                className="space-y-2 px-2 py-1"
              >
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-5/6" />
              </div>
            </Fade>
          )}
        </AnimatePresence>
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-8"
            onClick={() => preview.setOpen(false)}
          >
            {preview.loading ? "Abbrechen" : "Schließen"}
          </Button>
          {preview.error && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-8"
              onClick={() => {
                heading.current?.focus();
                preview.retry();
              }}
            >
              Erneut versuchen
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
