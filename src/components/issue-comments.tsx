import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowDownWideNarrowIcon,
  CheckIcon,
  ChevronDownIcon,
  InfoIcon,
  FileTextIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { de } from "date-fns/locale";
import { AdfContent } from "@/components/adf-content";
import { IssueCommentPages } from "@/components/issue-comment-pages";
import { JiraUserLabel } from "@/components/jira-user-avatar";
import { CommentLinkAction } from "@/components/issues/comment-link-action";
import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/motion/search-field";
import { Tooltip } from "@/components/motion/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useIssueComments } from "@/hooks/use-issue-comments";
import type { IssueCommentPages as CommentPages } from "@/hooks/jira/use-issue-comment-pages";
import { useCommentLink } from "@/hooks/jira/use-comment-link";
import { EASE_OUT } from "@/lib/ease";
import { commentSearchSummary } from "@/lib/jira/comment-search";
import { IS_MAC } from "@/lib/platform";
import { COMMENT_TEMPLATES } from "@/lib/workspace";
export function IssueComments({
  issueKey,
  pages,
}: {
  issueKey: string;
  pages: CommentPages;
}) {
  const editor = useIssueComments(issueKey, pages.comments);
  const link = useCommentLink(issueKey);
  const reduce = useReducedMotion();
  const pageControl = pages.visible && <IssueCommentPages pages={pages} />;

  return (
    <div className="flex flex-col gap-6">
      {pages.comments.length === 0 && !pages.visible ? (
        <p className="text-sm text-muted-foreground">Noch keine Kommentare.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-end gap-1">
            <Tooltip
              content={
                editor.search.open ? (
                  <span className="flex items-center gap-1.5">
                    Suche schließen <Kbd>Esc</Kbd>
                  </span>
                ) : (
                  "Geladene Kommentare durchsuchen"
                )
              }
            >
              <Button
                ref={editor.search.toggleRef}
                type="button"
                variant="ghost"
                size="icon"
                aria-label={editor.search.open ? "Kommentarsuche schließen" : "Geladene Kommentare durchsuchen"}
                aria-expanded={editor.search.open}
                aria-controls={editor.search.open ? `comment-search-${issueKey}` : undefined}
                className={editor.search.open ? "bg-muted text-foreground" : "text-muted-foreground"}
                onClick={editor.search.toggle}
              >
                <SearchIcon />
              </Button>
            </Tooltip>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={editor.toggleOrder}
              aria-pressed={editor.newestFirst}
            >
              <ArrowDownWideNarrowIcon />
              {editor.newestFirst ? "Neueste zuerst" : "Älteste zuerst"}
            </Button>
          </div>
          <AnimatePresence initial={false}>
            {editor.search.open && (
              <motion.div
                key="comment-search"
                id={`comment-search-${issueKey}`}
                role="search"
                initial={{ opacity: 0, y: reduce ? 0 : -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                transition={{ duration: 0.18, ease: EASE_OUT }}
                onKeyDown={editor.search.onKeyDown}
                className="flex flex-col gap-1.5"
              >
                <SearchField
                  autoFocus
                  inputRef={editor.search.inputRef}
                  value={editor.search.query}
                  onChange={editor.search.setQuery}
                  label="Geladene Kommentare durchsuchen"
                  placeholder="Text oder Person suchen …"
                />
                <p role="status" className="text-xs text-muted-foreground tabular-nums">
                  {commentSearchSummary(editor.comments.length, editor.search.loaded, editor.search.query)}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence initial={false}>
            {editor.search.open && editor.search.query.trim() && editor.comments.length === 0 && (
              <motion.div
                key="comment-search-empty"
                initial={{ opacity: 0, y: reduce ? 0 : 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.12 } }}
                transition={{ duration: 0.18, ease: EASE_OUT }}
                className="flex flex-col items-start gap-3 rounded-2xl border border-dashed p-4"
              >
                <p className="text-sm text-muted-foreground text-balance">
                  Kein geladener Kommentar enthält „{editor.search.query.trim()}“ im Text oder Namen.
                </p>
                <Button type="button" variant="outline" size="sm" onClick={editor.search.reset}>
                  Suche zurücksetzen
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
          {editor.newestFirst && pageControl}
          <ol className="flex flex-col gap-6">
            <AnimatePresence initial={false}>
              {editor.comments.map((comment) => (
                <motion.li
                  key={comment.id}
                  layout={!reduce}
                  initial={{ opacity: 0, y: reduce ? 0 : 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: EASE_OUT }}
                  className="flex flex-col gap-2"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 [overflow-wrap:anywhere]">
                      <JiraUserLabel user={comment.author} />
                      <span
                        className="text-xs text-muted-foreground"
                        title={new Date(comment.created).toLocaleString("de-DE")}
                      >
                        {formatDistanceToNowStrict(new Date(comment.created), {
                          locale: de,
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <CommentLinkAction available={link.available(comment.id)} onCopy={() => void link.copy(comment.id)} />
                  </div>
                  <AdfContent doc={comment.body} className="pl-8" />
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
          {!editor.newestFirst && pageControl}
        </div>
      )}
      <form
        onSubmit={editor.submit}
        onFocusCapture={editor.composer.onFocusCapture}
        onBlurCapture={editor.composer.onBlurCapture}
        className="flex flex-col gap-3"
      >
        <Textarea
          ref={editor.inputRef}
          value={editor.draft}
          disabled={!editor.ready}
          placeholder="Kommentar schreiben …"
          aria-label="Kommentar"
          onChange={(event) => editor.setDraft(event.target.value)}
          onKeyDown={editor.onKeyDown}
          className="min-h-24"
        />
        <AnimatePresence initial={false}>
          {editor.composer.expanded && (
            <motion.div
              key="composer-actions"
              initial={{ opacity: 0, y: reduce ? 0 : -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.18, ease: EASE_OUT }}
              className="flex flex-wrap items-center gap-2"
            >
              <Button type="submit" size="sm" disabled={!editor.ready || !editor.draft.trim() || editor.pending}>
                {editor.pending && <Spinner />}
                Kommentieren
              </Button>
              <DropdownMenu open={editor.composer.templatesOpen} onOpenChange={editor.composer.setTemplatesOpen}>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" disabled={!editor.ready}>
                    <FileTextIcon />
                    Vorlage
                    <ChevronDownIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-44" onCloseAutoFocus={editor.onTemplateMenuClose}>
                  {COMMENT_TEMPLATES.map((template) => (
                    <DropdownMenuItem key={template.label} onSelect={() => editor.insertTemplate(template.body)}>
                      {template.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Tooltip
                content={
                  <span className="flex flex-col gap-1">
                    <span>*fett* · _kursiv_ · [~accountid:…] für Erwähnungen</span>
                    <span>{IS_MAC ? "⌘" : "Strg"} + Enter sendet deinen Kommentar.</span>
                  </span>
                }
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Formatierung und Tastenkürzel"
                  className="text-muted-foreground"
                >
                  <InfoIcon />
                </Button>
              </Tooltip>
              <AnimatePresence initial={false}>
                {editor.draft && (
                  <motion.div
                    key="draft-status"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15, ease: EASE_OUT }}
                    className="ml-auto flex items-center gap-1.5"
                  >
                    <Tooltip content="Dein Entwurf bleibt auf diesem Gerät gespeichert, auch wenn du das Ticket wechselst.">
                      <span
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                        role="status"
                        tabIndex={0}
                      >
                        <CheckIcon className="size-3" />
                        Gespeichert
                      </span>
                    </Tooltip>
                    <Tooltip content="Entwurf verwerfen">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Entwurf verwerfen"
                        disabled={editor.pending}
                        onClick={editor.discard}
                      >
                        <Trash2Icon />
                      </Button>
                    </Tooltip>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
        {editor.error && (
          <p role="alert" className="text-sm text-destructive">
            {editor.error} Dein Entwurf bleibt erhalten.
          </p>
        )}
      </form>
    </div>
  );
}
