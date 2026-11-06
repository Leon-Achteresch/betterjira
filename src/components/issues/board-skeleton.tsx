import { Skeleton } from "@/components/ui/skeleton";

const COLUMNS = [3, 2, 4, 1];

export function BoardSkeleton() {
  return (
    <div aria-busy aria-label="Board wird geladen" className="flex gap-3 overflow-hidden pb-2">
      {COLUMNS.map((cards, column) => (
        <div key={column} className="flex w-72 shrink-0 flex-col gap-2 rounded-lg bg-muted/50 p-2">
          <Skeleton className="mx-1 my-1 h-3 w-24" />
          {Array.from({ length: cards }, (_, card) => (
            <div key={card} className="flex flex-col gap-2.5 rounded-xl bg-card p-3 shadow-xs ring-1 ring-foreground/5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <div className="flex items-center gap-2 pt-1">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="ml-auto size-5 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
