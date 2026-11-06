import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { Rollout } from "@/lib/calendar/model";
import { errorMessage } from "@/lib/calendar/presentation";

type DeleteRolloutDialogProps = {
  rollout: Rollout | null;
  pending: boolean;
  error: Error | null;
  onConfirm: () => void;
  onClose: () => void;
};

export function DeleteRolloutDialog({ rollout, pending, error, onConfirm, onClose }: DeleteRolloutDialogProps) {
  return (
    <AlertDialog open={!!rollout} onOpenChange={(open) => !open && !pending && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Rollout löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            „{rollout?.title}“ wird endgültig entfernt.
            {rollout?.outlookEventId && " Der verknüpfte Outlook-Termin wird ebenfalls gelöscht. Dafür muss der ursprüngliche Outlook-Kalender verbunden sein."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMessage(error, "Löschen fehlgeschlagen.")} Der Rollout wurde nicht gelöscht.
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Abbrechen</AlertDialogCancel>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending && <Spinner />}
            Löschen
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
