import { useId, type Ref } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CustomerChangeDraftState } from "@/hooks/use-customer-change-draft";

export function CustomerChangeDraftContent({ state, editorRef }: {
  state: CustomerChangeDraftState;
  editorRef: Ref<HTMLTextAreaElement>;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <h2 className="text-base font-semibold text-balance">Kundenhinweis entwerfen</h2>
      <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,4fr)_minmax(0,5fr)]">
        <section aria-labelledby={`${id}-sources`} className="flex min-w-0 flex-col gap-2">
          <h3 id={`${id}-sources`} className="text-sm font-medium">Ausgewählte Quellen (intern)</h3>
          {state.hasMore && <p className="text-xs text-muted-foreground">Weitere Treffer sind möglich. Grundlage sind deine geladenen Quellen.</p>}
          {state.readError && <p className="text-xs text-warning">Ein Abruf ist fehlgeschlagen. Die Quellen stammen aus dem zuletzt geladenen Stand.</p>}
          <ul className="max-h-44 min-w-0 divide-y overflow-y-auto overscroll-contain rounded-xl border" aria-labelledby={`${id}-sources`}>
            {state.sources.map(({ key, title }) => {
              const inserted = state.inserted.includes(key);
              return (
                <li key={key} className="flex min-w-0 items-center gap-2 px-3 py-2">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-mono text-xs text-muted-foreground wrap-anywhere">{key}</span>
                    <span className="text-sm wrap-anywhere">{title || "Kein lesbarer Titel"}</span>
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="min-h-8 shrink-0 rounded-xl px-2 text-xs"
                    aria-label={inserted ? `Titel von ${key} eingefügt` : `Titel von ${key} einfügen`}
                    disabled={inserted || !title} onClick={() => state.insertTitle(key)}>
                    {inserted ? "Eingefügt" : "Titel einfügen"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor={`${id}-text`}>Text für Kunden</Label>
          <Textarea id={`${id}-text`} ref={editorRef} value={state.text} onChange={(event) => state.setText(event.target.value)}
            aria-describedby={`${id}-hint`} rows={4} className="min-h-24 rounded-xl sm:min-h-28" />
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            Kopiert wird nur dieser Text. Prüfe interne Angaben und beschreibe die Auslieferung nur, wenn sie bestätigt ist.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <label className="flex min-h-8 items-center gap-2 text-sm">
              <Checkbox checked={state.reviewed} disabled={!state.text.trim()} onCheckedChange={(checked) => state.setReviewed(checked === true)} />
              Text für Kunden geprüft
            </label>
            <Button type="button" size="sm" aria-label="Kundenhinweis kopieren" className="ml-auto min-h-8 rounded-xl"
              disabled={!state.canCopy} onClick={() => void state.copy()}>
              Kopieren
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
