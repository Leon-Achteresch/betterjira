import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const palette: Record<string, string> = {
  yellow: "bg-info/12 text-info",
  green: "bg-success/12 text-success",
};

export function JiraStatusBadge({
  status,
  className,
}: {
  status: { name: string; statusCategory: { colorName: string } };
  className?: string;
}) {
  return (
    <Badge
      className={cn(
        "uppercase tracking-wide",
        palette[status.statusCategory.colorName] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {status.name}
    </Badge>
  );
}
