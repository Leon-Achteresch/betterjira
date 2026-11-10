import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarIcon, CheckCircle2Icon, MonitorIcon, PlugIcon, UnplugIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import type { OutlookAccount } from "@/lib/calendar/model";
import { errorMessage } from "@/lib/calendar/presentation";
import { EASE_OUT } from "@/lib/ease";

type OutlookDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: OutlookAccount | null;
  connecting: boolean;
  connectError: Error | null;
  disconnecting: boolean;
  disconnectError: Error | null;
  onConnect: () => void;
  onDisconnect: () => void;
};

const REQUIREMENTS = [
  { icon: MonitorIcon, text: "Klassisches Outlook unter Windows (nicht das neue Outlook, macOS oder Linux)" },
  { icon: CalendarIcon, text: "Klassisches Outlook ist geöffnet und dein Kalender dort erreichbar" },
  { icon: CheckCircle2Icon, text: "Keine App-ID oder zusätzliche betterjira-Anmeldung nötig" },
];

export function OutlookDialog({ open, onOpenChange, account, connecting, connectError, disconnecting, disconnectError, onConnect, onDisconnect }: OutlookDialogProps) {
  const reduce = useReducedMotion();
  const error = account ? disconnectError : connectError;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Outlook-Kalender</DialogTitle>
          <DialogDescription>
            Rollouts lassen sich mit Erinnerung in den Standardkalender deines klassischen Outlook-Profils eintragen. Deine Outlook-Termine erscheinen dann hier im Kalender.
          </DialogDescription>
        </DialogHeader>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={account ? "connected" : "disconnected"}
            initial={{ opacity: 0, y: reduce ? 0 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="flex flex-col gap-3"
          >
            {account ? (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400">
                  <CalendarIcon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{account.displayName}</p>
                  {account.email && <p className="truncate text-xs text-muted-foreground">{account.email}</p>}
                </div>
                <span className="ml-auto text-xs font-medium text-emerald-600 dark:text-emerald-400">Verbunden</span>
              </div>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {REQUIREMENTS.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-2">
                    <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    {text}
                  </li>
                ))}
              </ul>
            )}
            {!account && (
              <p className="text-xs text-muted-foreground">
                Öffne klassisches Outlook zuerst selbst und prüfe deinen Kalender. betterjira verwendet diese Sitzung und startet Outlook nicht automatisch. Bei einem Microsoft-Anmeldefehler müssen Konto und Organisation direkt in Outlook korrigiert werden.
              </p>
            )}
            {account && (
              <p className="text-xs text-muted-foreground">
                Der lokale Kalenderzugriff ist verbunden. Die Anmeldung und Synchronisierung mit Microsoft übernimmt Outlook selbst.
              </p>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertTitle>{account ? "Trennen fehlgeschlagen" : "Verbindung nicht möglich"}</AlertTitle>
                <AlertDescription>{errorMessage(error, "Outlook ist nicht erreichbar.")}</AlertDescription>
              </Alert>
            )}
          </motion.div>
        </AnimatePresence>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Schließen
          </Button>
          {account ? (
            <Button variant="destructive" disabled={disconnecting} onClick={onDisconnect}>
              {disconnecting ? <Spinner /> : <UnplugIcon />}
              Trennen
            </Button>
          ) : (
            <Button disabled={connecting} onClick={onConnect}>
              {connecting ? <Spinner /> : <PlugIcon />}
              {connecting ? "Prüfe Outlook…" : "Outlook verbinden"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
