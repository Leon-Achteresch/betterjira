import { Link2Icon, CheckIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { IssueLinkActions } from "@/hooks/jira/use-issue-link-actions";
import { jiraErrorText } from "@/lib/jira/field-values";
import { EASE_OUT } from "@/lib/ease";

export function AddIssueLink({ actions }: { actions: IssueLinkActions }) {
  return (
    <Popover open={actions.open} onOpenChange={actions.setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" className="ml-auto" disabled={actions.pending}><Link2Icon />Verknüpfen</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 max-w-[calc(100vw-2rem)] gap-3 p-4" aria-label="Ticket verknüpfen">
        <h2 className="font-medium text-balance">Ticket verknüpfen</h2>
        {actions.metadataLoading ? <Skeleton className="h-8 w-full rounded-xl" /> : actions.metadataError ? (
          <div role="alert" className="space-y-2 text-sm text-destructive">
            <p>Beziehungen konnten nicht geladen werden. {jiraErrorText(actions.metadataError)}</p>
            <Button variant="outline" onClick={actions.retryMetadata}>Erneut versuchen</Button>
          </div>
        ) : actions.forbidden ? (
          <p className="text-sm text-muted-foreground">Dir fehlt die Jira-Berechtigung, dieses Ticket zu verknüpfen.</p>
        ) : actions.choices.length === 0 ? (
          <p className="text-sm text-muted-foreground">In Jira sind keine Beziehungstypen verfügbar.</p>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="link-relationship">Dieses Ticket…</Label>
              <Select value={actions.choice?.id ?? ""} onValueChange={actions.setChoice} disabled={actions.pending}>
                <SelectTrigger id="link-relationship" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{actions.choices.map((choice) => <SelectItem key={choice.id} value={choice.id}>{choice.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="link-target">…dieses Ticket</Label>
              <Input id="link-target" placeholder="Schlüssel oder Titel suchen…" value={actions.search} onChange={(event) => actions.setSearch(event.target.value)} disabled={actions.pending} autoComplete="off" />
            </div>
            <div className="max-h-56 overflow-y-auto" aria-label="Passende Tickets">
              {actions.searching ? <Skeleton className="h-9 w-full rounded-xl" /> : actions.searchError ? (
                <div role="alert" className="space-y-2 text-xs text-destructive"><p>{actions.searchError}</p><Button variant="outline" onClick={actions.retrySearch}>Suche erneut laden</Button></div>
              ) : actions.search.trim().length >= 2 && actions.targets.length === 0 ? <p className="py-2 text-xs text-muted-foreground">Keine sichtbaren Tickets gefunden.</p> : null}
              <AnimatePresence initial={false}>
                {actions.targets.map((target) => (
                  <motion.div key={target.key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15, ease: EASE_OUT }}>
                    <Button type="button" variant="ghost" className="h-auto min-h-9 w-full justify-start py-2" aria-pressed={actions.target === target.key} disabled={actions.pending} onClick={() => actions.selectTarget(target.key)}>
                      <span className="text-xs text-muted-foreground">{target.key}</span><span className="min-w-0 flex-1 truncate text-left">{target.fields.summary}</span>{actions.target === target.key && <CheckIcon />}
                    </Button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            {(actions.validation || actions.error) && <p role="alert" className="text-xs text-destructive">{actions.validation ?? actions.error}</p>}
            <Button type="button" onClick={actions.submit} disabled={!actions.canSubmit}>{actions.pending ? "Wird verknüpft…" : "Verknüpfung anlegen"}</Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
