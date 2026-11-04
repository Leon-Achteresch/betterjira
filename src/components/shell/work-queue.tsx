import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BookOpenIcon, FilePenLineIcon, HistoryIcon, PinIcon, SearchIcon, StickyNoteIcon } from "lucide-react";
import { JiraStatusBadge } from "@/components/jira-status-badge";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useWorkQueue, type WorkQueueState } from "@/hooks/use-work-queue";
import { EASE_OUT, SPRING_LAYOUT, SPRING_PRESS } from "@/lib/ease";
import { WORK_QUEUE_FILTERS, type WorkQueueItem } from "@/lib/workspace";
import { cn } from "@/lib/utils";

const MotionButton = motion.create(Button);

function WorkQueueRow({
  item,
  current,
  onOpen,
  onPin,
}: {
  item: WorkQueueItem;
  current: boolean;
  onOpen: () => void;
  onPin: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      layout={reduce ? false : "position"}
      transition={SPRING_LAYOUT}
      className={cn(
        "group flex gap-2 rounded-xl px-3 py-3 transition-colors hover:bg-muted/70",
        current && "bg-muted/50",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{item.key}</span>
          {current && <span className="text-primary">Geöffnet</span>}
          {item.status && (
            <span className="ml-auto" title="Status beim letzten Öffnen">
              <JiraStatusBadge status={item.status} className="text-[0.6rem]" />
            </span>
          )}
        </span>
        <span className="block text-sm font-medium leading-snug">{item.summary}</span>
        {item.note && <span className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{item.note}</span>}
        {(item.hasDraft || item.hasFieldDraft || item.note || item.hasReadingPosition) && (
          <span className="mt-2 flex flex-wrap items-center gap-3 text-[0.7rem] text-muted-foreground">
            {item.hasDraft && (
              <span className="inline-flex items-center gap-1 text-primary">
                <FilePenLineIcon className="size-3" />
                Kommentarentwurf
              </span>
            )}
            {item.hasFieldDraft && (
              <span className="inline-flex items-center gap-1 text-primary">
                <FilePenLineIcon className="size-3" />
                Feldentwurf
              </span>
            )}
            {item.note && (
              <span className="inline-flex items-center gap-1">
                <StickyNoteIcon className="size-3" />
                Private Notiz
              </span>
            )}
            {item.hasReadingPosition && (
              <span className="inline-flex items-center gap-1">
                <BookOpenIcon className="size-3" />
                Lesestelle gemerkt
              </span>
            )}
          </span>
        )}
      </button>
      <Tooltip content={item.pinned ? "Nicht mehr anheften" : "Anheften"}>
        <MotionButton
          variant="ghost"
          size="icon-sm"
          aria-label={`${item.key} ${item.pinned ? "lösen" : "anheften"}`}
          aria-pressed={item.pinned}
          onClick={onPin}
          whileTap={reduce ? undefined : { scale: 0.96 }}
          transition={SPRING_PRESS}
          className={cn(
            "self-start text-muted-foreground sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100",
            item.pinned && "text-primary sm:opacity-100",
          )}
        >
          <PinIcon />
        </MotionButton>
      </Tooltip>
    </motion.div>
  );
}

function WorkQueueContent({ queue }: { queue: WorkQueueState }) {
  const reduce = useReducedMotion();
  return (
    <>
      <SheetHeader className="px-6 pt-6 pb-4">
        <SheetTitle className="flex items-center gap-2 text-xl tracking-tight">
          <HistoryIcon className="size-5 text-primary" />
          Weiterarbeiten
        </SheetTitle>
        <SheetDescription>Ticket wechseln. Später an derselben Stelle weiterlesen.</SheetDescription>
      </SheetHeader>
      <div className="flex flex-col gap-3 px-6 pb-4">
        <InputGroup>
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Arbeitskontexte durchsuchen"
            placeholder="Ticket oder Notiz suchen …"
            value={queue.query}
            onChange={(event) => queue.setQuery(event.target.value)}
          />
        </InputGroup>
        <div className="flex gap-1 rounded-lg bg-muted/60 p-1" role="group" aria-label="Arbeitskontexte filtern">
          {WORK_QUEUE_FILTERS.map((filter) => (
            <motion.button
              key={filter.id}
              type="button"
              onClick={() => queue.setFilter(filter.id)}
              aria-pressed={queue.filter === filter.id}
              whileTap={reduce ? undefined : { scale: 0.98 }}
              transition={SPRING_PRESS}
              className="relative flex-1 rounded-md px-2 py-1.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {queue.filter === filter.id && (
                <motion.span
                  layoutId={reduce ? undefined : "work-queue-filter"}
                  transition={SPRING_LAYOUT}
                  className="absolute inset-0 rounded-md bg-background shadow-xs"
                />
              )}
              <span className={cn("relative", queue.filter !== filter.id && "text-muted-foreground")}>
                {filter.label}
                {filter.id === "drafts" && queue.draftCount > 0 ? ` · ${queue.draftCount}` : ""}
              </span>
            </motion.button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {queue.items.length === 0 ? (
          <motion.div
            key={queue.filter}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="flex flex-col items-center gap-2 px-6 py-14 text-center"
          >
            <BookOpenIcon className="mb-1 size-6 text-muted-foreground" />
            <p className="text-sm font-medium">{queue.emptyTitle}</p>
            <p className="max-w-64 text-sm text-muted-foreground">{queue.emptyDescription}</p>
          </motion.div>
        ) : (
          <Stagger role="list" aria-label="Arbeitskontexte" className="flex flex-col gap-1">
            <AnimatePresence initial={false}>
              {queue.items.map((item, index) =>
                index < 6 ? (
                  <StaggerItem key={item.key} role="listitem">
                    <WorkQueueRow
                      item={item}
                      current={item.key === queue.currentKey}
                      onOpen={() => queue.openIssue(item.key)}
                      onPin={() => queue.togglePin(item.key)}
                    />
                  </StaggerItem>
                ) : (
                  <div key={item.key} role="listitem">
                    <WorkQueueRow
                      item={item}
                      current={item.key === queue.currentKey}
                      onOpen={() => queue.openIssue(item.key)}
                      onPin={() => queue.togglePin(item.key)}
                    />
                  </div>
                ),
              )}
            </AnimatePresence>
          </Stagger>
        )}
      </div>
      <div className="flex items-center justify-between border-t px-6 py-3 text-xs text-muted-foreground">
        <span>{queue.count} Tickets auf diesem Gerät</span>
      </div>
    </>
  );
}

export function WorkQueue() {
  const queue = useWorkQueue();
  return (
    <Sheet open={queue.open} onOpenChange={queue.setOpen}>
      <Tooltip content="Weiterarbeiten · Tickets, Entwürfe und Lesestellen" side="bottom">
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Weiterarbeiten"
            disabled={!queue.ready}
            data-tauri-drag-region="false"
            className="gap-1.5 text-muted-foreground"
          >
            <HistoryIcon />
            <span className="hidden lg:inline">Weiterarbeiten</span>
          </Button>
        </SheetTrigger>
      </Tooltip>
      <SheetContent className="w-full gap-0 data-[side=right]:sm:max-w-md">
        <WorkQueueContent queue={queue} />
      </SheetContent>
    </Sheet>
  );
}
