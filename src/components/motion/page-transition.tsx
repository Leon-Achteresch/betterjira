import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { FADE_IN } from "@/lib/ease";

export function PageTransition({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      key={id}
      initial={{ opacity: 0, y: reduce ? 0 : 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={FADE_IN}
      className="flex flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}
