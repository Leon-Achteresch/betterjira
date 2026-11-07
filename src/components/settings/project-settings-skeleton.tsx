import { Skeleton } from "@/components/ui/skeleton";

export function ProjectSettingsSkeleton() {
  return (
    <div className="flex w-full max-w-xl flex-col gap-2" aria-busy="true" aria-label="Bereiche werden geladen" role="status">
      {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-[50px] w-full rounded-xl" />)}
    </div>
  );
}
