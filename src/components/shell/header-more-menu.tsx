import { ArchiveRestoreIcon, ArchiveXIcon, ChevronLeft, ChevronRight, EllipsisIcon, SearchIcon, SquarePenIcon, PinIcon, PinOffIcon, XIcon } from "lucide-react";
import { Tooltip } from "@/components/motion/tooltip";
import type { IssueTab } from "@/components/shell/issue-tabs";
import type { LegacyTabsOfferData } from "@/components/shell/legacy-tabs-offer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useHeaderMoreMenu } from "@/hooks/use-header-more-menu";
import { shortcutHint } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";

type HeaderMoreMenuProps = {
  canGoBack: boolean;
  onBack: () => void;
  onForward: () => void;
  tabs: IssueTab[];
  activeKey?: string;
  onOpenTab: (key: string) => void;
  onCloseTab: (key: string) => void;
  onTogglePin: (key: string) => void;
  onCreateIssue: () => void;
  legacy?: Pick<LegacyTabsOfferData, "label" | "onAdopt" | "onDiscard">;
  onSearchTabs: () => void;
  className?: string;
};

const scrollIntoView = (node: HTMLElement | null) => node?.scrollIntoView({ block: "nearest" });

export function HeaderMoreMenu({
  canGoBack,
  onBack,
  onForward,
  tabs,
  activeKey,
  onOpenTab,
  onCloseTab,
  onTogglePin,
  onCreateIssue,
  legacy,
  onSearchTabs,
  className,
}: HeaderMoreMenuProps) {
  const { theme, activeTab } = useHeaderMoreMenu(tabs, activeKey);
  return (
    <DropdownMenu>
      <Tooltip content="Weitere Aktionen" side="bottom">
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Weitere Aktionen"
            data-tauri-drag-region="false"
            className={cn("relative after:absolute after:-inset-0.5", className)}
          >
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent
        align="end"
        collisionPadding={8}
        className="w-64 motion-reduce:animate-none!"
      >
        <DropdownMenuItem onSelect={onCreateIssue}>
          <SquarePenIcon />
          Ticket erstellen
          <DropdownMenuShortcut>{shortcutHint("createIssue")}</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!canGoBack} onSelect={onBack}>
          <ChevronLeft />
          Zurück
          <DropdownMenuShortcut>{shortcutHint("back")}</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onForward}>
          <ChevronRight />
          Vorwärts
          <DropdownMenuShortcut>{shortcutHint("forward")}</DropdownMenuShortcut>
        </DropdownMenuItem>
        {tabs.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup aria-labelledby="header-open-tabs">
              <DropdownMenuLabel id="header-open-tabs" className="flex items-center">
                Geöffnete Tickets
                <span className="ml-auto tabular-nums">{tabs.length}</span>
              </DropdownMenuLabel>
              <DropdownMenuItem onSelect={onSearchTabs}>
                <SearchIcon />
                Geöffnete Tickets durchsuchen
              </DropdownMenuItem>
              <DropdownMenuRadioGroup
                value={activeKey ?? ""}
                onValueChange={onOpenTab}
                className="max-h-44 overflow-y-auto overscroll-contain"
              >
                {tabs.map((tab) => (
                  <DropdownMenuRadioItem
                    key={tab.key}
                    value={tab.key}
                    ref={tab.key === activeKey ? scrollIntoView : undefined}
                    title={tab.title ? `${tab.key} · ${tab.title}` : tab.key}
                    className="min-h-8"
                  >
                    {tab.pinned ? <PinIcon className="size-3.5 text-muted-foreground" /> : null}
                    <span className="shrink-0 font-medium">{tab.key}</span>{" "}
                    {tab.title ? <span className="truncate text-muted-foreground">{tab.title}</span> : null}
                    {tab.pinned ? <span className="sr-only">(angeheftet)</span> : null}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </>
        ) : null}
        {activeTab ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onTogglePin(activeTab.key)}>
              {activeTab.pinned ? <PinOffIcon /> : <PinIcon />}
              {activeTab.pinned ? `${activeTab.key} lösen` : `${activeTab.key} anheften`}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={activeTab.pinned} onSelect={() => onCloseTab(activeTab.key)}>
              <XIcon />
              {activeTab.pinned ? "Angeheftet, zum Schließen lösen" : `${activeTab.key} schließen`}
              {activeTab.pinned ? null : <DropdownMenuShortcut>{shortcutHint("closeTab")}</DropdownMenuShortcut>}
            </DropdownMenuItem>
          </>
        ) : null}
        {legacy ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup aria-label="Frühere Tabs ohne Konto">
              <DropdownMenuLabel>{legacy.label} ohne Konto</DropdownMenuLabel>
              <DropdownMenuItem className="min-h-8" onSelect={legacy.onAdopt}>
                <ArchiveRestoreIcon />
                {legacy.label} übernehmen
              </DropdownMenuItem>
              <DropdownMenuItem className="min-h-8" onSelect={legacy.onDiscard}>
                <ArchiveXIcon />
                {legacy.label} verwerfen
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={theme.cycle}>
          <theme.NextIcon />
          {theme.label}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
