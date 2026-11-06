import { motion, useReducedMotion } from "motion/react";
import { MentionEditor } from "@/components/mention-editor";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { EASE_OUT } from "@/lib/ease";
import type { AdfNode } from "@/lib/jira/adf";
import type { MentionCandidate } from "@/lib/jira/people";

export function CommentReplyBox({
  id,
  issueKey,
  participants,
  value,
  onChange,
  onSubmit,
  onCancel,
  pending,
  canSend,
  disabled,
  error,
}: {
  id: string;
  issueKey: string;
  participants: readonly MentionCandidate[];
  value: AdfNode | undefined;
  onChange: (value: AdfNode) => void;
  onSubmit: () => void;
  onCancel: () => void;
  pending: boolean;
  canSend: boolean;
  disabled: boolean;
  error?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.form
      initial={{ opacity: 0, y: reduce ? 0 : -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.12, ease: EASE_OUT } }}
      transition={{ duration: 0.22, ease: EASE_OUT }}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-2"
    >
      <MentionEditor
        id={id}
        label="Antwort"
        value={value}
        onChange={onChange}
        disabled={disabled}
        autoFocus
        issueKey={issueKey}
        participants={participants}
        onSubmitShortcut={onSubmit}
        onEscape={onCancel}
      />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={!canSend}>
          {pending && <Spinner />}
          Antwort senden
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Abbrechen
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error} Dein Entwurf bleibt erhalten.
        </p>
      )}
    </motion.form>
  );
}
