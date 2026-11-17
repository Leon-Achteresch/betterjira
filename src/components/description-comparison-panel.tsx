import { useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { AdfContent } from "@/components/adf-content";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useKnownAdfMedia } from "@/hooks/jira/use-known-adf-media";
import type { EditorMediaSource } from "@/hooks/jira/use-editor-media";
import { isAdfDoc, isBlankAdf } from "@/lib/jira/adf";
import { EASE_OUT } from "@/lib/ease";

const EMPTY = "Leer";
const SURFACE = "max-h-64 overflow-auto rounded-xl border bg-background px-3 py-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

type View = "preview" | "source";
type Side = { label: string; source: string | undefined; preview?: ReactNode; missing?: string; action?: ReactNode };

const focusOnMount = (node: HTMLElement | null) => node?.focus();

export function DescriptionPreview({ doc, mediaSource }: { doc: unknown; mediaSource: EditorMediaSource | undefined }) {
  const media = useKnownAdfMedia(doc, mediaSource);
  if (!isAdfDoc(doc) || isBlankAdf(doc)) return <p className="text-sm text-muted-foreground">{EMPTY}</p>;
  return <AdfContent doc={doc} media={media} />;
}

function SourceColumn({ side, view }: { side: Side; view: View }) {
  const preview = view === "preview" && side.preview !== undefined;
  return (
    <section className="flex min-w-0 flex-col gap-1.5">
      <div className="flex min-h-7 items-center justify-between gap-2">
        <h4 className="text-xs font-medium text-muted-foreground">{side.label}</h4>
        {side.action}
      </div>
      {side.missing ? (
        <p className="rounded-xl border border-dashed px-3 py-2 text-xs text-muted-foreground">{side.missing}</p>
      ) : preview ? (
        <div tabIndex={0} role="region" aria-label={side.label} className={SURFACE}>
          {side.preview}
        </div>
      ) : (
        <pre tabIndex={0} aria-label={side.label} className={`${SURFACE} font-mono text-[11px] leading-4 whitespace-pre-wrap break-words`}>
          {side.source ?? EMPTY}
        </pre>
      )}
    </section>
  );
}

function SourceGrid({ sides, view }: { sides: readonly Side[]; view: View }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {sides.map((side) => <SourceColumn key={side.label} side={side} view={view} />)}
    </div>
  );
}

export function DescriptionComparisonPanel({
  status,
  remote,
  basis,
  remotePreview,
  basisPreview,
  pending,
  onConfirm,
  onAdopt,
}: {
  status: "conflict" | "unbased";
  remote: string | undefined;
  basis: string | undefined;
  remotePreview?: ReactNode;
  basisPreview?: ReactNode;
  pending: boolean;
  onConfirm: () => void;
  onAdopt?: () => void;
}) {
  const reduce = useReducedMotion();
  const [reviewedRemote, setReviewedRemote] = useState<string | null>(null);
  const [view, setView] = useState<View>("preview");
  const remoteKey = remote ?? "";
  const reviewed = reviewedRemote === remoteKey;
  const title = status === "conflict" ? "Beschreibung wurde in Jira geändert" : "Ursprüngliche Fassung fehlt";
  const reason = status === "conflict"
    ? "Seit Beginn deiner Bearbeitung hat sich die Beschreibung in Jira geändert. Prüfe die aktuelle Jira-Fassung und passe deinen Entwurf oben an."
    : "Dieser ältere Entwurf kennt die Fassung nicht, auf der er beruht. Prüfe die aktuelle Jira-Fassung und passe deinen Entwurf oben an.";
  const sides: Side[] = [
    {
      label: "Aktuell in Jira",
      source: remote,
      preview: remotePreview,
      action: onAdopt && (
        <Button type="button" size="xs" variant="ghost" className="rounded-xl" disabled={pending} onClick={onAdopt}>
          In Entwurf übernehmen
        </Button>
      ),
    },
    {
      label: "Stand bei Bearbeitungsbeginn",
      source: basis,
      preview: basisPreview,
      missing: status === "unbased" ? "Für diesen Entwurf nicht gespeichert." : undefined,
    },
  ];
  const previewable = remotePreview !== undefined || basisPreview !== undefined;

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
      {previewable ? (
        <Tabs value={view} onValueChange={(value) => setView(value === "source" ? "source" : "preview")} className="gap-2">
          <TabsList aria-label="Darstellung der Fassungen">
            <TabsTrigger value="preview" className="px-3 text-xs">Vorschau</TabsTrigger>
            <TabsTrigger value="source" className="px-3 text-xs">Quelle</TabsTrigger>
          </TabsList>
          <TabsContent value="preview"><SourceGrid sides={sides} view="preview" /></TabsContent>
          <TabsContent value="source"><SourceGrid sides={sides} view="source" /></TabsContent>
        </Tabs>
      ) : (
        <SourceGrid sides={sides} view="source" />
      )}
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
