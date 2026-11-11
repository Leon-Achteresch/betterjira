import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Settings, SquarePenIcon } from "lucide-react";
import { Tooltip } from "@/components/motion/tooltip";
import { AppCommandPalette } from "@/components/shell/app-command-palette";
import { HeaderMoreMenu } from "@/components/shell/header-more-menu";
import { IssueTabs } from "@/components/shell/issue-tabs";
import { LegacyTabsOffer } from "@/components/shell/legacy-tabs-offer";
import { NotificationBell } from "@/components/shell/notification-bell";
import { OpenTabSearch } from "@/components/shell/open-tab-search";
import { WorkQueue } from "@/components/shell/work-queue";
import { WindowControls } from "@/components/shell/window-controls";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAppHeader } from "@/hooks/use-app-header";
import { Kbd } from "@/components/ui/kbd";
import { IS_MAC, USE_CUSTOM_WINDOW_CONTROLS } from "@/lib/platform";
import { shortcutHint } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";

export function AppHeader() {
  const { tabs, activeKey, openTab, closeTab, togglePin, closeOthers, closeRight, legacyTabs, tabSearch, canGoBack, back, forward, createIssue } = useAppHeader();

  return (
    <header
      data-tauri-drag-region="deep"
      className={cn(
        "relative z-20 flex h-[var(--app-header-height)] shrink-0 select-none items-center",
        "glass-chrome border-b border-sidebar-border/50",
        IS_MAC && "pl-[72px]",
        USE_CUSTOM_WINDOW_CONTROLS && "pr-[140px]",
      )}
    >
      <Tooltip content={<span className="flex items-center gap-2">Seitenleiste <Kbd>{IS_MAC ? "⌘ B" : "Strg B"}</Kbd></span>} side="bottom">
        <SidebarTrigger className="ml-2 size-8" data-tauri-drag-region="false" />
      </Tooltip>
      <Tooltip content={`Zurück (${IS_MAC ? "⌘[" : "Alt+←"})`} side="bottom">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Zurück"
          className="hidden sm:inline-flex"
          disabled={!canGoBack}
          onClick={() => back()}
        >
          <ChevronLeft />
        </Button>
      </Tooltip>
      <Tooltip content={`Vorwärts (${IS_MAC ? "⌘]" : "Alt+→"})`} side="bottom">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Vorwärts"
          className="hidden sm:inline-flex"
          onClick={() => forward()}
        >
          <ChevronRight />
        </Button>
      </Tooltip>
      <Link
        to="/"
        className="ml-1 inline-flex h-7 shrink-0 items-center gap-1.5 px-1 text-sm font-semibold tracking-tight"
      >
        <img src="/logo.svg" alt="" className="size-5" />
        <span className="sr-only sm:not-sr-only">betterjira</span>
      </Link>
      <div data-tauri-drag-region="deep" className="flex h-full min-w-0 flex-1 overflow-hidden">
        <IssueTabs
          className="max-sm:hidden"
          tabs={tabs}
          activeKey={activeKey}
          onClose={closeTab}
          onTogglePin={togglePin}
          onCloseOthers={closeOthers}
          onCloseRight={closeRight}
        />
        <LegacyTabsOffer offer={legacyTabs} className="max-sm:hidden" />
      </div>
      <div className="flex shrink-0 lg:w-56">
        <AppCommandPalette />
      </div>
      <nav className="ml-auto flex shrink-0 items-center gap-0.5 px-1.5 sm:gap-1 sm:px-3" aria-label="Werkzeuge">
        <Tooltip content={`Ticket erstellen (${shortcutHint("createIssue")})`} side="bottom">
          <Link
            to="/neu"
            aria-label="Ticket erstellen"
            aria-keyshortcuts="C"
            className="relative hidden h-8 w-8 shrink-0 items-center justify-center gap-1.5 rounded-xl xl:w-auto xl:px-2.5 text-muted-foreground outline-none transition-colors after:absolute after:-inset-0.5 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
            activeProps={{ className: "bg-primary/12 text-foreground" }}
          >
            <SquarePenIcon className="size-4" strokeWidth={1.75} />
            <span className="hidden text-xs font-medium xl:inline">Erstellen</span>
          </Link>
        </Tooltip>
        <WorkQueue />
        <NotificationBell />
        <Tooltip content="Einstellungen" side="bottom">
          <Link
            to="/settings"
            aria-label="Einstellungen"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            activeProps={{ className: "bg-primary/12 text-foreground" }}
          >
            <Settings className="size-4" strokeWidth={1.75} />
          </Link>
        </Tooltip>
        <HeaderMoreMenu
          canGoBack={canGoBack}
          onBack={() => back()}
          onForward={() => forward()}
          tabs={tabs}
          activeKey={activeKey}
          onOpenTab={openTab}
          onCloseTab={closeTab}
          onTogglePin={togglePin}
          onCreateIssue={createIssue}
          legacy={legacyTabs}
          onSearchTabs={() => tabSearch.onOpenChange(true)}
        />
      </nav>
      <OpenTabSearch {...tabSearch} activeKey={activeKey} />
      {USE_CUSTOM_WINDOW_CONTROLS ? <WindowControls /> : null}
    </header>
  );
}
