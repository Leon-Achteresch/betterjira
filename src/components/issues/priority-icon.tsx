import { priorityRank } from "@/lib/board-insights";
import { cn } from "@/lib/utils";

const BARS = [4, 7, 10];

export function PriorityIcon({ name, className }: { name?: string; className?: string }) {
  const rank = name ? priorityRank(name) : 5;
  if (rank === 0)
    return (
      <svg viewBox="0 0 14 14" role="img" aria-label={name} className={cn("size-3.5 shrink-0 text-destructive", className)}>
        <rect x="1" y="1" width="12" height="12" rx="3" fill="currentColor" />
        <path d="M7 3.8v4M7 10.2v.01" stroke="var(--background)" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  const filled = Math.max(0, 4 - rank);
  return (
    <svg viewBox="0 0 14 14" role="img" aria-label={name ?? "Ohne Priorität"} className={cn("size-3.5 shrink-0 text-muted-foreground", className)}>
      {BARS.map((height, index) => (
        <rect
          key={height}
          x={1.5 + index * 4}
          y={12 - height}
          width="3"
          height={height}
          rx="1"
          fill="currentColor"
          opacity={index < filled ? 1 : 0.3}
        />
      ))}
    </svg>
  );
}
