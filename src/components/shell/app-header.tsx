import { Link, useCanGoBack, useRouter } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { Tooltip } from "@/components/motion/tooltip";
import { AppCommandPalette } from "@/components/shell/app-command-palette";
import { IssueTabs } from "@/components/shell/issue-tabs";
import { NotificationBell } from "@/components/shell/notification-bell";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { WorkQueue } from "@/components/shell/work-queue";
import { WindowControls } from "@/components/shell/window-controls";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useIssueTabs } from "@/hooks/use-issue-tabs";
import { useTabHotkeys } from "@/hooks/use-tab-hotkeys";
import { IS_MAC, USE_CUSTOM_WINDOW_CONTROLS } from "@/lib/platform";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const { tabs, activeKey, openTab, closeTab, togglePin, closeOthers, closeRight } = useIssueTabs();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  useTabHotkeys({ keys: tabs.map((tab) => tab.key), activeKey, openTab, closeTab });

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
      <Tooltip content={`Zurück (${IS_MAC ? "⌘[" : "Alt+←"})`} side="bottom">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Zurück"
          disabled={!canGoBack}
          onClick={() => router.history.back()}
        >
          <ChevronLeft />
        </Button>
      </Tooltip>
      <Tooltip content={`Vorwärts (${IS_MAC ? "⌘]" : "Alt+→"})`} side="bottom">
        <Button variant="ghost" size="icon-sm" aria-label="Vorwärts" onClick={() => router.history.forward()}>
          <ChevronRight />
        </Button>
      </Tooltip>
      <Link
        to="/"
        className="ml-1 inline-flex h-7 shrink-0 items-center gap-1.5 px-1 text-sm font-semibold tracking-tight"
      >
        <img src="/logo.svg" alt="" className="size-5" />
        betterjira
      </Link>
      <div data-tauri-drag-region="deep" className="flex h-full min-w-0 flex-1">
        <IssueTabs
          tabs={tabs}
          activeKey={activeKey}
          onClose={closeTab}
          onTogglePin={togglePin}
          onCloseOthers={closeOthers}
          onCloseRight={closeRight}
        />
      </div>
      <div className="flex w-72 shrink-0">
        <AppCommandPalette />
      </div>
      <nav className="ml-auto flex items-center gap-1 px-3" aria-label="Hauptnavigation">
        <WorkQueue />
        <NotificationBell />
        <ThemeToggle />
        <Tooltip content="Einstellungen" side="bottom">
          <Link
            to="/settings"
            aria-label="Einstellungen"
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
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
