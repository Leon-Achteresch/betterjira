import { useRef } from "react";
import { EllipsisIcon, LinkIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EASE_OUT_CSS } from "@/lib/ease";

export type CommentEditAction = { label: string; disabledReason?: string; onSelect: () => void };

export function CommentActionsMenu({ onCopyLink, edit, onDelete }: { onCopyLink: () => void; edit?: CommentEditAction; onDelete?: () => void }) {
  const editChosen = useRef(false);
  return (
    <DropdownMenu>
      <Tooltip content="Weitere Aktionen" side="bottom">
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Weitere Aktionen"
            style={{ transitionTimingFunction: EASE_OUT_CSS }}
            className="text-muted-foreground transition-opacity duration-150 sm:opacity-0 sm:group-hover/comment:opacity-100 sm:group-focus-within/comment:opacity-100 sm:data-[state=open]:opacity-100"
          >
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent
        align="end"
        className="min-w-48"
        onCloseAutoFocus={(event) => {
          if (editChosen.current) event.preventDefault();
          editChosen.current = false;
        }}
      >
        <DropdownMenuItem onSelect={onCopyLink}>
          <LinkIcon />
          Link kopieren
        </DropdownMenuItem>
        {edit && (
          <DropdownMenuItem
            disabled={!!edit.disabledReason}
            onSelect={() => {
              editChosen.current = true;
              edit.onSelect();
            }}
            className="items-start"
          >
            <PencilIcon className="mt-0.5" />
            <span className="flex flex-col gap-0.5">
              {edit.label}
              {edit.disabledReason && <span className="text-xs text-muted-foreground">{edit.disabledReason}</span>}
            </span>
          </DropdownMenuItem>
        )}
        {onDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2Icon />
              Löschen…
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
