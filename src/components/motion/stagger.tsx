import type { ComponentProps } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { EASE_OUT } from "@/lib/ease";

const container: Variants = { show: { transition: { staggerChildren: 0.03 } } };

const item: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.24, ease: EASE_OUT } },
};

const fadeItem: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2, ease: EASE_OUT } },
};

export function Stagger(props: ComponentProps<typeof motion.div>) {
  return <motion.div variants={container} initial="hidden" animate="show" {...props} />;
}

export function StaggerItem(props: ComponentProps<typeof motion.div>) {
  const reduce = useReducedMotion();
  return <motion.div variants={reduce ? fadeItem : item} {...props} />;
}
