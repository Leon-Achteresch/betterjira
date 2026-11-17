import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { EASE_OUT } from "@/lib/ease";

const EMPTY = "Leer";

const focusOnMount = (node: HTMLElement | null) => node?.focus();

function SourceColumn({ label, source, missing }: { label: string; source: string | undefined; missing?: string }) {
  return (
    <section className="flex min-w-0 flex-col gap-1.5">
      <h4 className="text-xs font-medium text-muted-foreground">{label}</h4>
      {missing ? (
        <p className="rounded-xl border border-dashed px-3 py-2 text-xs text-muted-foreground">{missing}</p>
      ) : (
        <pre tabIndex={0} aria-label={label} className="max-h-48 overflow-auto rounded-xl border bg-background px-3 py-2 font-mono text-[11px] leading-4 whitespace-pre-wrap break-words">
          {source ?? EMPTY}
        </pre>
      )}
    </section>
  );
}

export function DescriptionComparisonPanel({
  status,
  remote,
  basis,
  pending,
  onConfirm,
}: {
  status: "conflict" | "unbased";
  remote: string | undefined;
  basis: string | undefined;
  pending: boolean;
  onConfirm: () => void;
}) {
  const reduce = useReducedMotion();
  const [reviewedRemote, setReviewedRemote] = useState<string | null>(null);
  const remoteKey = remote ?? "";
  const reviewed = reviewedRemote === remoteKey;
  const title = status === "conflict" ? "Beschreibung wurde in Jira geändert" : "Ursprüngliche Fassung fehlt";
  const reason = status === "conflict"
    ? "Seit Beginn deiner Bearbeitung hat sich die Beschreibung in Jira geändert. Prüfe die aktuelle Jira-Fassung und passe deinen Entwurf oben an."
    : "Dieser ältere Entwurf kennt die Fassung nicht, auf der er beruht. Prüfe die aktuelle Jira-Fassung und passe deinen Entwurf oben an.";

  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: EASE_OUT }}
      role="group"
      aria-labelledby="description-comparison-title"
      className="flex flex-col gap-3 rounded-2xl border border-warning/30 bg-warning/5 p-3"
    >
      <div className="flex flex-col gap-1">
        <h3
          id="description-comparison-title"
          tabIndex={-1}
          ref={focusOnMount}
          className="text-sm font-semibold text-balance text-warning outline-none"
        >
          {title}
        </h3>
        <p className="text-xs text-muted-foreground">{reason} Nichts wird automatisch zusammengeführt oder überschrieben.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <SourceColumn label="Aktuell in Jira" source={remote} />
        <SourceColumn
          label="Stand bei Bearbeitungsbeginn"
          source={basis}
          missing={status === "unbased" ? "Für diesen Entwurf nicht gespeichert." : undefined}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-h-8 cursor-pointer items-center gap-2 text-xs">
          <Checkbox checked={reviewed} onCheckedChange={(value) => setReviewedRemote(value === true ? remoteKey : null)} />
          Ich habe die Jira-Fassung geprüft
        </label>
        <Button type="button" size="sm" variant="outline" className="ml-auto" disabled={!reviewed || pending} onClick={onConfirm}>
          {pending && <Spinner />}
          Entwurf trotzdem speichern
        </Button>
      </div>
    </motion.div>
  );
}
