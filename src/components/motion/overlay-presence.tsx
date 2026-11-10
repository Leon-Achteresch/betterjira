import { createContext, useContext, type ReactNode } from "react";
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
  type HTMLMotionProps,
} from "motion/react";
import { FADE_IN, FADE_OUT, SPRING_PANEL } from "@/lib/ease";

const OverlayContext = createContext(false);

export function OverlayMotionProvider({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  return (
    <OverlayContext.Provider value={open}>{children}</OverlayContext.Provider>
  );
}

export function OverlayPresence({ children }: { children: ReactNode }) {
  const open = useContext(OverlayContext);
  return <AnimatePresence>{open ? children : null}</AnimatePresence>;
}

export function OverlaySurface({
  style,
  backdrop = false,
  side,
  ...props
}: HTMLMotionProps<"div"> & {
  backdrop?: boolean;
  side?: "top" | "right" | "bottom" | "left";
}) {
  const reduce = useReducedMotion();
  const present = useIsPresent();
  const closed = {
    opacity: 0,
    scale: reduce || backdrop || side ? 1 : 0.97,
    x:
      reduce || backdrop
        ? 0
        : side === "left"
          ? -12
          : side === "right"
            ? 12
            : 0,
    y:
      reduce || backdrop
        ? 0
        : side === "top"
          ? -12
          : side === "bottom"
            ? 12
            : side
              ? 0
              : 6,
  };
  return (
    <motion.div
      data-motion-surface=""
      initial={closed}
      animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
      exit={{ ...closed, transition: FADE_OUT }}
      transition={reduce || backdrop ? FADE_IN : SPRING_PANEL}
      {...props}
      inert={!present}
      style={{ ...style, ...(!present && { pointerEvents: "none" }) }}
    />
  );
}
