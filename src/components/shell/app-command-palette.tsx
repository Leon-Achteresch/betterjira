import { SearchIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { CommandPalette } from "@/components/motion/command-palette";
import { useAppCommandPalette } from "@/hooks/use-app-command-palette";
import { SPRING_PRESS } from "@/lib/ease";
import { IS_MAC } from "@/lib/platform";

const MOD = IS_MAC ? "⌘" : "Strg";

export function AppCommandPalette() {
  const palette = useAppCommandPalette();
  const reduce = useReducedMotion();
  return (
    <>
      <motion.button
        type="button"
        data-tauri-drag-region="false"
        onClick={() => palette.setOpen(true)}
        whileHover={reduce ? undefined : { y: -1 }}
        whileTap={reduce ? undefined : { scale: 0.98 }}
        transition={SPRING_PRESS}
        className="group mx-3 flex h-7 w-full max-w-sm min-w-0 items-center gap-2 rounded-lg bg-sidebar-accent/60 px-2.5 text-sm text-muted-foreground ring-1 ring-transparent transition-colors hover:bg-sidebar-accent hover:text-foreground hover:ring-border"
      >
        <SearchIcon className="size-3.5 shrink-0" />
        <span className="flex-1 truncate text-left">Suchen…</span>
        <kbd className="hidden shrink-0 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] sm:inline-block">
          {MOD} K
        </kbd>
      </motion.button>
      <CommandPalette
        items={palette.items}
        open={palette.open}
        onOpenChange={palette.setOpen}
        onQueryChange={palette.setQuery}
        loading={palette.loading}
        placeholder="Vorgänge, Bereiche, Filter oder Befehle suchen…"
      />
    </>
  );
}
