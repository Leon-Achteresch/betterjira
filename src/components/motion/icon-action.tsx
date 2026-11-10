import { motion, useReducedMotion } from "motion/react";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import { SPRING_PRESS } from "@/lib/ease";
import type { IconActionProps } from "@/types/icon-action";

const MotionButton = motion.create(Button);

export function IconAction({ label, tooltip, onClick, pressed, className, children, ...buttonProps }: IconActionProps) {
  const reduce = useReducedMotion();
  return (
    <Tooltip content={tooltip}>
      <MotionButton
        {...buttonProps}
        variant="ghost"
        size="icon"
        aria-label={label}
        aria-pressed={pressed}
        onClick={onClick}
        whileTap={reduce ? undefined : { scale: 0.96 }}
        transition={SPRING_PRESS}
        className={className}
      >
        {children}
      </MotionButton>
    </Tooltip>
  );
}
