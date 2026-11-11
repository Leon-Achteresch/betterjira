import { useId } from "react";
import { AdfEditor, type AdfEditorProps } from "@/components/adf-editor";
import { JiraUserAvatar } from "@/components/jira-user-avatar";
import { SuggestionList } from "@/components/motion/suggestion-list";
import { useEditorMedia, type EditorMediaSource } from "@/hooks/jira/use-editor-media";
import { useMentionSuggestion } from "@/hooks/use-mention-suggestion";
import type { MentionCandidate } from "@/lib/jira/people";

export function MentionEditor({
  issueKey,
  participants,
  mediaSource,
  ...editor
}: Omit<AdfEditorProps, "suggestion" | "isSuggestionOpen" | "aria" | "media"> & {
  issueKey: string;
  participants: readonly MentionCandidate[];
  mediaSource?: EditorMediaSource;
}) {
  const listId = useId();
  const mention = useMentionSuggestion({ listId, issueKey, participants });
  const media = useEditorMedia(mediaSource);

  return (
    <>
      <AdfEditor {...editor} media={media} suggestion={mention.suggestion} isSuggestionOpen={mention.isOpen} aria={mention.aria} />
      <SuggestionList
        id={listId}
        label="Personen"
        open={mention.list.open}
        anchor={mention.list.anchor}
        items={mention.list.candidates}
        getValue={(candidate) => candidate.accountId}
        renderItem={(candidate) => (
          <>
            <JiraUserAvatar user={candidate} />
            <span className="truncate">{candidate.displayName}</span>
          </>
        )}
        activeValue={mention.list.activeValue}
        onActiveChange={mention.list.setActiveValue}
        onSelect={mention.list.select}
        status={mention.list.status}
      />
    </>
  );
}
