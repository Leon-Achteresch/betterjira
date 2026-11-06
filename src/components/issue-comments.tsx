import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowDownWideNarrowIcon, CheckIcon, ChevronDownIcon, FileTextIcon, InfoIcon, RotateCwIcon, Trash2Icon, Undo2Icon } from "lucide-react";
import { CommentActionsMenu } from "@/components/comment-actions-menu";
import { CommentDeleteDialog } from "@/components/comment-delete-dialog";
import { CommentEditorBox } from "@/components/comment-editor-box";
import { CommentThreadView } from "@/components/comment-thread";
import { MentionEditor } from "@/components/mention-editor";
import { Tooltip } from "@/components/motion/tooltip";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useCommentActions } from "@/hooks/use-comment-actions";
import { useCommentDeletion } from "@/hooks/use-comment-deletion";
import { useCommentEdits } from "@/hooks/use-comment-edits";
import { useCommentReplies } from "@/hooks/use-comment-replies";
import { useIssueComments } from "@/hooks/use-issue-comments";
import { EASE_OUT } from "@/lib/ease";
import { IS_MAC } from "@/lib/platform";
import { cn } from "@/lib/utils";
import { ADF_COMMENT_TEMPLATES } from "@/lib/workspace";
import type { JiraIssueDetail } from "@/lib/jira/queries";

const SKELETON_WIDTHS = ["w-11/12", "w-3/4", "w-5/6"];

function CommentListSkeleton() {
  return (
    <div aria-busy aria-label="Kommentare werden geladen" className="flex flex-col gap-6">
      {SKELETON_WIDTHS.map((width) => (
        <div key={width} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Skeleton className="size-6 rounded-full" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className={cn("ml-8 h-4", width)} />
        </div>
      ))}
    </div>
  );
}

