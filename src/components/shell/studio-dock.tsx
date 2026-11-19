import { Link } from "@tanstack/react-router";
import { PlusIcon, SettingsIcon } from "lucide-react";
import { Tooltip } from "@/components/motion/tooltip";
import { PrimaryNav } from "@/components/shell/primary-nav";
import { Button } from "@/components/ui/button";
import { useOwnedUnreadCount } from "@/hooks/notifications/use-notification-store";
import { shortcutHint } from "@/lib/shortcuts";

export function StudioDock() {
  const notifications = useOwnedUnreadCount();

  return (
    <aside data-slot="studio-dock" aria-label="Arbeitsnavigation" className="relative z-[11] hidden min-h-0 w-(--studio-dock-width) shrink-0 flex-col items-center gap-2 overflow-y-auto border-r border-border bg-sidebar py-2 md:flex">
      <Tooltip content="BetterJira" side="right">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/" aria-label="BetterJira">
            <img src="/logo.svg" alt="" className="size-5" />
          </Link>
        </Button>
      </Tooltip>
      <Tooltip content={`Ticket erstellen (${shortcutHint("createIssue")})`} side="right">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/neu" data-slot="create-ticket" aria-label="Ticket erstellen" aria-keyshortcuts="C">
            <PlusIcon />
          </Link>
        </Button>
      </Tooltip>
      <PrimaryNav counts={{ notifications }} markIssueSection compact />
      <div className="mt-auto pt-1">
        <Tooltip content="Einstellungen" side="right">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/settings" aria-label="Einstellungen">
              <SettingsIcon />
            </Link>
          </Button>
        </Tooltip>
      </div>
    </aside>
  );
}
