import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ZammadLogo } from "@/components/brands/service-logos";
import { UserPicker } from "./user-picker";
import { PropertySelect } from "./ticket-properties";
import type { CreateTicketFormModel } from "@/hooks/zammad/use-create-ticket-form";

export function CreateHelpdeskTicket(model: CreateTicketFormModel) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-5 sm:p-8">
      <Link to="/helpdesk" className="text-sm text-muted-foreground">
        ← Zu den Zammad-Tickets
      </Link>
      <header className="flex items-center gap-3">
        <ZammadLogo aria-hidden className="size-8" />
        <h1 className="text-2xl font-semibold text-balance">
          Neues Zammad-Ticket
        </h1>
      </header>
      {model.error && (
        <p role="alert" className="text-sm text-destructive">
          {model.error}
        </p>
      )}
      {model.loading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : !model.connected ? (
        <Button asChild>
          <Link to="/settings/verbindungen">Zammad verbinden</Link>
        </Button>
      ) : (
        <form onSubmit={model.onSubmit} className="flex flex-col gap-5 py-2">
          <label className="grid gap-1.5 text-sm">
            Titel
            <Input name="title" required maxLength={250} autoFocus />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <PropertySelect
              name="group_id"
              label="Gruppe"
              options={model.groups}
            />
            <PropertySelect
              name="priority_id"
              label="Priorität"
              value={model.defaultPriority?.id}
              current={model.defaultPriority?.name}
              options={model.priorities}
            />
          </div>
          <UserPicker model={model.customer} name="customer_id" label="Kunde" />
          <label className="grid gap-1.5 text-sm">
            Beschreibung
            <Textarea
              name="body"
              required
              rows={7}
              placeholder="Wobei können wir helfen?"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Die Beschreibung wird als öffentliche Notiz für den Kunden
            gespeichert.
          </p>
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={
                model.saving ||
                !model.customer.value ||
                !model.groups.length ||
                !model.priorities.length
              }
            >
              {model.saving ? "Erstelle…" : "Ticket erstellen"}
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/helpdesk">Abbrechen</Link>
            </Button>
          </div>
        </form>
      )}
    </main>
  );
}
