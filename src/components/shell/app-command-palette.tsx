import { SearchIcon } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { CommandPalette } from "@/components/motion/command-palette";
import { Tooltip } from "@/components/motion/tooltip";
import { useAppCommandPalette } from "@/hooks/use-app-command-palette";
import { Kbd } from "@/components/ui/kbd";
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
          className="group relative mx-2 flex size-8 shrink-0 items-center justify-center gap-2 rounded-xl glass-control text-sm text-muted-foreground ring-1 ring-transparent transition-colors after:absolute after:-inset-0.5 hover:bg-sidebar-accent hover:text-foreground hover:ring-border lg:mx-3 lg:w-full lg:max-w-sm lg:min-w-0 lg:shrink lg:justify-start lg:px-2.5 lg:after:hidden"
        >
          <SearchIcon className="size-3.5 shrink-0" />
          <span className="hidden flex-1 truncate text-left lg:block">Suchen und Aktionen…</span>
          <Kbd className="hidden shrink-0 text-[10px] lg:inline-flex">
            {MOD} K
          </Kbd>
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
