import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { copyToClipboard } from "@/lib/clipboard";
import { jiraQueryScopeMatches, type JiraQueryScope } from "@/lib/jira/query-scope";
import type { SearchIssue } from "@/lib/jira/search";
import { useContextSession } from "./use-context-session";
import { useLatestRef } from "./use-latest-ref";
import { useSubmissionLock } from "./use-submission-lock";

const blankDraft = (token: object) => ({
  token,
  open: false,
  text: "",
  reviewed: false,
  inserted: [] as string[],
});

export function useCustomerChangeDraft(input: {
  context: string;
  scope: JiraQueryScope | undefined;
  ready: boolean;
  selected: readonly SearchIssue[];
  hasMore: boolean;
  readError: boolean;
}) {
  const client = useQueryClient();
  const lock = useSubmissionLock();
  const sources = input.selected.map(({ id, key, fields }) => ({
    id, key, title: typeof fields.summary === "string" ? fields.summary.trim() : "",
  }));
  const session = useContextSession(JSON.stringify([input.context, input.scope, input.ready, sources]));
  const [stored, setDraft] = useState(() => blankDraft(session.token));
  const draft = stored.token === session.token ? stored : blankDraft(session.token);
  if (draft !== stored) setDraft(draft);
  const latest = useLatestRef(draft);
  const allowed = input.ready && sources.length > 0 && jiraQueryScopeMatches(client, input.scope);
  const isCurrent = () => session.isCurrent() && allowed && jiraQueryScopeMatches(client, input.scope);
  const update = (change: (current: typeof draft) => typeof draft) => {
    if (isCurrent()) setDraft((previous) => previous.token === session.token ? change(previous) : previous);
  };
  const canCopy = draft.reviewed && !!draft.text.trim();

  return {
    open: draft.open && allowed,
    disabled: !allowed,
    sources,
    text: draft.text,
    reviewed: draft.reviewed,
    inserted: draft.inserted,
    canCopy,
    hasMore: input.hasMore,
    readError: input.readError,
    setOpen: (open: boolean) => update((current) => ({ ...current, open, reviewed: open ? current.reviewed : false })),
    setText: (text: string) => update((current) => current.open && current.text !== text
      ? { ...current, text, reviewed: false, inserted: text.trim() ? current.inserted : [] } : current),
    insertTitle: (key: string) => {
      const source = sources.find((entry) => entry.key === key);
      if (!source?.title) return;
      update((current) => {
        if (!current.open || current.inserted.includes(key)) return current;
        return {
          ...current,
          text: current.text.trim() ? `${current.text}\n\n${source.title}` : source.title,
          reviewed: false,
          inserted: [...current.inserted, key],
        };
      });
    },
    setReviewed: (reviewed: boolean) => update((current) => current.open && current.text.trim() && current === draft
      ? { ...current, reviewed } : current),
    copy: async () => {
      if (!isCurrent() || latest.current !== draft || !draft.open || !canCopy || !lock.acquire("copy")) return;
      try {
        await copyToClipboard(draft.text, "Kundenhinweis kopiert");
      } finally {
        lock.release("copy");
      }
    },
  };
}

export type CustomerChangeDraftState = ReturnType<typeof useCustomerChangeDraft>;
