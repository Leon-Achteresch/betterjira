import { Link, useRouterState } from "@tanstack/react-router";
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
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { useAppHeader } from "@/hooks/use-app-header";
import { useTheme } from "@/hooks/use-theme";
import { Kbd } from "@/components/ui/kbd";
import { IS_MAC, USE_CUSTOM_WINDOW_CONTROLS } from "@/lib/platform";
import { shortcutHint } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";

const SECTIONS: Record<string, string> = {
  "": "Heute",
  benachrichtigungen: "Benachrichtigungen",
  arbeitsplatz: "Arbeitsplatz",
  tickets: "Jira-Tickets",
  issue: "Jira-Tickets",
  helpdesk: "Zammad-Tickets",
  "pull-requests": "Pull Requests",
  kalender: "Kalender",
  zeiterfassung: "Zeiterfassung",
  bereiche: "Bereiche",
  filter: "Filter",
  suche: "Suchen",
  neu: "Neues Ticket",
  settings: "Einstellungen",
};

export function AppHeader() {
  const { tabs, activeKey, openTab, closeTab, togglePin, closeOthers, closeRight, legacyTabs, tabSearch, canGoBack, back, forward, createIssue } = useAppHeader();
  const { theme } = useTheme();
  const studio = theme === "studio";
  const { isMobile, open, openMobile } = useSidebar();
  const sidebarLabel = studio && !isMobile ? "Bereiche und Filter" : "Navigation";
  const section = useRouterState({ select: (state) => state.location.pathname.split("/")[1] ?? "" });
  const activeLabel = tabs.find((tab) => tab.key === activeKey)?.label ?? (section === "issue" ? activeKey : undefined);
  const tabBar = (
    <>
      <IssueTabs
        className={studio ? "flex-1" : "max-sm:hidden"}
        tabs={tabs}
        activeKey={activeKey}
        onClose={closeTab}
        onTogglePin={togglePin}
        onCloseOthers={closeOthers}
        onCloseRight={closeRight}
      />
      <LegacyTabsOffer offer={legacyTabs} className={studio ? undefined : "max-sm:hidden"} />
    </>
  );

  const toolbar = (
    <header
      data-slot="app-header"
      data-tauri-drag-region="deep"
      className={cn(
        "relative z-20 flex h-[var(--app-header-height)] shrink-0 select-none items-center",
        IS_MAC && "pl-[72px]",
        USE_CUSTOM_WINDOW_CONTROLS && "pr-[110px] sm:pr-[140px]",
      )}
    >
      <Tooltip content={<span className="flex items-center gap-2">{studio ? sidebarLabel : "Seitenleiste"} <Kbd>{IS_MAC ? "⌘ B" : "Strg B"}</Kbd></span>} side="bottom">
        <SidebarTrigger className="ml-2 size-8" data-tauri-drag-region="false" aria-label={studio ? sidebarLabel : undefined} aria-expanded={studio ? (isMobile ? openMobile : open) : undefined} />
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
      {studio ? (
        <div data-slot="studio-location" data-tauri-drag-region="deep" className="ml-2 flex min-w-0 items-center gap-1.5 border-l pl-3 text-xs font-medium max-sm:hidden">
          <span className="truncate">{Object.hasOwn(SECTIONS, section) ? SECTIONS[section] : "BetterJira"}</span>
          {activeLabel && (
            <>
              <ChevronRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate font-mono text-muted-foreground">{activeLabel}</span>
            </>
          )}
        </div>
      ) : (
        <Link
          to="/"
          className="ml-1 inline-flex h-7 shrink-0 items-center gap-1.5 px-1 text-sm font-semibold tracking-tight"
        >
          <img src="/logo.svg" alt="" className="size-5" />
          <span className="sr-only sm:not-sr-only">betterjira</span>
        </Link>
      )}
      <div data-tauri-drag-region="deep" className="flex h-full min-w-0 flex-1 overflow-hidden">
        {!studio && tabBar}
      </div>
      <div data-slot="header-command" className="flex shrink-0 lg:w-56">
        <AppCommandPalette />
      </div>
      <nav className="ml-auto flex shrink-0 items-center gap-0.5 px-1.5 sm:gap-1 sm:px-3" aria-label="Werkzeuge">
        <Tooltip content={`Ticket erstellen (${shortcutHint("createIssue")})`} side="bottom">
          <Link
            to="/neu"
            data-slot="create-ticket"
            aria-label="Ticket erstellen"
            aria-keyshortcuts="C"
            className={cn("relative hidden h-8 w-8 shrink-0 items-center justify-center gap-1.5 rounded-xl xl:w-auto xl:px-2.5 text-muted-foreground outline-none transition-colors after:absolute after:-inset-0.5 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex", studio && "md:hidden")}
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
            data-slot="header-settings"
            aria-label="Einstellungen"
            className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-xl text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring", studio && "md:hidden")}
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

  return (
    <>
      {toolbar}
      {studio && (tabs.length > 0 || legacyTabs) && (
        <div data-slot="studio-tab-strip" className="flex min-w-0 shrink-0 items-stretch">
          {tabBar}
        </div>
      )}
    </>
  );
}
