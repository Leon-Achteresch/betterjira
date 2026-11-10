import { LinkIcon } from "lucide-react";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";

export function CommentLinkAction({ available, onCopy }: { available: boolean; onCopy: () => void }) {
  return (
    <Tooltip content={available ? "Jira-Link zum Kommentar kopieren" : "Kein Jira-Link verfügbar: keine gültige Jira-Verbindung"}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Jira-Link zum Kommentar kopieren"
        data-available={available}
        onClick={onCopy}
        className="shrink-0 rounded-xl text-muted-foreground/70 hover:text-foreground focus-visible:text-foreground data-[available=false]:text-muted-foreground/40"
      >
        <LinkIcon />
      </Button>
    </Tooltip>
  );
}
