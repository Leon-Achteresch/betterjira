import { RotateCwIcon, ShieldAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";

export function SessionError({ message, retrying, onRetry }: { message: string; retrying: boolean; onRetry: () => void }) {
  return (
    <Empty role="alert">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <ShieldAlertIcon />
        </EmptyMedia>
        <EmptyTitle>Anmeldung konnte nicht geprüft werden</EmptyTitle>
        <EmptyDescription>{message}. Das ist keine Abmeldung, versuche es erneut.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" onClick={onRetry} disabled={retrying}>
          {retrying ? <Spinner /> : <RotateCwIcon />}
          Erneut versuchen
        </Button>
      </EmptyContent>
    </Empty>
  );
}
