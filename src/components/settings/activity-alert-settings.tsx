import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BellRingIcon, RotateCcwIcon } from "lucide-react";
import { StatusBadge } from "@/components/connections/status-badge";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { EASE_OUT, SPRING_LAYOUT } from "@/lib/ease";
import { SYSTEM_ALERT_LABELS, type SystemAlertStatus } from "@/lib/notifications/activity-alerts";

type ActivityAlertSettingsProps = {
  inApp: boolean;
  onInAppChange: (enabled: boolean) => void;
  watching: boolean;
  onWatchingChange: (enabled: boolean) => void;
  system: boolean;
  onSystemChange: (enabled: boolean) => void;
  systemStatus: SystemAlertStatus;
  checking: boolean;
  onRecheck: () => void;
  requesting: boolean;
  requestError: string | null;
  onRequestPermission: () => void;
};

const STATUS_HINTS: Record<Exclude<SystemAlertStatus, "off">, string> = {
  checking: "Berechtigung deines Systems wird gelesen.",
  "check-failed": "Der Berechtigungsstatus konnte nicht gelesen werden. Solange er unklar ist, erscheinen keine Systemhinweise.",
  granted: "Neue Jira-Aktivität erscheint als Hinweis deines Systems, solange betterjira im Hintergrund läuft.",
  denied: "Dein System blockiert Hinweise von betterjira. Erlaube sie in den Benachrichtigungseinstellungen deines Systems und prüfe danach erneut.",
  prompt: "Dein System hat Hinweise von betterjira noch nicht erlaubt. Bis dahin erscheinen keine Systemhinweise.",
};

export function ActivityAlertSettings(props: ActivityAlertSettingsProps) {
  const reduce = useReducedMotion();
  const status = props.systemStatus;

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-medium text-balance">Jira-Aktivität</h2>
        <p className="text-sm text-muted-foreground">
          Hinweise zu neuer Aktivität in deinen Tickets. Die Inbox unter „Benachrichtigungen“ und der Zähler an der Glocke bleiben
          immer aktuell. Gilt nur auf diesem Gerät.
        </p>
      </div>
      <FieldGroup>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="activity-alerts-in-app">Popups in der App</FieldLabel>
            <FieldDescription>Kurzer Hinweis unten rechts, während du in betterjira arbeitest.</FieldDescription>
          </FieldContent>
          <Switch id="activity-alerts-in-app" checked={props.inApp} onCheckedChange={props.onInAppChange} />
        </Field>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="activity-alerts-system">Systemhinweise</FieldLabel>
            <FieldDescription>Hinweis deines Betriebssystems, wenn betterjira im Hintergrund läuft.</FieldDescription>
          </FieldContent>
          <Switch id="activity-alerts-system" checked={props.system} onCheckedChange={props.onSystemChange} />
        </Field>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="activity-alerts-watching">Auch beobachtete Tickets</FieldLabel>
            <FieldDescription>
              Standardmäßig melden sich nur Tickets, die dir zugewiesen sind, die du erstellt hast oder in denen du erwähnt wirst. Pro
              Ticket höchstens ein Hinweis alle 5 Minuten.
            </FieldDescription>
          </FieldContent>
          <Switch id="activity-alerts-watching" checked={props.watching} onCheckedChange={props.onWatchingChange} />
        </Field>
      </FieldGroup>
      <AnimatePresence initial={false}>
        {status !== "off" && (
          <motion.section
            key="system-status"
            layout={!reduce}
            aria-label="Status der Systemhinweise"
            initial={{ opacity: 0, y: reduce ? 0 : -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
            transition={{ duration: 0.22, ease: EASE_OUT, layout: SPRING_LAYOUT }}
            className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2" role="status">
              <span className="text-sm font-medium">Berechtigung des Systems</span>
              <StatusBadge status={SYSTEM_ALERT_LABELS[status]} />
            </div>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={status}
                initial={{ opacity: 0, y: reduce ? 0 : 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.1, ease: EASE_OUT } }}
                transition={{ duration: 0.18, ease: EASE_OUT }}
                className="flex flex-col items-start gap-3"
              >
                <p className="text-sm text-muted-foreground">{STATUS_HINTS[status]}</p>
                {status === "prompt" && (
                  <>
                    {props.requestError && (
                      <p className="text-sm text-destructive" role="alert">
                        {props.requestError} Du kannst es erneut versuchen.
                      </p>
                    )}
                    <Button variant="outline" onClick={props.onRequestPermission} disabled={props.requesting}>
                      {props.requesting ? <Spinner aria-hidden="true" /> : <BellRingIcon />}
                      {props.requestError ? "Erneut anfragen" : "Systemhinweise erlauben"}
                    </Button>
                  </>
                )}
                {(status === "check-failed" || status === "denied") && (
                  <Button variant="outline" onClick={props.onRecheck} disabled={props.checking}>
                    {props.checking ? <Spinner aria-hidden="true" /> : <RotateCcwIcon />}
                    Erneut prüfen
                  </Button>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
