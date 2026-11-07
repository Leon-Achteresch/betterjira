import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import { SPRING_PRESS } from "@/lib/ease";

const MotionButton = motion.create(Button);

type IconActionProps = {
  label: string;
  tooltip: ReactNode;
  onClick: () => void;
  pressed?: boolean;
  className?: string;
  children: ReactNode;
};

export function IconAction({ label, tooltip, onClick, pressed, className, children }: IconActionProps) {
  const reduce = useReducedMotion();
  return (
    <Tooltip content={tooltip}>
      <MotionButton
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
