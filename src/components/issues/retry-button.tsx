import { RotateCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function RetryButton({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  return (
    <Button variant="outline" size="lg" className="rounded-xl" onClick={onRetry} disabled={retrying} aria-busy={retrying}>
      {retrying ? <Spinner aria-hidden /> : <RotateCwIcon aria-hidden />}
      Erneut versuchen
    </Button>
  );
}
