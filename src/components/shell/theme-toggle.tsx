import { Monitor, Moon, Sun } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTheme } from "next-themes";
import { Tooltip } from "@/components/motion/tooltip";
import { SPRING_PRESS, SPRING_SWAP } from "@/lib/ease";

const THEMES = {
  system: { next: "light", label: "Design: System", Icon: Monitor },
  light: { next: "dark", label: "Design: Hell", Icon: Sun },
  dark: { next: "system", label: "Design: Dunkel", Icon: Moon },
} as const;

type ThemeName = keyof typeof THEMES;

const isThemeName = (value: string | undefined): value is ThemeName => value !== undefined && value in THEMES;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const reduceMotion = useReducedMotion();
  const current = isThemeName(theme) ? theme : "system";
  const { next, label, Icon } = THEMES[current];
  const offset = reduceMotion ? 0 : 6;

  return (
    <Tooltip content={label} side="bottom">
      <motion.button
        type="button"
        aria-label={label}
        onClick={() => setTheme(next)}
        whileTap={reduceMotion ? undefined : { scale: 0.96 }}
        transition={SPRING_PRESS}
        className="relative inline-flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={current}
            initial={{ opacity: 0, y: offset }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -offset, transition: { duration: 0.12 } }}
            transition={SPRING_SWAP}
            className="inline-flex"
          >
            <Icon className="size-4" strokeWidth={1.75} />
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </Tooltip>
  );
}
