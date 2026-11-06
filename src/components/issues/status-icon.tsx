import { cn } from "@/lib/utils";

const TONES: Record<string, string> = {
  yellow: "text-info",
  green: "text-success",
};

export function StatusIcon({ color, label, className }: { color: string; label?: string; className?: string }) {
  const tone = TONES[color] ?? "text-muted-foreground";
  return (
    <svg
      viewBox="0 0 14 14"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("size-3.5 shrink-0", tone, className)}
    >
      {color === "green" ? (
        <>
          <circle cx="7" cy="7" r="6.5" fill="currentColor" />
          <path d="M4.2 7.2 6.1 9l3.7-3.9" fill="none" stroke="var(--background)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <circle cx="7" cy="7" r="5.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
          {color === "yellow" && <path d="M7 3.5a3.5 3.5 0 0 1 0 7z" fill="currentColor" />}
        </>
      )}
    </svg>
  );
}
