import { ZammadLogo } from "@/components/brands/service-logos";
import { Tooltip } from "@/components/motion/tooltip";
import { tabTarget } from "@/lib/issue-tabs";
import { Link } from "@tanstack/react-router";
import { openUrl } from "@tauri-apps/plugin-opener";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Ref } from "react";
import {
  ArrowRightToLineIcon,
  CopyIcon,
  ExternalLinkIcon,
  LinkIcon,
  PinIcon,
  PinOffIcon,
  XIcon,
  XSquareIcon,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { copyToClipboard } from "@/lib/clipboard";
import { EASE_OUT, SPRING_LAYOUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

export type IssueTab = {
  key: string;
  label?: string;
  title?: string;
  pinned: boolean;
  url?: string;
  source?: "jira" | "zammad";
};

type IssueTabActions = {
  onClose: (key: string) => void;
  onTogglePin: (key: string) => void;
  onCloseOthers: (key: string) => void;
  onCloseRight: (key: string) => void;
};

type IssueTabsProps = IssueTabActions & {
  tabs: IssueTab[];
  activeKey?: string;
  className?: string;
};

export function IssueTabs({
  tabs,
  activeKey,
  className,
  ...actions
}: IssueTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Geöffnete Tickets"
      data-tauri-drag-region="deep"
      className={cn(
        "flex h-full min-w-0 items-stretch gap-0.5 overflow-x-auto px-2 [scrollbar-width:none]",
        className,
      )}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {tabs.map((tab, index) => (
          <IssueTabItem
            key={tab.key}
            tab={tab}
            active={tab.key === activeKey}
            hasOthers={tabs.some(
              (other) => other.key !== tab.key && !other.pinned,
            )}
            hasRight={tabs.slice(index + 1).some((other) => !other.pinned)}
            {...actions}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

type IssueTabItemProps = IssueTabActions & {
  tab: IssueTab;
  active: boolean;
  hasOthers: boolean;
  hasRight: boolean;
  ref?: Ref<HTMLDivElement>;
};

function IssueTabItem({
  tab,
  active,
  hasOthers,
  hasRight,
  onClose,
  onTogglePin,
  onCloseOthers,
  onCloseRight,
  ref,
}: IssueTabItemProps) {
  const reduceMotion = useReducedMotion();

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <motion.div
          ref={ref}
          layout={!reduceMotion}
          initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
          animate={{
            opacity: 1,
            y: 0,
            transition: { duration: 0.2, ease: EASE_OUT },
          }}
          exit={{
            opacity: 0,
            scale: reduceMotion ? 1 : 0.96,
            transition: { duration: 0.12, ease: EASE_OUT },
          }}
          transition={SPRING_LAYOUT}
          onMouseDown={(event) => event.button === 1 && event.preventDefault()}
          onMouseUp={(event) =>
            event.button === 1 && !tab.pinned && onClose(tab.key)
          }
          className={cn(
            "group relative flex shrink-0 items-center rounded-t-lg text-xs transition-colors",
            tab.pinned ? "w-auto" : "w-44",
            active
              ? "text-foreground"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
        >
          {active ? (
            <motion.span
              layoutId="issue-tab-active"
              transition={reduceMotion ? { duration: 0 } : SPRING_LAYOUT}
              className="absolute inset-0 rounded-t-lg bg-background"
            />
          ) : null}
          <Link
            {...tabTarget(tab.key)}
            role="tab"
            aria-selected={active}
            title={
              tab.title
                ? `${tab.label ?? tab.key} · ${tab.title}`
                : (tab.label ?? tab.key)
            }
            className={cn(
              "relative flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-t-lg outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab.pinned ? "px-3" : "pl-3",
            )}
          >
            {tab.pinned ? (
              <PinIcon className="size-3 shrink-0" strokeWidth={2} />
            ) : null}
            {tab.source === "zammad" && (
              <ZammadLogo aria-hidden className="size-3.5 shrink-0" />
            )}
            <span className="shrink-0 font-medium tabular-nums">
              {tab.label ?? tab.key}
            </span>
            {tab.title && !tab.pinned ? (
              <span className="truncate">{tab.title}</span>
            ) : null}
          </Link>
          {tab.pinned ? null : (
            <Tooltip content="Tab schließen">
              <motion.button
                type="button"
                aria-label={`${tab.label ?? tab.key} schließen`}
                onClick={() => onClose(tab.key)}
                whileTap={reduceMotion ? undefined : { scale: 0.9 }}
                className={cn(
                  "relative mx-1 inline-flex size-8 shrink-0 items-center justify-center rounded text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100",
                  active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                )}
              >
                <XIcon className="size-3" strokeWidth={2} />
              </motion.button>
            </Tooltip>
          )}
        </motion.div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-auto min-w-52">
        <ContextMenuItem onSelect={() => onTogglePin(tab.key)}>
          {tab.pinned ? <PinOffIcon /> : <PinIcon />}
          {tab.pinned ? "Lösen" : "Anheften"}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() =>
            void copyToClipboard(
              tab.label ?? tab.key,
              `${tab.label ?? tab.key} kopiert`,
            )
          }
        >
          <CopyIcon />
          Schlüssel kopieren
        </ContextMenuItem>
        {tab.url ? (
          <>
            <ContextMenuItem
              onSelect={() =>
                tab.url && void copyToClipboard(tab.url, "Link kopiert")
              }
            >
              <LinkIcon />
              Link kopieren
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => tab.url && void openUrl(tab.url)}>
              <ExternalLinkIcon />
              In {tab.source === "zammad" ? "Zammad" : "Jira"} öffnen
            </ContextMenuItem>
          </>
        ) : null}
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => onClose(tab.key)}>
          <XIcon />
          Schließen
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!hasOthers}
          onSelect={() => onCloseOthers(tab.key)}
        >
          <XSquareIcon />
          Andere schließen
        </ContextMenuItem>
        <ContextMenuItem
          disabled={!hasRight}
          onSelect={() => onCloseRight(tab.key)}
        >
          <ArrowRightToLineIcon />
          Rechts davon schließen
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
