import { BookTemplateIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { IconAction } from "@/components/motion/icon-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { CreateIssueForm } from "@/hooks/jira/use-create-issue-form";
import { EASE_OUT } from "@/lib/ease";

export function TemplateMenu({ form }: { form: CreateIssueForm }) {
  return (
    <Popover open={form.templatesOpen} onOpenChange={form.setTemplatesOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" disabled={form.status !== "ready" || form.pending}>
          <BookTemplateIcon />
          Vorlagen
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-3" aria-label="Ticketvorlagen">
        <div className="space-y-1">
          <h2 className="font-medium text-balance">Deine Ticketvorlagen</h2>
          <p className="text-xs text-muted-foreground">
            Für {form.project?.name} · {form.issueType?.name}. Nur für dein Konto auf diesem Gerät.
          </p>
        </div>
        <div className="max-h-56 overflow-y-auto">
          <AnimatePresence initial={false}>
            {form.templates.map((template) => (
              <motion.div key={template.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15, ease: EASE_OUT }} className="flex items-center gap-1 rounded-xl">
                <Button type="button" variant="ghost" className="min-w-0 flex-1 justify-start" onClick={() => form.applyTemplate(template)}>
                  <span className="truncate">{template.name}</span>
                </Button>
                <IconAction type="button" label={`Vorlage ${template.name} löschen`} tooltip="Vorlage löschen" onClick={() => form.removeTemplate(template)}>
                  <Trash2Icon />
                </IconAction>
              </motion.div>
            ))}
          </AnimatePresence>
          {form.templates.length === 0 && <p className="py-3 text-xs text-muted-foreground">Speichere deine Eingaben als Vorlage für ähnliche Tickets.</p>}
        </div>
        <div className="space-y-2 border-t pt-3">
          <Label htmlFor="create-template-name">Neue Vorlage</Label>
          <Input id="create-template-name" value={form.templateName} onChange={(event) => form.setTemplateName(event.target.value)} onKeyDown={form.onTemplateKeyDown} placeholder="Zum Beispiel: Fehlerbericht" maxLength={80} />
          {form.templateNameExists && <p role="status" className="text-xs text-muted-foreground">Dieser Name wird bereits verwendet.</p>}
          <Button type="button" variant="secondary" className="w-full" disabled={!form.templateName.trim() || form.templateNameExists || !form.hasDraft} onClick={form.saveTemplate}>
            <PlusIcon />
            Als Vorlage speichern
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
