import { useRef } from "react";
import { EllipsisIcon, LinkIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EASE_OUT_CSS } from "@/lib/ease";

export type CommentMenuAction = { disabledReason?: string; onSelect: () => void };
export type CommentEditAction = CommentMenuAction & { label: string };

export function CommentActionsMenu({ link, edit, onDelete }: { link: CommentMenuAction; edit?: CommentEditAction; onDelete?: () => void }) {
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
            className="relative text-muted-foreground transition-opacity after:absolute after:-inset-1.5 after:content-['']  duration-150 sm:opacity-0 sm:group-hover/comment:opacity-100 sm:group-focus-within/comment:opacity-100 sm:data-[state=open]:opacity-100"
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
        <DropdownMenuItem disabled={!!link.disabledReason} onSelect={link.onSelect} className="items-start">
          <LinkIcon className="mt-0.5" />
          <span className="flex flex-col gap-0.5">
            Link kopieren
            {link.disabledReason && <span className="text-xs text-muted-foreground">{link.disabledReason}</span>}
          </span>
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
