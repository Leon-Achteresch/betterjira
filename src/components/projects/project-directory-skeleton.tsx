import { Skeleton } from "@/components/ui/skeleton";

export function ProjectDirectorySkeleton() {
  return (
    <div className="flex flex-col gap-1" aria-busy aria-label="Bereiche werden geladen" role="status">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="flex min-h-12 items-center gap-3 px-3">
          <Skeleton className="size-6 rounded-md" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}
