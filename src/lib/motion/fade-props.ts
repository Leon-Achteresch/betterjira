import { EASE_OUT } from "@/lib/ease";

export const fadeProps = (reduce: boolean | null, distance = 4) => ({
  initial: { opacity: 0, y: reduce ? 0 : distance },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, transition: { duration: 0.12 } },
  transition: { duration: 0.2, ease: EASE_OUT },
});
