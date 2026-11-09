import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/motion/tooltip";
import type { HelpdeskDetailModel } from "@/hooks/zammad/use-helpdesk-detail";
import { XIcon } from "lucide-react";

export function TicketTags({ model }: { model: HelpdeskDetailModel }) {
  return (
    <section className="flex flex-col gap-3" aria-label="Tags">
      <h2 className="text-xs font-medium text-muted-foreground">Tags</h2>
      {model.tagsError && (
        <p role="alert" className="text-xs text-destructive">
          {model.tagsError}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {model.tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center rounded-xl bg-muted pl-3 text-xs"
          >
            {tag}
            <Tooltip content={`${tag} entfernen`}>
              <Button
                aria-label={`${tag} entfernen`}
                size="icon"
                variant="ghost"
                className="size-8"
                disabled={model.tagging}
                onClick={() => model.onRemoveTag(tag)}
              >
                <XIcon className="size-3" />
              </Button>
            </Tooltip>
          </span>
        ))}
      </div>
      <form onSubmit={model.onTag} className="flex gap-1">
        <Input
          name="tag"
          aria-label="Neuer Tag"
          placeholder="Tag hinzufügen …"
          required
          maxLength={100}
          className="h-8 min-w-0 border-transparent bg-muted/30 text-xs shadow-none"
        />
        <Button
          type="submit"
          variant="ghost"
          disabled={model.tagging}
          className="text-xs"
        >
          Hinzufügen
        </Button>
      </form>
    </section>
  );
}

export function TicketTime({ model }: { model: HelpdeskDetailModel }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Zeiterfassung</h2>
        <span className="text-sm tabular-nums">
          {model.totalTime} Zeiteinheiten
        </span>
      </div>
      {model.timeError && (
        <p role="alert" className="text-sm text-destructive">
          {model.timeError}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Die Einheit richtet sich nach der Konfiguration deiner Zammad-Instanz.
      </p>
      <ul className="divide-y">
        {model.time.map((entry) => (
          <li
            key={entry.id}
            className="flex justify-between gap-4 py-3 text-sm tabular-nums"
          >
            <span className="text-muted-foreground">{entry.dateLabel}</span>
            <span>{entry.time_unit} ZE</span>
          </li>
        ))}
      </ul>
      <form onSubmit={model.onTime} className="flex items-end gap-2">
        <label className="grid flex-1 gap-1.5 text-xs text-muted-foreground">
          Zeiteinheiten
          <Input
            name="time"
            type="number"
            min="0.01"
            step="0.01"
            required
            placeholder="z. B. 15"
          />
        </label>
        <Button type="submit" disabled={model.booking}>
          Zeit buchen
        </Button>
      </form>
    </section>
  );
}

export function TicketRelations({ model }: { model: HelpdeskDetailModel }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-medium">Verknüpfte Tickets</h2>
      {model.linksError && (
        <p role="alert" className="text-sm text-destructive">
          {model.linksError}
        </p>
      )}
      <ul className="space-y-1">
        {model.links.map((link) => (
          <li key={`${link.link_type}-${link.link_object_value}`}>
            <Link
              to="/helpdesk/$id"
              params={{ id: String(link.link_object_value) }}
              onMouseEnter={() => model.onPrefetch(link.link_object_value)}
              className="flex items-center gap-3 rounded-xl p-3 text-sm hover:bg-muted"
            >
              <span className="text-xs text-muted-foreground tabular-nums">
                #{link.number ?? link.link_object_value}
              </span>
              <span className="flex-1 truncate">{link.title}</span>
              <span className="text-xs text-muted-foreground">
                {link.link_type}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {!model.links.length && !model.linksError && (
        <p className="text-sm text-muted-foreground">
          Noch keine verknüpften Tickets.
        </p>
      )}
      <form onSubmit={model.onLink} className="flex flex-wrap gap-2">
        <Input
          name="number"
          aria-label="Ticketnummer verknüpfen"
          placeholder="Ticketnummer"
          required
          pattern="[0-9]+"
          className="min-w-32 flex-1"
        />
        <select
          name="type"
          aria-label="Verknüpfungsart"
          className="h-9 rounded-xl border bg-background px-3 text-sm"
        >
          <option value="normal">Verknüpft</option>
          <option value="parent">Übergeordnet</option>
          <option value="child">Untergeordnet</option>
        </select>
        <Button type="submit" disabled={model.linking}>
          Verknüpfen
        </Button>
      </form>
    </section>
  );
}
