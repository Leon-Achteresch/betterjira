import {
  ChevronLeft,
  ChevronRight,
  EllipsisIcon,
  PinIcon,
  PinOffIcon,
  XIcon,
} from "lucide-react";
import { Tooltip } from "@/components/motion/tooltip";
import type { IssueTab } from "@/components/shell/issue-tabs";
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
import { useThemeCycle } from "@/hooks/use-theme";
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
  className?: string;
};

const scrollIntoView = (node: HTMLElement | null) =>
  node?.scrollIntoView({ block: "nearest" });

export function HeaderMoreMenu({
  canGoBack,
  onBack,
  onForward,
  tabs,
  activeKey,
  onOpenTab,
  onCloseTab,
  onTogglePin,
  className,
}: HeaderMoreMenuProps) {
  const theme = useThemeCycle();
  const activeTab = tabs.find((tab) => tab.key === activeKey);
  return (
    <DropdownMenu>
      <Tooltip content="Weitere Aktionen" side="bottom">
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Weitere Aktionen"
            data-tauri-drag-region="false"
            className={cn(
              "relative after:absolute after:-inset-0.5",
              className,
            )}
          >
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent
        align="end"
        collisionPadding={8}
        className="w-64 motion-reduce:data-open:animate-none motion-reduce:data-closed:animate-none"
      >
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
              <DropdownMenuLabel
                id="header-open-tabs"
                className="flex items-center"
              >
                Geöffnete Tickets
                <span className="ml-auto tabular-nums">{tabs.length}</span>
              </DropdownMenuLabel>
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
                    title={
                      tab.title
                        ? `${tab.label ?? tab.key} · ${tab.title}`
                        : (tab.label ?? tab.key)
                    }
                    className="min-h-8"
                  >
                    {tab.pinned ? (
                      <PinIcon className="size-3.5 text-muted-foreground" />
                    ) : null}
                    <span className="shrink-0 font-medium">
                      {tab.label ?? tab.key}
                    </span>{" "}
                    {tab.title ? (
                      <span className="truncate text-muted-foreground">
                        {tab.title}
                      </span>
                    ) : null}
                    {tab.pinned ? (
                      <span className="sr-only">(angeheftet)</span>
                    ) : null}
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
              {activeTab.pinned
                ? `${activeTab.label ?? activeTab.key} lösen`
                : `${activeTab.label ?? activeTab.key} anheften`}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={activeTab.pinned}
              onSelect={() => onCloseTab(activeTab.key)}
            >
              <XIcon />
              {activeTab.pinned
                ? "Angeheftet, zum Schließen lösen"
                : `${activeTab.label ?? activeTab.key} schließen`}
              {activeTab.pinned ? null : (
                <DropdownMenuShortcut>
                  {shortcutHint("closeTab")}
                </DropdownMenuShortcut>
              )}
            </DropdownMenuItem>
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
