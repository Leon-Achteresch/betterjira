import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type Props = Omit<ComponentProps<typeof Button>, "onClick" | "disabled"> & {
  retrying: boolean;
  onRetry: () => void;
};

export function RetryButton({ retrying, onRetry, children, className, ...props }: Props) {
  return (
    <Button variant="outline" {...props} className={cn("min-h-8", className)} onClick={onRetry} disabled={retrying}>
      {retrying && <Spinner aria-hidden />}
      {children}
    </Button>
  );
}
