import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowDownWideNarrowIcon, CheckIcon, ChevronDownIcon, InfoIcon, FileTextIcon, Trash2Icon } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { de } from "date-fns/locale";
import { AdfContent } from "@/components/adf-content";
import { IssueCommentPages } from "@/components/issue-comment-pages";
import { JiraUserLabel } from "@/components/jira-user-avatar";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/motion/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useIssueComments } from "@/hooks/use-issue-comments";
import type { IssueCommentPages as CommentPages } from "@/hooks/jira/use-issue-comment-pages";
import { EASE_OUT } from "@/lib/ease";
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
  const reduce = useReducedMotion();
  const pageControl = pages.visible && <IssueCommentPages pages={pages} />;

  return (
    <div className="flex flex-col gap-6">
      {pages.comments.length === 0 && !pages.visible ? (
        <p className="text-sm text-muted-foreground">Noch keine Kommentare.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {pages.comments.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="self-end text-muted-foreground"
              onClick={editor.toggleOrder}
              aria-pressed={editor.newestFirst}
            >
              <ArrowDownWideNarrowIcon />
              {editor.newestFirst ? "Neueste zuerst" : "Älteste zuerst"}
            </Button>
          )}
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
