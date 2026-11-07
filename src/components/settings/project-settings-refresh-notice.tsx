import { TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RetryButton } from "@/components/ui/retry-button";

type Props = { message: string; retrying: boolean; onRetry: () => void };

export function ProjectSettingsRefreshNotice({ message, retrying, onRetry }: Props) {
  return (
    <Alert variant="warning" className="rounded-xl">
      <TriangleAlertIcon />
      <AlertTitle>Aktualisierung fehlgeschlagen. Angezeigt wird der zuletzt geladene Stand.</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
      <div className="col-start-2 mt-2 flex flex-wrap gap-2">
        <RetryButton retrying={retrying} onRetry={onRetry}>Erneut versuchen</RetryButton>
      </div>
    </Alert>
  );
}
