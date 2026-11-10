import * as React from "react";
import { cn } from "@/lib/utils";
import { Dialog as SheetPrimitive } from "radix-ui";
import {
  OverlayMotionProvider,
  OverlayPresence,
  OverlaySurface,
} from "@/components/motion/overlay-presence";
import { useOverlayState } from "@/components/motion/use-overlay-state";
import { useOverlayReturnFocus } from "@/hooks/use-overlay-return-focus";

import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  const state = useOverlayState(props);
  return (
    <OverlayMotionProvider open={state.open}>
      <SheetPrimitive.Root data-slot="sheet" {...props} {...state} />
    </OverlayMotionProvider>
  );
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  className,
  style,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <OverlayPresence>
      <SheetPrimitive.Overlay
        forceMount
        asChild
        data-slot="sheet-overlay"
        className={cn(
          "fixed inset-0 z-50 bg-black/10 supports-backdrop-filter:backdrop-blur-xs",
          className,
        )}
        {...props}
        style={style}
      >
        <OverlaySurface backdrop />
      </SheetPrimitive.Overlay>
    </OverlayPresence>
  );
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  style,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  side?: "top" | "right" | "bottom" | "left";
  showCloseButton?: boolean;
}) {
  const focus = useOverlayReturnFocus({ onOpenAutoFocus, onCloseAutoFocus });
  return (
    <SheetPortal forceMount>
      <SheetOverlay />
      <OverlayPresence>
        <SheetPrimitive.Content
          forceMount
          asChild
          data-slot="sheet-content"
          data-side={side}
          className={cn(
            "fixed z-50 flex flex-col gap-4 rounded-2xl glass bg-clip-padding text-sm text-popover-foreground shadow-xl data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-full data-[side=left]:border-r data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-full data-[side=right]:border-l data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm",
            className,
          )}
          {...props}
          {...focus}
          style={style}
        >
          <OverlaySurface side={side}>
            {children}
            {showCloseButton && (
              <SheetPrimitive.Close data-slot="sheet-close" asChild>
                <Button
                  variant="ghost"
                  className="absolute top-3 right-3"
                  size="icon-sm"
                >
                  <XIcon />
                  <span className="sr-only">Close</span>
                </Button>
              </SheetPrimitive.Close>
            )}
          </OverlaySurface>
        </SheetPrimitive.Content>
      </OverlayPresence>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-0.5 p-4", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "font-heading text-base font-medium text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
