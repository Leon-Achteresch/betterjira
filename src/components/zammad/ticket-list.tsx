import { Link } from "@tanstack/react-router";
import {
  ExternalLinkIcon,
  PlusIcon,
  RotateCwIcon,
  SearchIcon,
} from "lucide-react";
import { PersonLabel } from "@/components/people/person-label";
import { ZammadLogo } from "@/components/brands/service-logos";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { HelpdeskListModel } from "@/hooks/zammad/use-helpdesk-list";

export function HelpdeskList(model: HelpdeskListModel) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-5 py-6 sm:px-8">
      <header className="flex flex-wrap items-center gap-3">
        <ZammadLogo aria-hidden className="size-5" />
        <h1 className="flex-1 text-lg font-semibold tracking-tight text-balance">
          Zammad-Tickets
        </h1>
        {model.connected && (
          <>
            <Tooltip content="In Zammad öffnen">
              <Button
                variant="ghost"
                size="icon"
                aria-label="In Zammad öffnen"
                onClick={model.onOpen}
              >
                <ExternalLinkIcon className="size-4" />
              </Button>
            </Tooltip>
            <Button asChild>
              <Link to="/helpdesk/neu">
                <PlusIcon className="size-4" />
                Ticket erstellen
              </Link>
            </Button>
          </>
        )}
      </header>
      {!model.connected && !model.loading && !model.error ? (
        <section className="flex max-w-md flex-col gap-4 py-16">
          <h2 className="text-lg font-medium text-balance">Verbinde Zammad</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Deine Support-Tickets, Kunden und Nachrichten direkt neben deinen
            Jira-Vorgängen.
          </p>
          <Button asChild className="self-start">
            <Link to="/settings/verbindungen">Verbindung einrichten</Link>
          </Button>
        </section>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-48 flex-1">
              <SearchIcon className="pointer-events-none absolute top-2.5 left-3 size-3.5 text-muted-foreground" />
              <Input
                aria-label="Zammad-Tickets durchsuchen"
                placeholder="Suchen nach Titel oder Ticketnummer …"
                className="h-9 border-transparent bg-muted/40 pl-9 text-[13px] shadow-none"
                value={model.text}
                onChange={(event) => model.setText(event.target.value)}
              />
            </div>
            <Select value={model.filter} onValueChange={model.setFilter}>
              <SelectTrigger
                aria-label="Ticketfilter"
                className="h-9 border-transparent bg-muted/30 text-[13px] shadow-none"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Offene Tickets</SelectItem>
                <SelectItem value="mine">Mir zugewiesen</SelectItem>
                <SelectItem value="all">Alle Tickets</SelectItem>
              </SelectContent>
            </Select>
            <Tooltip content="Tickets aktualisieren">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Tickets aktualisieren"
                onClick={model.onRefresh}
                disabled={model.refreshing}
              >
                <RotateCwIcon className="size-4" />
              </Button>
            </Tooltip>
          </div>
          {model.error && (
            <p role="alert" className="text-sm text-destructive">
              {model.error}
            </p>
          )}
          {model.loading ? (
            <div aria-label="Tickets werden geladen" className="space-y-2">
              {[1, 2, 3, 4].map((key) => (
                <Skeleton key={key} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : (
            <div>
              <div className="hidden grid-cols-[6.5rem_minmax(0,1fr)_10rem_4rem_8.5rem] gap-4 px-2 pb-3 text-xs text-muted-foreground md:grid">
                <span>Ticket</span>
                <span>Zusammenfassung</span>
                <span>Kunde</span>
                <span>Zuständig</span>
                <span className="text-right">Aktualisiert</span>
              </div>
              <Stagger className="space-y-1">
                {model.tickets.map((ticket) => (
                  <StaggerItem key={ticket.id}>
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <Link
                          to="/helpdesk/$id"
                          params={{ id: String(ticket.id) }}
                          onMouseEnter={() => model.onPrefetch(ticket.id)}
                          onFocus={() => model.onPrefetch(ticket.id)}
                          className="grid min-h-14 grid-cols-[6rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-xl px-2 py-2.5 text-[13px] transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 md:grid-cols-[6.5rem_minmax(0,1fr)_10rem_4rem_8.5rem] md:gap-x-4"
                        >
                          <span className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                            <span className="size-1.5 shrink-0 rounded-full bg-info" />
                            #{ticket.number}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              {ticket.title}
                            </span>
                            <span className="mt-1 block text-[11px] text-muted-foreground md:hidden">
                              {ticket.stateLabel} · {ticket.group}
                            </span>
                          </span>
                          <span className="col-start-2 min-w-0 md:col-auto">
                            <PersonLabel {...ticket.customerPerson} size="sm" />
                          </span>
                          <span className="hidden md:block">
                            {ticket.ownerPerson && (
                              <PersonLabel
                                {...ticket.ownerPerson}
                                size="sm"
                                avatarOnly
                              />
                            )}
                          </span>
                          <time className="hidden text-right text-xs text-muted-foreground tabular-nums md:block">
                            {ticket.updatedLabel}
                          </time>
                        </Link>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-80 space-y-3 p-4">
                        <p className="text-xs text-muted-foreground tabular-nums">
                          Zammad · #{ticket.number} · {ticket.stateLabel}
                        </p>
                        <p className="text-sm font-medium">{ticket.title}</p>
                        <PersonLabel
                          {...ticket.customerPerson}
                          subtitle={ticket.customerPerson.email}
                        />
                      </HoverCardContent>
                    </HoverCard>
                  </StaggerItem>
                ))}
                {!model.tickets.length && (
                  <p className="py-16 text-center text-sm text-muted-foreground">
                    Keine passenden Tickets. Versuche einen anderen Suchbegriff
                    oder Filter.
                  </p>
                )}
              </Stagger>
            </div>
          )}
          {model.hasMore && (
            <Button
              variant="ghost"
              className="self-center"
              disabled={model.loadingMore}
              onClick={model.onMore}
            >
              {model.loadingMore ? "Lade …" : "Weitere Tickets laden"}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
