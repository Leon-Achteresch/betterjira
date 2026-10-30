import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CodeIcon, CopyPlusIcon, EllipsisIcon, FunnelIcon, PencilIcon, StarIcon, Trash2Icon } from "lucide-react";
import { NameDialog } from "@/components/issues/name-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { FilterEditorState } from "@/hooks/use-filter-editor";
import { EASE_OUT, SPRING_PRESS } from "@/lib/ease";
import { cn } from "@/lib/utils";

export function FilterHeader({ id, editor }: { id: string; editor: FilterEditorState }) {
  const [renaming, setRenaming] = useState(false);
  const [copying, setCopying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { filter } = editor;
  const name = filter?.name ?? `Filter ${id}`;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex size-10 items-center justify-center rounded-md bg-muted">
        <FunnelIcon className="size-5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold">{name}</h1>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          {filter?.owner?.displayName && <span>{editor.isOwner ? "Eigener Filter" : `von ${filter.owner.displayName}`}</span>}
          <AnimatePresence initial={false}>
            {editor.previewing && (
              <motion.span
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.1 } }}
                transition={{ duration: 0.16, ease: EASE_OUT }}
              >
                <Badge variant="secondary">Vorschau · nicht gespeichert</Badge>
              </motion.span>
            )}
          </AnimatePresence>
        </p>
      </div>
      <motion.button
        type="button"
        whileTap={{ scale: 0.9 }}
        transition={SPRING_PRESS}
        disabled={!filter || editor.togglingFavourite}
        onClick={editor.toggleFavourite}
        aria-pressed={editor.favourite}
        aria-label={editor.favourite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
        className="rounded-md p-1.5 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        <StarIcon
          className={cn(
            "size-5 transition-[color,fill] duration-200",
            editor.favourite ? "fill-amber-400 text-amber-400" : "fill-transparent text-muted-foreground",
          )}
        />
      </motion.button>
      <div className="ml-auto flex items-center gap-2">
        <Button variant={editor.editing ? "secondary" : "outline"} size="sm" aria-pressed={editor.editing} onClick={() => editor.setEditing(!editor.editing)}>
          <CodeIcon />
          JQL bearbeiten
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon-sm" aria-label="Filteraktionen" disabled={!filter}>
              <EllipsisIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            {editor.isOwner && (
              <DropdownMenuItem onSelect={() => setRenaming(true)}>
                <PencilIcon />
                Umbenennen…
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onSelect={() => {
                editor.resetCreate();
                setCopying(true);
              }}
            >
              <CopyPlusIcon />
              Als neuen Filter speichern…
            </DropdownMenuItem>
            {editor.isOwner && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                  <Trash2Icon />
                  Löschen…
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <NameDialog
        open={renaming}
        onOpenChange={setRenaming}
        title="Filter umbenennen"
        initial={name}
        pending={editor.saving}
        onSubmit={(next) => {
          editor.rename(next);
          setRenaming(false);
        }}
      />
      <NameDialog
        open={copying}
        onOpenChange={setCopying}
        title="Als neuen Filter speichern"
        description="Speichert die aktuelle JQL als neuen Filter in deinem Konto."
        initial={`${name} (Kopie)`}
        submitLabel="Anlegen"
        pending={editor.creating}
        error={editor.createError}
        onSubmit={editor.saveAs}
      />
      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Filter „{name}“ löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Filter wird in Jira gelöscht. Boards und Dashboards, die ihn nutzen, funktionieren danach nicht mehr.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={editor.removing} onClick={editor.remove}>
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
