import type { ComponentProps } from "react";
import { motion, useIsPresent, useReducedMotion, type Variants } from "motion/react";
import { EASE_OUT, MOTION_DURATION } from "@/lib/ease";

const container: Variants = {
  show: { transition: { staggerChildren: MOTION_DURATION.stagger } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.24, ease: EASE_OUT } },
};

const fadeItem: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2, ease: EASE_OUT } },
};

export function Stagger(props: ComponentProps<typeof motion.div>) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      {...props}
    />
  );
}

export function StaggerItem(props: ComponentProps<typeof motion.div>) {
  const reduce = useReducedMotion();
  const present = useIsPresent();
  return <motion.div variants={reduce ? fadeItem : item} {...props} inert={!present || props.inert} />;
}
