import { Link } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { Tooltip } from "@/components/motion/tooltip";
import { AppCommandPalette } from "@/components/shell/app-command-palette";
import { NotificationBell } from "@/components/shell/notification-bell";
import { WindowControls } from "@/components/shell/window-controls";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { IS_MAC, USE_CUSTOM_WINDOW_CONTROLS } from "@/lib/platform";
import { cn } from "@/lib/utils";

export function AppHeader() {
  return (
    <header
      data-tauri-drag-region="deep"
      className={cn(
        "relative z-20 flex h-[var(--app-header-height)] shrink-0 select-none items-center",
        "bg-sidebar",
        IS_MAC && "pl-[72px]",
        USE_CUSTOM_WINDOW_CONTROLS && "pr-[140px]",
      )}
    >
      <SidebarTrigger className="ml-2" data-tauri-drag-region="false" />
      <Link
        to="/"
        className="ml-1 inline-flex h-7 shrink-0 items-center gap-1.5 px-1 text-sm font-semibold tracking-tight"
      >
        <img src="/logo.svg" alt="" className="size-5" />
        betterjira
      </Link>
      <div data-tauri-drag-region="deep" className="flex min-w-0 flex-1 justify-center">
        <AppCommandPalette />
      </div>
      <nav className="ml-auto flex items-center gap-1 px-3" aria-label="Hauptnavigation">
        <NotificationBell />
        <Tooltip content="Einstellungen" side="bottom">
          <Link
            to="/settings"
            aria-label="Einstellungen"
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            activeProps={{ className: "bg-primary/12 text-foreground" }}
          >
            <Settings className="size-4" strokeWidth={1.75} />
          </Link>
        </Tooltip>
      </nav>
      {USE_CUSTOM_WINDOW_CONTROLS ? <WindowControls /> : null}
    </header>
  );
}
