"use client";

import type { ComponentProps } from "react";
import { Collapsible as CollapsiblePrimitive } from "radix-ui";
import {
  OverlayMotionProvider,
  OverlayPresence,
  OverlaySurface,
} from "@/components/motion/overlay-presence";
import { useOverlayState } from "@/components/motion/use-overlay-state";

function Collapsible(props: ComponentProps<typeof CollapsiblePrimitive.Root>) {
  const state = useOverlayState(props);
  return (
    <OverlayMotionProvider open={state.open}>
      <CollapsiblePrimitive.Root
        data-slot="collapsible"
        {...props}
        {...state}
      />
    </OverlayMotionProvider>
  );
}

function CollapsibleTrigger(
  props: ComponentProps<typeof CollapsiblePrimitive.Trigger>,
) {
  return (
    <CollapsiblePrimitive.Trigger data-slot="collapsible-trigger" {...props} />
  );
}

function CollapsibleContent({
  children,
  ...props
}: ComponentProps<typeof CollapsiblePrimitive.Content>) {
  return (
    <OverlayPresence>
      <CollapsiblePrimitive.Content
        forceMount
        asChild
        data-slot="collapsible-content"
        {...props}
      >
        <OverlaySurface>{children}</OverlaySurface>
      </CollapsiblePrimitive.Content>
    </OverlayPresence>
  );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
