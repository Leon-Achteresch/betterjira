import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { EASE_OUT } from "@/lib/ease";

export function Fade({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
      transition={{ duration: 0.2, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}