export function IssueComments({ issue }: { issue: JiraIssueDetail }) {
  const view = useIssueComments(issue);
  const replies = useCommentReplies(issue);
  const actions = useCommentActions(issue);
  const edits = useCommentEdits(issue.key);
  const deletion = useCommentDeletion(issue.key, edits.closeFor);
  const reduce = useReducedMotion();

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={view.submit}
        onFocusCapture={view.composer.onFocusCapture}
        onBlurCapture={view.composer.onBlurCapture}
        className="flex flex-col gap-3"
      >
        <MentionEditor
          ref={view.editorRef}
          id={`comment-${issue.key}`}
          label="Kommentar"
          value={view.draft}
          onChange={view.setDraft}
          disabled={!view.ready}
          toolbar={view.composer.expanded}
          issueKey={issue.key}
          participants={view.participants}
          onSubmitShortcut={() => void view.submit()}
        />
        <AnimatePresence initial={false}>
          {view.composer.expanded && (
            <motion.div
              key="composer-actions"
              initial={{ opacity: 0, y: reduce ? 0 : -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.18, ease: EASE_OUT }}
              className="flex flex-wrap items-center gap-2"
            >
              <Button type="submit" size="sm" disabled={!view.canSend}>
                {view.pending && <Spinner />}
                Kommentieren
              </Button>
              <DropdownMenu open={view.composer.templatesOpen} onOpenChange={view.composer.setTemplatesOpen}>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" disabled={!view.ready}>
                    <FileTextIcon />
                    Vorlage
                    <ChevronDownIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-44" onCloseAutoFocus={view.onTemplateMenuClose}>
                  {ADF_COMMENT_TEMPLATES.map((template) => (
                    <DropdownMenuItem key={template.label} onSelect={() => view.insertTemplate(template.blocks)}>
                      {template.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Tooltip
                content={
                  <span className="flex flex-col gap-1">
                    <span>@ erwähnt eine Person.</span>
                    <span>{IS_MAC ? "⌘" : "Strg"} + Enter sendet deinen Kommentar.</span>
                  </span>
                }
              >
                <Button type="button" variant="ghost" size="icon-sm" aria-label="Formatierung und Tastenkürzel" className="text-muted-foreground">
                  <InfoIcon />
                </Button>
              </Tooltip>
              <AnimatePresence initial={false}>
                {view.draft && (
                  <motion.div
                    key="draft-status"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15, ease: EASE_OUT }}
                    className="ml-auto flex items-center gap-1.5"
                  >
                    <Tooltip content="Dein Entwurf bleibt auf diesem Gerät gespeichert, auch wenn du das Ticket wechselst.">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" role="status" tabIndex={0}>
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
                        disabled={view.pending}
                        onClick={view.discard}
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
        {view.error && (
          <p role="alert" className="text-sm text-destructive">
            {view.error} Dein Entwurf bleibt erhalten.
          </p>
        )}
      </form>

      {view.listState === "loading" && <CommentListSkeleton />}
      {(view.listState === "error" || view.refreshFailed) && (
        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive">
          <span>{view.listError}</span>
          <Button type="button" variant="outline" size="sm" onClick={view.reload}>
            <RotateCwIcon />
            Erneut laden
          </Button>
        </div>
      )}
      {view.listState === "ready" && !view.hasComments && <p className="text-sm text-muted-foreground">Noch keine Kommentare.</p>}
      {view.listState === "ready" && view.hasComments && (
        <div className="flex flex-col gap-4">
          <Button
            variant="ghost"
            size="sm"
            className="self-end text-muted-foreground"
            onClick={view.toggleOrder}
            aria-pressed={view.newestFirst}
          >
            <ArrowDownWideNarrowIcon />
            {view.newestFirst ? "Neueste zuerst" : "Älteste zuerst"}
          </Button>
          <ol className="flex flex-col gap-6">
            <AnimatePresence initial={false}>
              {view.threads.map((thread) => (
                <motion.li
                  key={thread.root.id}
                  layout={!reduce}
                  initial={{ opacity: 0, y: reduce ? 0 : 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18, ease: EASE_OUT }}
                >
                  <CommentThreadView
                    thread={thread}
                    viewFor={(comment) => {
                      const allowed = actions.allowedFor(comment);
                      return {
                        menu: (
                          <CommentActionsMenu
                            onCopyLink={() => actions.copyLink(comment)}
                            edit={
                              allowed.canEdit
                                ? { label: edits.editLabel(comment), disabledReason: edits.blockReason(comment), onSelect: () => edits.start(comment) }
                                : undefined
                            }
                            onDelete={allowed.canDelete ? () => deletion.request(thread, comment) : undefined}
                          />
                        ),
                        editedNote: actions.editedNote(comment),
                        onResumeEdit: allowed.canEdit && edits.hasDraft(comment) ? () => edits.start(comment) : undefined,
                        editor: edits.isOpenFor(comment) ? (
                          <CommentEditorBox
                            key={edits.boxKey}
                            id={`edit-${issue.key}-${comment.id}`}
                            label="Kommentar bearbeiten"
                            submitLabel="Speichern"
                            issueKey={issue.key}
                            participants={view.participants}
                            value={edits.value}
                            onChange={edits.setValue}
                            onSubmit={() => void edits.save()}
                            onCancel={edits.close}
                            pending={edits.pending}
                            canSend={edits.canSave}
                            disabled={!edits.ready}
                            error={edits.error}
                            extraAction={
                              edits.hasDraft(comment) ? (
                                <Button type="button" variant="ghost" size="sm" onClick={edits.discardChanges}>
                                  <Undo2Icon />
                                  Änderungen verwerfen
                                </Button>
                              ) : null
                            }
                          />
                        ) : null,
                      };
                    }}
                    replyLabel={replies.labelFor(thread.root)}
                    onReply={replies.canReply ? (comment) => replies.start(comment, thread.root) : undefined}
                    replyBox={
                      replies.isOpenFor(thread.root) ? (
                        <CommentEditorBox
                          key={replies.boxKey}
                          id={`reply-${issue.key}-${replies.openThread}`}
                          label="Antwort"
                          submitLabel="Antwort senden"
                          issueKey={issue.key}
                          participants={view.participants}
                          value={replies.value}
                          onChange={replies.setDraft}
                          onSubmit={() => void replies.submit()}
                          onCancel={replies.close}
                          pending={replies.pending}
                          canSend={replies.canSend}
                          disabled={!replies.ready}
                          error={replies.error}
                        />
                      ) : null
                    }
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        </div>
      )}
      <CommentDeleteDialog {...deletion.dialog} />
    </div>
  );
}
