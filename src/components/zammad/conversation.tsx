import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ChevronDownIcon,
  CornerUpLeftIcon,
  LockKeyholeIcon,
  MailIcon,
  MessageSquareIcon,
  PaperclipIcon,
  PhoneIcon,
  XIcon,
} from "lucide-react";
import { PersonLabel } from "@/components/people/person-label";
import { IsolatedHtml } from "@/components/ui/isolated-html";
import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { FADE_IN, FADE_OUT } from "@/lib/ease";
import { IS_MAC } from "@/lib/platform";
import type { HelpdeskDetailModel } from "@/hooks/zammad/use-helpdesk-detail";

export function Conversation({ model }: { model: HelpdeskDetailModel }) {
  return (
    <div className="flex min-w-0 flex-col gap-8">
      {model.articlesError && (
        <p role="alert" className="text-sm text-destructive">
          {model.articlesError}
        </p>
      )}
      {model.articlesLoading ? (
        <div className="space-y-6">
          {[1, 2].map((key) => (
            <div key={key} className="flex gap-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-14 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Stagger className="flex flex-col gap-7">
          {model.articles.map((article) => (
            <StaggerItem key={article.id}>
              <article
                aria-label={
                  article.internal ? "Interner Kommentar" : "Nachricht"
                }
                className="min-w-0"
              >
                <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <PersonLabel {...article.author} />
                  <span className="text-[11px] text-muted-foreground">
                    {article.role}
                  </span>
                  {article.internal && (
                    <LockKeyholeIcon
                      aria-label="Nur intern sichtbar"
                      className="size-3 text-muted-foreground"
                    />
                  )}
                  <time
                    className="ml-auto text-[11px] text-muted-foreground tabular-nums"
                    dateTime={article.created_at}
                  >
                    {article.dateLabel}
                  </time>
                  {article.canReply && (
                    <Button
                      variant="ghost"
                      className="h-8 gap-1.5 px-2 text-xs text-muted-foreground"
                      onClick={() => model.onReply(article)}
                      aria-label={`Auf Nachricht von ${article.author.name} antworten`}
                    >
                      <CornerUpLeftIcon className="size-3.5" />
                      Antworten
                    </Button>
                  )}
                </header>
                <div className="mt-2 min-w-0 pl-[2.625rem] text-[13px] leading-relaxed">
                  {!article.internal && article.to && (
                    <p className="mb-2 truncate text-[11px] text-muted-foreground">
                      An {article.to}
                      {article.cc && ` · CC ${article.cc}`}
                    </p>
                  )}
                  {article.html ? (
                    <IsolatedHtml
                      title={`Nachricht ${article.id}`}
                      html={article.html}
                    />
                  ) : (
                    <p className="max-w-[72ch] break-words whitespace-pre-wrap">
                      {article.body}
                    </p>
                  )}
                  {!!article.attachments?.length && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {article.attachments.map((attachment) => (
                        <Button
                          key={attachment.id}
                          variant="ghost"
                          className="h-8 gap-2 bg-muted/40 px-2.5 text-xs font-normal"
                          disabled={model.downloading}
                          onClick={() =>
                            model.onDownload(
                              article.id,
                              attachment.id,
                              attachment.filename,
                            )
                          }
                        >
                          <PaperclipIcon className="size-3.5" />
                          {attachment.filename}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            </StaggerItem>
          ))}
          {!model.articles.length && (
            <p className="text-sm text-muted-foreground">
              Noch keine Nachrichten oder Kommentare.
            </p>
          )}
        </Stagger>
      )}
      <TicketComposer model={model} />
    </div>
  );
}

function TicketComposer({ model }: { model: HelpdeskDetailModel }) {
  const reduce = useReducedMotion();
  return (
    <form
      onSubmit={model.onArticle}
      aria-label="Kommentar oder Nachricht verfassen"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="h-8 gap-2 px-0 text-[13px]"
              aria-label="Kommunikationsart wählen"
            >
              {model.kind === "email" ? (
                <MailIcon className="size-4" />
              ) : model.kind === "phone" ? (
                <PhoneIcon className="size-4" />
              ) : model.kind === "internal" ? (
                <LockKeyholeIcon className="size-4" />
              ) : (
                <MessageSquareIcon className="size-4" />
              )}
              {model.kind === "email"
                ? "E-Mail"
                : model.kind === "phone"
                  ? "Telefonnotiz"
                  : model.kind === "public"
                    ? "Öffentlicher Kommentar"
                    : "Interner Kommentar"}
              <ChevronDownIcon className="size-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuItem onSelect={() => model.setKind("internal")}>
              <LockKeyholeIcon />
              <span>
                Interner Kommentar
                <span className="block text-xs font-normal text-muted-foreground">
                  Nur für dein Team
                </span>
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => model.setKind("email")}>
              <MailIcon />
              <span>
                E-Mail
                <span className="block text-xs font-normal text-muted-foreground">
                  Nachricht an einen Empfänger senden
                </span>
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => model.setKind("phone")}>
              <PhoneIcon />
              Telefonnotiz
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => model.setKind("public")}>
              <MessageSquareIcon />
              Öffentlicher Kommentar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <AnimatePresence initial={false}>
        {model.kind === "email" && (
          <motion.div
            key="email"
            initial={{ opacity: 0, y: reduce ? 0 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: FADE_OUT }}
            transition={FADE_IN}
            className="space-y-2"
          >
            {model.replyTarget && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CornerUpLeftIcon className="size-3.5" />
                <span className="flex-1 truncate">
                  Antwort auf „{model.replyTarget.subject || "Nachricht"}“
                </span>
                <Tooltip content="Antwortbezug entfernen">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Antwortbezug entfernen"
                    onClick={model.onCancelReply}
                  >
                    <XIcon className="size-3.5" />
                  </Button>
                </Tooltip>
              </div>
            )}
            <label className="grid grid-cols-[3rem_minmax(0,1fr)] items-center text-xs text-muted-foreground">
              An
              <Input
                name="to"
                type="email"
                required
                value={model.recipient}
                onChange={(event) => model.setRecipient(event.target.value)}
                className="border-transparent bg-muted/30 text-[13px] shadow-none"
              />
            </label>
            <label className="grid grid-cols-[3rem_minmax(0,1fr)] items-center text-xs text-muted-foreground">
              CC
              <Input
                name="cc"
                value={model.cc}
                onChange={(event) => model.setCc(event.target.value)}
                placeholder="Optional"
                className="border-transparent bg-muted/30 text-[13px] shadow-none"
              />
            </label>
            <label className="grid grid-cols-[3rem_minmax(0,1fr)] items-center text-xs text-muted-foreground">
              Betreff
              <Input
                name="subject"
                required
                value={model.subject}
                onChange={(event) => model.setSubject(event.target.value)}
                className="border-transparent bg-muted/30 text-[13px] shadow-none"
              />
            </label>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="rounded-2xl bg-muted/40 p-1 focus-within:ring-1 focus-within:ring-ring/40">
        <Textarea
          ref={model.inputRef}
          name="body"
          value={model.body}
          onChange={(event) => model.setBody(event.target.value)}
          onKeyDown={model.onComposerKeyDown}
          aria-label="Nachricht"
          placeholder={model.composerPlaceholder}
          required
          rows={4}
          className="min-h-24 resize-y border-0 bg-transparent p-3 text-[13px] leading-relaxed shadow-none focus-visible:ring-0 md:text-[13px] dark:bg-transparent"
        />
        <div className="flex flex-wrap items-center gap-2 px-2 pb-2">
          <Tooltip content="Datei anhängen">
            <label className="flex size-8 cursor-pointer items-center justify-center rounded-xl focus-within:ring-2 focus-within:ring-ring text-muted-foreground hover:bg-muted">
              <PaperclipIcon className="size-4" />
              <input
                type="file"
                aria-label="Datei anhängen"
                multiple
                className="sr-only"
                onChange={(event) => model.onFiles(event.target.files)}
              />
            </label>
          </Tooltip>
          <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
            {model.files.length
              ? model.files.map((file) => file.name).join(", ")
              : "Anhänge bis 20 MB"}
          </span>
          <Tooltip
            content={
              <span className="flex items-center gap-2">
                {model.composerLabel}
                <Kbd>{IS_MAC ? "⌘" : "Strg"} ↵</Kbd>
              </span>
            }
          >
            <Button
              type="submit"
              disabled={model.sending || !model.body.trim()}
              className="gap-2 text-xs"
            >
              {model.sending ? "Wird gespeichert …" : model.composerLabel}
            </Button>
          </Tooltip>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">{model.composerHint}</p>
    </form>
  );
}
