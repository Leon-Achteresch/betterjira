import { Link } from "@tanstack/react-router";
import { ExternalLinkIcon, MoreHorizontalIcon } from "lucide-react";
import { ZammadLogo } from "@/components/brands/service-logos";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Conversation } from "./conversation";
import { TicketProperties } from "./ticket-properties";
import { TicketRelations, TicketTags, TicketTime } from "./ticket-extras";
import type { HelpdeskDetailModel } from "@/hooks/zammad/use-helpdesk-detail";

export function HelpdeskDetail(model: HelpdeskDetailModel) {
  return (
    <div className="@container mx-auto w-full max-w-6xl px-5 py-5 sm:px-8">
      <nav
        aria-label="Ticketpfad"
        className="mb-7 flex min-h-8 flex-wrap items-center gap-2 text-xs text-muted-foreground"
      >
        <ZammadLogo aria-hidden className="size-4" />
        <Link to="/helpdesk" className="hover:text-foreground">
          Zammad-Tickets
        </Link>
        <span>/</span>
        <span className="text-foreground tabular-nums">#{model.number}</span>
        <span className="ml-2 inline-flex items-center gap-1.5 rounded-xl bg-muted/60 px-2 py-1 text-[11px]">
          <span className="size-1.5 rounded-full bg-info" />
          {model.stateLabel}
        </span>
        <DropdownMenu>
          <Tooltip content="Weitere Ticketaktionen">
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto"
                aria-label="Weitere Ticketaktionen"
              >
                <MoreHorizontalIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={model.onOpen}
              disabled={!model.connected}
            >
              <ExternalLinkIcon />
              In Zammad öffnen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
      {model.loading ? (
        <>
          <Skeleton className="mb-8 h-8 w-3/4" />
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </>
      ) : model.error ? (
        <section className="space-y-3 py-10">
          <p role="alert" className="text-sm text-destructive">
            {model.error}
          </p>
          <Button variant="ghost" onClick={model.onRetry}>
            Erneut versuchen
          </Button>
        </section>
      ) : !model.connected ? (
        <section className="space-y-4 py-10">
          <h1 className="text-lg font-medium text-balance">Zammad verbinden</h1>
          <p className="text-sm text-muted-foreground">
            Verbinde deine Instanz, um dieses Ticket zu öffnen.
          </p>
          <Button asChild>
            <Link to="/settings/verbindungen">Verbindung einrichten</Link>
          </Button>
        </section>
      ) : (
        <Stagger className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <StaggerItem className="min-w-0">
            <h1
              aria-label={model.title}
              className="mb-7 text-2xl leading-snug font-semibold tracking-tight text-balance"
            >
              <Input
                name="title"
                aria-label="Titel"
                defaultValue={model.title}
                onBlur={model.onTitleBlur}
                onKeyDown={model.onTitleKeyDown}
                className="h-auto rounded-xl border-transparent bg-transparent px-0 py-0 text-2xl font-semibold shadow-none hover:border-border/60 focus-visible:px-2 focus-visible:ring-1 sm:text-2xl md:text-2xl dark:bg-transparent"
              />
            </h1>
            <Tabs
              value={model.tab}
              onValueChange={model.setTab}
              className="gap-7"
            >
              <TabsList
                aria-label="Ticketbereich"
                variant="line"
                className="gap-4 px-0"
              >
                <TabsTrigger value="conversation" className="px-0 text-[13px]">
                  Verlauf
                  <span className="ml-1 text-xs font-normal text-muted-foreground tabular-nums">
                    {model.articles.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="relations" className="px-0 text-[13px]">
                  Verknüpfungen
                </TabsTrigger>
                <TabsTrigger value="time" className="px-0 text-[13px]">
                  Zeit
                </TabsTrigger>
              </TabsList>
              <TabsContent value="conversation">
                <Conversation model={model} />
              </TabsContent>
              <TabsContent value="relations">
                <TicketRelations model={model} />
              </TabsContent>
              <TabsContent value="time">
                <TicketTime model={model} />
              </TabsContent>
            </Tabs>
          </StaggerItem>
          <StaggerItem className="flex min-w-0 flex-col gap-7 lg:border-l lg:border-border/50 lg:pl-6">
            <TicketProperties model={model} />
            <TicketTags model={model} />
          </StaggerItem>
        </Stagger>
      )}
    </div>
  );
}
