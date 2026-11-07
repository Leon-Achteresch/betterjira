import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowDownToLineIcon, CheckCircle2Icon, CircleAlertIcon, RefreshCwIcon, Undo2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { EASE_OUT } from "@/lib/ease";

type VersionOption = { value: string; label: string; hint: string | null };

type UpdateSettingsFormProps = {
  autoCheck: boolean;
  onAutoCheckChange: (value: boolean) => void;
  autoInstall: boolean;
  onAutoInstallChange: (value: boolean) => void;
  currentVersion: string | null;
  available: string | null;
  checking: boolean;
  onCheck: () => void;
  versions: VersionOption[];
  versionsLoading: boolean;
  versionsError: boolean;
  selected: string | null;
  onSelect: (value: string) => void;
  direction: number;
  percent: number | null;
  installing: boolean;
  onInstall: () => void;
};

export function UpdateSettingsForm(props: UpdateSettingsFormProps) {
  const reduce = useReducedMotion();
  const fade = {
    initial: { opacity: 0, y: reduce ? 0 : 4 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.18, ease: EASE_OUT } },
    exit: { opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } },
  };
  const rollback = props.direction < 0;

  return (
    <div className="flex w-full max-w-2xl flex-col gap-10">
      <section className="flex flex-col gap-4">
        <div className="flex min-h-8 items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-medium">Version</h2>
            <p className="text-sm text-muted-foreground tabular-nums">
              Installiert: {props.currentVersion ?? "…"}
            </p>
          </div>
          <Button variant="outline" onClick={props.onCheck} disabled={props.checking}>
            {props.checking ? <Spinner /> : <RefreshCwIcon />}
            Nach Updates suchen
          </Button>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          {props.available && (
            <motion.p key={props.available} {...fade} className="flex items-center gap-1.5 text-sm tabular-nums">
              <ArrowDownToLineIcon className="size-4 text-primary" />
              Version {props.available} ist verfügbar.
            </motion.p>
          )}
        </AnimatePresence>
      </section>

      <section className="flex flex-col gap-4 border-t pt-6">
        <h2 className="font-medium">Automatisch</h2>
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="update-auto-check">Automatisch nach Updates suchen</FieldLabel>
              <FieldDescription>Prüft beim Start und alle sechs Stunden, ob es eine neue Version gibt.</FieldDescription>
            </FieldContent>
            <Switch id="update-auto-check" checked={props.autoCheck} onCheckedChange={props.onAutoCheckChange} />
          </Field>
          <Field orientation="horizontal" data-disabled={!props.autoCheck || undefined}>
            <FieldContent>
              <FieldLabel htmlFor="update-auto-install">Updates automatisch installieren</FieldLabel>
              <FieldDescription>Lädt neue Versionen im Hintergrund und aktiviert sie beim nächsten Start.</FieldDescription>
            </FieldContent>
            <Switch
              id="update-auto-install"
              checked={props.autoInstall && props.autoCheck}
              disabled={!props.autoCheck}
              onCheckedChange={props.onAutoInstallChange}
            />
          </Field>
        </FieldGroup>
      </section>

      <section className="flex flex-col gap-4 border-t pt-6">
        <div className="flex flex-col gap-1">
          <h2 className="font-medium">Bestimmte Version installieren</h2>
          <p className="text-sm text-muted-foreground">
            Wähle eine Version, um zurückzurollen oder gezielt zu aktualisieren. betterjira startet danach neu.
          </p>
        </div>
        {props.versionsLoading ? (
          <Skeleton className="h-9 w-72 rounded-xl" />
        ) : props.versionsError ? (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CircleAlertIcon className="size-4 text-destructive" />
            Versionen konnten nicht geladen werden.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Select value={props.selected ?? undefined} onValueChange={(value) => value && props.onSelect(value)} disabled={props.installing}>
              <SelectTrigger aria-label="Version" className="w-56 tabular-nums">
                <SelectValue placeholder="Version wählen" />
              </SelectTrigger>
              <SelectContent>
                {props.versions.map((version) => (
                  <SelectItem key={version.value} value={version.value} className="tabular-nums">
                    {version.label}
                    {version.hint && <span className="ml-auto pl-3 text-xs text-muted-foreground">{version.hint}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={props.onInstall}
              disabled={!props.selected || props.direction === 0 || props.installing}
              variant={rollback ? "outline" : "default"}
            >
              {props.installing ? <Spinner /> : rollback ? <Undo2Icon /> : <ArrowDownToLineIcon />}
              {rollback ? "Zurückrollen" : "Installieren"}
            </Button>
          </div>
        )}
        <AnimatePresence initial={false}>
          {props.percent !== null && (
            <motion.div key="progress" {...fade} className="flex max-w-sm flex-col gap-1.5">
              <Progress value={props.percent} aria-label="Download-Fortschritt" />
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                {props.percent >= 100 ? (
                  <>
                    <CheckCircle2Icon className="size-3.5 text-emerald-500" />
                    Wird installiert, betterjira startet gleich neu …
                  </>
                ) : (
                  `${props.percent} % geladen`
                )}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}
