import { BookTemplateIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { IconAction } from "@/components/motion/icon-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { CreateIssueForm } from "@/hooks/jira/use-create-issue-form";
import { EASE_OUT } from "@/lib/ease";
import { Spinner } from "@/components/ui/spinner";

export function TemplateMenu({ form }: { form: CreateIssueForm }) {
  return (
    <Popover open={form.templatesOpen} onOpenChange={form.setTemplatesOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" disabled={form.status !== "ready" || form.pending || form.templatesPending}>
          {form.templatesPending ? <Spinner /> : <BookTemplateIcon />}
          {form.templatesPending ? "Vorlage wird geprüft…" : "Vorlagen"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-3" aria-label="Ticketvorlagen">
        <div className="space-y-1">
          <h2 className="font-medium text-balance">Deine Ticketvorlagen</h2>
          <p className="text-xs text-muted-foreground">
            Für {form.project?.name} · {form.issueType?.name}. Nur für dein Konto auf diesem Gerät.
          </p>
          <p className="text-xs text-muted-foreground">Projekt und Typ bleiben wie gewählt. Feldwerte werden vor der Übernahme im Ziel geprüft.</p>
        </div>
        <AnimatePresence initial={false}>
          {form.templateError && <motion.p key="template-error" role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15, ease: EASE_OUT }} className="py-2 text-xs text-destructive">{form.templateError}</motion.p>}
        </AnimatePresence>
        <div className="max-h-56 overflow-y-auto">
          <AnimatePresence initial={false}>
            {form.templateGroups.map((group) => (
              <motion.section key={group.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15, ease: EASE_OUT }} className="py-2">
                <h3 className="px-2 text-xs font-medium text-muted-foreground text-balance">{group.label}</h3>
                {group.templates.map((template) => (
                  <motion.div key={template.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15, ease: EASE_OUT }} className="flex items-center gap-1 rounded-xl">
                    <Button type="button" variant="ghost" className="h-auto min-h-8 min-w-0 flex-1 flex-col items-start gap-0 py-1.5" disabled={form.templatesPending} onClick={() => void form.applyTemplate(template)}>
                      <span className="max-w-full truncate">{template.name}</span>
                      <span className="max-w-full truncate text-xs font-normal text-muted-foreground">{template.sourceLabel}</span>
                    </Button>
                    <IconAction type="button" label={`Vorlage ${template.name} löschen`} tooltip="Vorlage löschen" disabled={form.templatesPending} onClick={() => form.removeTemplate(template)}>
                      <Trash2Icon />
                    </IconAction>
                  </motion.div>
                ))}
              </motion.section>
            ))}
          </AnimatePresence>
          {form.templates.length === 0 && <p className="py-3 text-xs text-muted-foreground">Speichere deine Eingaben als Vorlage für ähnliche Tickets.</p>}
        </div>
        <div className="space-y-2 border-t pt-3">
          <Label htmlFor="create-template-name">Neue Vorlage</Label>
          <Input id="create-template-name" value={form.templateName} onChange={(event) => form.setTemplateName(event.target.value)} onKeyDown={form.onTemplateKeyDown} placeholder="Zum Beispiel: Fehlerbericht" maxLength={80} />
          {form.templateNameExists && <p role="status" className="text-xs text-muted-foreground">Dieser Name wird bereits verwendet.</p>}
          <Button type="button" variant="secondary" className="w-full" disabled={form.templatesPending || !form.templateName.trim() || form.templateNameExists || !form.hasDraft} onClick={form.saveTemplate}>
            <PlusIcon />
            Als Vorlage speichern
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
