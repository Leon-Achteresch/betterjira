import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { useJiraAddComment } from "@/hooks/jira/use-issue-mutations";
import { useWorkspace } from "@/hooks/use-workspace";
import { useCommentComposer } from "@/hooks/use-comment-composer";
import { appendTemplate, clearSubmittedDraft, setCommentDraft } from "@/lib/workspace";
import { filterComments } from "@/lib/jira/comment-search";
import type { JiraIssueDetail } from "@/lib/jira/queries";

type Comment = NonNullable<JiraIssueDetail["fields"]["comment"]>["comments"][number];

export function useIssueComments(issueKey: string, comments: readonly Comment[]) {
  const add = useJiraAddComment(issueKey);
  const { workspace, update, ready } = useWorkspace();
  const submitting = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const templateInserted = useRef(false);
  const draft = workspace.drafts[issueKey] ?? "";
  const composer = useCommentComposer(!!draft || add.isPending);
  const setDraft = (value: string) => update((current) => setCommentDraft(current, issueKey, value));
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchToggleRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const sorted = [...comments].sort((a, b) =>
    workspace.newestFirst
      ? Date.parse(b.created) - Date.parse(a.created)
      : Date.parse(a.created) - Date.parse(b.created),
  );
  const closeSearch = () => {
    setQuery("");
    setSearchOpen(false);
    searchToggleRef.current?.focus();
  };

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!ready || !draft.trim() || submitting.current || add.isPending) return;
    submitting.current = true;
    const submitted = draft;
    try {
      await add.mutateAsync(submitted.trim());
      update((current) => clearSubmittedDraft(current, issueKey, submitted));
      toast.success("Kommentar hinzugefügt");
    } catch {
      return;
    } finally {
      submitting.current = false;
    }
  };

  return {
    draft,
    composer,
    ready,
    inputRef,
    setDraft,
    submit,
    pending: add.isPending,
    error: add.error?.message,
    newestFirst: workspace.newestFirst,
    comments: filterComments(sorted, query),
    search: {
      open: searchOpen,
      query,
      loaded: comments.length,
      toggleRef: searchToggleRef,
      inputRef: searchInputRef,
      setQuery,
      reset: () => {
        setQuery("");
        searchInputRef.current?.focus();
      },
      toggle: () => (searchOpen ? closeSearch() : setSearchOpen(true)),
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key !== "Escape" || query) return;
        event.stopPropagation();
        closeSearch();
      },
    },
    toggleOrder: () => update((current) => ({ ...current, newestFirst: !current.newestFirst })),
    insertTemplate: (body: string) => {
      templateInserted.current = true;
      setDraft(appendTemplate(draft, body));
      inputRef.current?.focus();
    },
    onTemplateMenuClose: (event: Event) => {
      if (!templateInserted.current) return;
      templateInserted.current = false;
      event.preventDefault();
      inputRef.current?.focus();
    },
    discard: () => {
      const discarded = draft;
      setDraft("");
      toast("Entwurf verworfen", {
        action: {
          label: "Rückgängig",
          onClick: () =>
            update((current) =>
              setCommentDraft(current, issueKey, appendTemplate(current.drafts[issueKey] ?? "", discarded)),
            ),
        },
      });
    },
    onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing) {
        event.preventDefault();
        void submit();
      }
    },
  };
}
