import {
  OverlayMotionProvider,
  OverlayPresence,
  OverlaySurface,
} from "@/components/motion/overlay-presence";
import { useOverlayState } from "@/components/motion/use-overlay-state";
import * as React from "react";
import { cn } from "@/lib/utils";
import { HoverCard as HoverCardPrimitive } from "radix-ui";

function HoverCard({
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Root>) {
  const state = useOverlayState(props);
  return (
    <OverlayMotionProvider open={state.open}>
      <HoverCardPrimitive.Root data-slot="hover-card" {...props} {...state} />
    </OverlayMotionProvider>
  );
}

function HoverCardTrigger({
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Trigger>) {
  return (
    <HoverCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />
  );
}

function HoverCardContent({
  className,
  children,
  align = "center",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Content>) {
  return (
    <HoverCardPrimitive.Portal forceMount data-slot="hover-card-portal">
      <OverlayPresence>
        <HoverCardPrimitive.Content
          forceMount
          asChild
          data-slot="hover-card-content"
          align={align}
          sideOffset={sideOffset}
          className={cn(
            "z-50 w-64 origin-(--radix-hover-card-content-transform-origin) rounded-2xl glass p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden",
            className,
          )}
          {...props}
        >
          <OverlaySurface>{children}</OverlaySurface>
        </HoverCardPrimitive.Content>
      </OverlayPresence>
    </HoverCardPrimitive.Portal>
  );
}

export { HoverCard, HoverCardTrigger, HoverCardContent };
