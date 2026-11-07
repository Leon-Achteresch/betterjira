import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { RolloutFormTarget } from "@/types/calendar";
import { RolloutForm } from "./rollout-form";

type RolloutDialogProps = {
  target: RolloutFormTarget | null;
  onClose: () => void;
};

export function RolloutDialog({ target, onClose }: RolloutDialogProps) {
  const title = target && "rollout" in target ? "Rollout bearbeiten" : target && "template" in target ? "Rollout duplizieren" : "Rollout planen";
  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Zeiten gelten in deiner lokalen Zeitzone. Der Termin bleibt auch ohne Outlook lokal gespeichert.</DialogDescription>
        </DialogHeader>
        {target && <RolloutForm target={target} onDone={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
