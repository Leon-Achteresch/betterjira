import { SearchIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { CommandPalette } from "@/components/motion/command-palette";
import { Tooltip } from "@/components/motion/tooltip";
import { useAppCommandPalette } from "@/hooks/use-app-command-palette";
import { SPRING_PRESS } from "@/lib/ease";
import { IS_MAC } from "@/lib/platform";

const MOD = IS_MAC ? "⌘" : "Strg";

export function AppCommandPalette() {
  const palette = useAppCommandPalette();
  const reduce = useReducedMotion();
  return (
    <>
      <Tooltip content={`Suchen (${MOD} K)`} side="bottom">
        <motion.button
          type="button"
          aria-label="Suchen"
          aria-keyshortcuts={IS_MAC ? "Meta+K" : "Control+K"}
          data-tauri-drag-region="false"
          onClick={() => palette.setOpen(true)}
          whileHover={reduce ? undefined : { y: -1 }}
          whileTap={reduce ? undefined : { scale: 0.98 }}
          transition={SPRING_PRESS}
          className="group relative mx-2 flex size-7 shrink-0 items-center justify-center gap-2 rounded-lg bg-sidebar-accent/60 text-sm text-muted-foreground ring-1 ring-transparent transition-colors after:absolute after:-inset-0.5 hover:bg-sidebar-accent hover:text-foreground hover:ring-border lg:mx-3 lg:w-full lg:max-w-sm lg:min-w-0 lg:shrink lg:justify-start lg:px-2.5 lg:after:hidden"
        >
          <SearchIcon className="size-3.5 shrink-0" />
          <span className="hidden flex-1 truncate text-left lg:block">Suchen…</span>
          <kbd className="hidden shrink-0 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] lg:inline-block">
            {MOD} K
          </kbd>
        </motion.button>
      </Tooltip>
      <CommandPalette
        items={palette.items}
        open={palette.open}
        onOpenChange={palette.setOpen}
        onQueryChange={palette.setQuery}
        loading={palette.loading}
        emptyMessage={palette.emptyMessage}
        placeholder="Vorgänge, Bereiche, Filter oder Befehle suchen…"
      />
    </>
  );
}
